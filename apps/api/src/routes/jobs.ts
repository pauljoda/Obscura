import { existsSync, unlinkSync } from "node:fs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, asc, desc, eq, inArray, isNull, like, ne, not, or, sql, type SQL } from "drizzle-orm";
import {
  queueDefinitions,
  resolveQueueWorkerConcurrency,
  type JobKind,
  type JobTriggerKind,
  type QueueName,
} from "@obscura/contracts";
import { allSceneVideoGeneratedDiskPaths } from "@obscura/media-core";
import { db, schema } from "../db";
import { ensureLibrarySettingsRow } from "../lib/library";
import { pruneUntrackedLibraryReferences } from "../lib/library-prune";
import { cancelJob, deleteJob, sendJob } from "../lib/queues";

const {
  jobRuns,
  libraryRoots,
  audioTracks,
  videoEpisodes,
  videoMovies,
} = schema;

type VideoEntityKind = "video_episode" | "video_movie";

interface VideoEntityTarget {
  kind: VideoEntityKind;
  id: string;
  title: string | null;
}

type JobPayload = Record<string, unknown> & {
  jobKind?: JobKind;
  triggeredBy?: JobTriggerKind;
  triggerLabel?: string;
};

type QueueTarget = {
  type?: string | null;
  id?: string | null;
  label?: string | null;
};

type QueueTrigger = {
  by?: JobTriggerKind;
  kind?: JobKind;
  label?: string | null;
};

/** SFW-only job runs: skip NSFW-marked entities (matches web NSFW mode `off`). */
function readSfwOnly(request: FastifyRequest): boolean {
  const body = request.body as { nsfw?: string } | undefined;
  if (body && typeof body === "object" && body.nsfw === "off") {
    return true;
  }
  const raw = request.headers["x-obscura-nsfw-mode"];
  const headerVal = Array.isArray(raw) ? raw[0] : raw;
  return headerVal === "off";
}

function episodesSfwFilter(sfwOnly: boolean): SQL | undefined {
  return sfwOnly ? ne(videoEpisodes.isNsfw, true) : undefined;
}

function moviesSfwFilter(sfwOnly: boolean): SQL | undefined {
  return sfwOnly ? ne(videoMovies.isNsfw, true) : undefined;
}

function andEpisodeSfw(base: SQL, sfwOnly: boolean): SQL {
  const sfw = episodesSfwFilter(sfwOnly);
  return sfw ? and(base, sfw)! : base;
}

function andMovieSfw(base: SQL, sfwOnly: boolean): SQL {
  const sfw = moviesSfwFilter(sfwOnly);
  return sfw ? and(base, sfw)! : base;
}

function getQueueDefinition(queueName: QueueName) {
  return queueDefinitions.find((definition) => definition.name === queueName)!;
}

function withTriggerMetadata(
  payload: Record<string, unknown>,
  trigger: QueueTrigger = {}
): JobPayload {
  return {
    ...payload,
    ...(trigger.kind ? { jobKind: trigger.kind } : {}),
    ...(trigger.by ? { triggeredBy: trigger.by } : {}),
    ...(trigger.label ? { triggerLabel: trigger.label } : {}),
  };
}

function readTriggerMetadata(payload: unknown): QueueTrigger {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const meta = payload as JobPayload;
  return {
    kind: meta.jobKind ?? undefined,
    by: meta.triggeredBy ?? undefined,
    label: typeof meta.triggerLabel === "string" ? meta.triggerLabel : undefined,
  };
}

function toJobRunDto(job: typeof jobRuns.$inferSelect) {
  const queueDefinition = getQueueDefinition(job.queueName as QueueName);
  const trigger = readTriggerMetadata(job.payload);

  return {
    ...job,
    queueLabel: queueDefinition.label,
    jobKind: trigger.kind ?? null,
    triggeredBy: trigger.by ?? null,
    triggerLabel: trigger.label ?? null,
    progress: job.progress ?? 0,
  };
}

async function hasPendingJob(queueName: QueueName, target: QueueTarget) {
  if (!target.id) {
    return false;
  }

  const predicates = [
    eq(jobRuns.queueName, queueName),
    eq(jobRuns.targetId, target.id),
    inArray(jobRuns.status, ["waiting", "active", "delayed"]),
  ];

  if (target.type) {
    predicates.push(eq(jobRuns.targetType, target.type));
  }

  const [pending] = await db
    .select({ id: jobRuns.id })
    .from(jobRuns)
    .where(and(...predicates))
    .limit(1);

  return Boolean(pending);
}

async function recordQueuedJob(input: {
  queueName: QueueName;
  bullmqJobId: string;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  payload?: Record<string, unknown>;
}) {
  await db.insert(jobRuns).values({
    queueName: input.queueName,
    bullmqJobId: input.bullmqJobId,
    status: "waiting",
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    targetLabel: input.targetLabel ?? null,
    payload: input.payload ?? {},
  });
}

async function enqueueQueueJob(input: {
  queueName: QueueName;
  jobName: string;
  data: Record<string, unknown>;
  target: QueueTarget;
  trigger?: QueueTrigger;
}) {
  if (await hasPendingJob(input.queueName, input.target)) {
    return null;
  }

  const payload = withTriggerMetadata(input.data, input.trigger);
  const jobId = await sendJob(input.queueName, payload);

  await recordQueuedJob({
    queueName: input.queueName,
    bullmqJobId: jobId,
    targetType: input.target.type ?? null,
    targetId: input.target.id ?? null,
    targetLabel: input.target.label ?? null,
    payload,
  });

  return { id: jobId };
}

/** One job relocates all video-entity generated assets; deduped by target id `scene-asset-layout`. */
async function queueVideoAssetStorageMigration(
  targetDedicated: boolean,
  trigger: QueueTrigger,
  targetLabel: string,
  options?: { sfwRedactJobLog?: boolean }
) {
  return enqueueQueueJob({
    queueName: "library-maintenance",
    jobName: "migrate-video-assets",
    data: {
      targetDedicated,
      ...(options?.sfwRedactJobLog ? { sfwRedactJobLog: true as const } : {}),
    },
    target: {
      type: "library",
      id: "scene-asset-layout",
      label: targetLabel,
    },
    trigger,
  });
}

async function enqueueLibraryScans(trigger: QueueTrigger = {}, sfwOnly = false) {
  await pruneUntrackedLibraryReferences(db);

  const roots = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.enabled, true))
    .orderBy(libraryRoots.path);

  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const root of roots) {
    const job = await enqueueQueueJob({
      queueName: "library-scan",
      jobName: "library-root-scan",
      data: {
        libraryRootId: root.id,
        path: root.path,
        recursive: root.recursive,
        ...(sfwOnly ? { sfwOnly: true } : {}),
      },
      target: {
        type: "library-root",
        id: root.id,
        label: root.label,
      },
      trigger,
    });

    if (job) {
      createdJobIds.push(String(job.id));
    } else {
      skipped += 1;
    }
  }

  return { jobIds: createdJobIds, skipped };
}

async function collectMissingVideoTargets(
  queueName: QueueName,
  sfwOnly: boolean,
): Promise<VideoEntityTarget[]> {
  const targets: VideoEntityTarget[] = [];

  if (queueName === "media-probe") {
    const episodeRows = await db
      .select({ id: videoEpisodes.id, title: videoEpisodes.title })
      .from(videoEpisodes)
      .where(
        andEpisodeSfw(
          or(
            isNull(videoEpisodes.duration),
            isNull(videoEpisodes.width),
            isNull(videoEpisodes.codec),
          )!,
          sfwOnly,
        ),
      );
    for (const r of episodeRows) targets.push({ kind: "video_episode", ...r });

    const movieRows = await db
      .select({ id: videoMovies.id, title: videoMovies.title })
      .from(videoMovies)
      .where(
        andMovieSfw(
          or(
            isNull(videoMovies.duration),
            isNull(videoMovies.width),
            isNull(videoMovies.codec),
          )!,
          sfwOnly,
        ),
      );
    for (const r of movieRows) targets.push({ kind: "video_movie", ...r });
  } else if (queueName === "fingerprint") {
    const episodeRows = await db
      .select({ id: videoEpisodes.id, title: videoEpisodes.title })
      .from(videoEpisodes)
      .where(
        andEpisodeSfw(
          or(isNull(videoEpisodes.checksumMd5), isNull(videoEpisodes.oshash))!,
          sfwOnly,
        ),
      );
    for (const r of episodeRows) targets.push({ kind: "video_episode", ...r });

    const movieRows = await db
      .select({ id: videoMovies.id, title: videoMovies.title })
      .from(videoMovies)
      .where(
        andMovieSfw(
          or(isNull(videoMovies.checksumMd5), isNull(videoMovies.oshash))!,
          sfwOnly,
        ),
      );
    for (const r of movieRows) targets.push({ kind: "video_movie", ...r });
  } else if (queueName === "preview") {
    const previewMissing = (kind: "episode" | "movie") => {
      const t = kind === "episode" ? videoEpisodes : videoMovies;
      return or(
        isNull(t.previewPath),
        isNull(t.spritePath),
        isNull(t.trickplayVttPath),
        and(
          or(isNull(t.thumbnailPath), not(like(t.thumbnailPath, "%thumb-custom%"))),
          or(isNull(t.thumbnailPath), isNull(t.cardThumbnailPath)),
        ),
      )!;
    };

    const episodeRows = await db
      .select({ id: videoEpisodes.id, title: videoEpisodes.title })
      .from(videoEpisodes)
      .where(andEpisodeSfw(previewMissing("episode"), sfwOnly));
    for (const r of episodeRows) targets.push({ kind: "video_episode", ...r });

    const movieRows = await db
      .select({ id: videoMovies.id, title: videoMovies.title })
      .from(videoMovies)
      .where(andMovieSfw(previewMissing("movie"), sfwOnly));
    for (const r of movieRows) targets.push({ kind: "video_movie", ...r });
  } else if (queueName === "metadata-import") {
    // Just sample some rows — metadata-import is a generic provider
    // sync and the 25-row limit matches the old behavior.
    const episodeRows = await db
      .select({ id: videoEpisodes.id, title: videoEpisodes.title })
      .from(videoEpisodes)
      .where(episodesSfwFilter(sfwOnly))
      .limit(25);
    for (const r of episodeRows) targets.push({ kind: "video_episode", ...r });

    const movieRows = await db
      .select({ id: videoMovies.id, title: videoMovies.title })
      .from(videoMovies)
      .where(moviesSfwFilter(sfwOnly))
      .limit(25);
    for (const r of movieRows) targets.push({ kind: "video_movie", ...r });
  }

  return targets;
}

async function enqueueMissingVideoJobs(
  queueName: QueueName,
  trigger: QueueTrigger = {},
  sfwOnly = false,
) {
  const targets = await collectMissingVideoTargets(queueName, sfwOnly);

  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const target of targets) {
    const job = await enqueueQueueJob({
      queueName,
      jobName: `${target.kind}-${queueName}`,
      data: { entityKind: target.kind, entityId: target.id },
      target: {
        type: target.kind,
        id: target.id,
        label: target.title,
      },
      trigger,
    });

    if (job) {
      createdJobIds.push(String(job.id));
    } else {
      skipped += 1;
    }
  }

  return { jobIds: createdJobIds, skipped };
}

// ─── Audio & Gallery scan dispatch ────────────────────────────────

async function enqueueGalleryScans(trigger: QueueTrigger = {}, sfwOnly = false) {
  const roots = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.enabled, true))
    .orderBy(libraryRoots.path);

  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const root of roots) {
    if (!(root.scanImages ?? true)) {
      skipped += 1;
      continue;
    }

    const job = await enqueueQueueJob({
      queueName: "gallery-scan",
      jobName: "gallery-root-scan",
      data: {
        libraryRootId: root.id,
        ...(sfwOnly ? { sfwOnly: true } : {}),
      },
      target: {
        type: "library-root",
        id: root.id,
        label: root.label,
      },
      trigger,
    });

    if (job) {
      createdJobIds.push(String(job.id));
    } else {
      skipped += 1;
    }
  }

  return { jobIds: createdJobIds, skipped };
}

async function enqueueAudioScans(trigger: QueueTrigger = {}, sfwOnly = false) {
  const roots = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.enabled, true))
    .orderBy(libraryRoots.path);

  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const root of roots) {
    if (!(root.scanAudio ?? true)) {
      skipped += 1;
      continue;
    }

    const job = await enqueueQueueJob({
      queueName: "audio-scan",
      jobName: "audio-root-scan",
      data: {
        libraryRootId: root.id,
        ...(sfwOnly ? { sfwOnly: true } : {}),
      },
      target: {
        type: "library-root",
        id: root.id,
        label: root.label,
      },
      trigger,
    });

    if (job) {
      createdJobIds.push(String(job.id));
    } else {
      skipped += 1;
    }
  }

  return { jobIds: createdJobIds, skipped };
}

async function enqueueMissingAudioTrackJobs(
  queueName: QueueName,
  trigger: QueueTrigger = {},
  _sfwOnly = false,
) {
  let trackRows: Array<{ id: string; title: string }> = [];

  if (queueName === "audio-probe") {
    trackRows = await db
      .select({ id: audioTracks.id, title: audioTracks.title })
      .from(audioTracks)
      .where(or(isNull(audioTracks.duration), isNull(audioTracks.codec)));
  } else if (queueName === "audio-fingerprint") {
    trackRows = await db
      .select({ id: audioTracks.id, title: audioTracks.title })
      .from(audioTracks)
      .where(or(isNull(audioTracks.checksumMd5), isNull(audioTracks.oshash)));
  } else if (queueName === "audio-waveform") {
    trackRows = await db
      .select({ id: audioTracks.id, title: audioTracks.title })
      .from(audioTracks)
      .where(isNull(audioTracks.waveformPath));
  }

  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const track of trackRows) {
    const job = await enqueueQueueJob({
      queueName,
      jobName: `audio-${queueName}`,
      data: { trackId: track.id },
      target: {
        type: "audio-track",
        id: track.id,
        label: track.title,
      },
      trigger,
    });

    if (job) {
      createdJobIds.push(String(job.id));
    } else {
      skipped += 1;
    }
  }

  return { jobIds: createdJobIds, skipped };
}

async function cancelJobRunById(jobRunId: string, reason = "Cancelled by user") {
  const [run] = await db
    .select()
    .from(jobRuns)
    .where(eq(jobRuns.id, jobRunId))
    .limit(1);

  if (!run) {
    return { kind: "missing" as const };
  }

  if (!["waiting", "active", "delayed"].includes(run.status)) {
    return { kind: "not-cancellable" as const, run };
  }

  const queueName = run.queueName as QueueName;
  const previousStatus = run.status;

  // pg-boss only cancels created/retry-state jobs. For active jobs it's a
  // no-op; the handler finishes naturally and our overwrite below ensures
  // the UI shows it dismissed.
  await cancelJob(queueName, run.bullmqJobId);

  await db
    .update(jobRuns)
    .set({
      status: "dismissed",
      error: reason,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobRuns.id, run.id));

  return {
    kind: "cancelled" as const,
    run,
    queueState: previousStatus,
  };
}

async function cancelQueueJobs(queueName: QueueName, reason = "Cancelled by user") {
  const pending = await db
    .select({ id: jobRuns.id, externalId: jobRuns.bullmqJobId, status: jobRuns.status })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.queueName, queueName),
        inArray(jobRuns.status, ["waiting", "active", "delayed"])
      )
    );

  let waitingRemoved = 0;
  let activeRemoved = 0;

  for (const row of pending) {
    await cancelJob(queueName, row.externalId);
    if (row.status === "active") {
      activeRemoved += 1;
    } else {
      waitingRemoved += 1;
    }
  }

  await db
    .update(jobRuns)
    .set({ status: "dismissed", error: reason, updatedAt: new Date() })
    .where(
      and(
        eq(jobRuns.queueName, queueName),
        inArray(jobRuns.status, ["waiting", "active", "delayed"])
      )
    );

  return {
    queueName,
    waitingRemoved,
    activeRemoved,
  };
}

export async function jobsRoutes(app: FastifyInstance) {
  app.get("/jobs", async () => {
    const settings = await ensureLibrarySettingsRow();
    const [latestScan] = await db
      .select({ finishedAt: jobRuns.finishedAt })
      .from(jobRuns)
      .where(and(eq(jobRuns.queueName, "library-scan"), eq(jobRuns.status, "completed")))
      .orderBy(desc(jobRuns.finishedAt))
      .limit(1);

    // Single Postgres source of truth for all status counts. Previously this
    // called `queue.getJobCounts` (Redis/BullMQ) for waiting/active/delayed
    // and Postgres for failed/completed, which led to dashboard drift when
    // the two backends disagreed.
    const countsRows = await db
      .select({
        queueName: jobRuns.queueName,
        status: jobRuns.status,
        total: sql<number>`count(*)::int`,
      })
      .from(jobRuns)
      .groupBy(jobRuns.queueName, jobRuns.status);

    const countsByQueue = new Map<string, Record<string, number>>();
    for (const row of countsRows) {
      let bucket = countsByQueue.get(row.queueName);
      if (!bucket) {
        bucket = {};
        countsByQueue.set(row.queueName, bucket);
      }
      bucket[row.status] = row.total;
    }

    const queues = queueDefinitions.map((definition) => {
      const bucket = countsByQueue.get(definition.name) ?? {};
      const waiting = bucket.waiting ?? 0;
      const delayed = bucket.delayed ?? 0;
      const active = bucket.active ?? 0;
      const failed = bucket.failed ?? 0;
      const completed = bucket.completed ?? 0;
      const status =
        failed > 0 ? "warning" : active > 0 || waiting > 0 || delayed > 0 ? "active" : "idle";

      return {
        name: definition.name,
        label: definition.label,
        description: definition.description,
        status,
        concurrency: resolveQueueWorkerConcurrency(
          definition.concurrency,
          settings.backgroundWorkerConcurrency
        ),
        active,
        waiting,
        delayed,
        backlog: waiting + delayed,
        completed,
        failed,
      };
    });

    const activeJobs = await db
      .select()
      .from(jobRuns)
      .where(inArray(jobRuns.status, ["waiting", "active", "delayed"]))
      .orderBy(
        sql`case
          when ${jobRuns.status} = 'active' then 0
          when ${jobRuns.status} = 'delayed' then 1
          else 2
        end`,
        asc(jobRuns.createdAt)
      )
      .limit(24);

    const failedJobs = await db
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.status, "failed"))
      .orderBy(desc(jobRuns.updatedAt), desc(jobRuns.createdAt))
      .limit(24);

    const completedJobs = await db
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.status, "completed"))
      .orderBy(desc(jobRuns.finishedAt), desc(jobRuns.createdAt))
      .limit(12);

    const recentJobs = await db
      .select()
      .from(jobRuns)
      .where(inArray(jobRuns.status, ["waiting", "active", "failed", "completed", "delayed"]))
      .orderBy(desc(jobRuns.updatedAt), desc(jobRuns.createdAt))
      .limit(18);

    return {
      queues,
      activeJobs: activeJobs.map(toJobRunDto),
      failedJobs: failedJobs.map(toJobRunDto),
      completedJobs: completedJobs.map(toJobRunDto),
      recentJobs: recentJobs.map(toJobRunDto),
      lastScanAt: latestScan?.finishedAt ?? null,
      schedule: {
        enabled: settings.autoScanEnabled,
        intervalMinutes: settings.scanIntervalMinutes,
      },
    };
  });

  app.post("/jobs/queues/:queueName/run", async (request, reply) => {
    const { queueName } = request.params as { queueName: QueueName };

    if (!queueDefinitions.find((definition) => definition.name === queueName)) {
      reply.code(404);
      return { error: "Unknown queue" };
    }

    const sfwOnly = readSfwOnly(request);

    const manualTrigger: QueueTrigger = {
      by: "manual",
      label: "Started from Operations",
    };

    let result: { jobIds: string[]; skipped: number };

    if (queueName === "library-scan") {
      result = await enqueueLibraryScans(manualTrigger, sfwOnly);
    } else if (queueName === "gallery-scan") {
      result = await enqueueGalleryScans(manualTrigger, sfwOnly);
    } else if (queueName === "audio-scan") {
      result = await enqueueAudioScans(manualTrigger, sfwOnly);
    } else if (queueName === "audio-probe" || queueName === "audio-fingerprint" || queueName === "audio-waveform") {
      result = await enqueueMissingAudioTrackJobs(queueName, manualTrigger, sfwOnly);
    } else if (queueName === "library-maintenance") {
      const settings = await ensureLibrarySettingsRow();
      const targetDedicated = settings.metadataStorageDedicated ?? true;
      // Always migrate every scene on disk; SFW request only affects job labels (no file paths in UI).
      const targetLabel = sfwOnly
        ? "Relocate scene generated files"
        : targetDedicated
          ? "Scene assets to dedicated cache"
          : "Scene assets beside media files";
      const job = await queueVideoAssetStorageMigration(
        targetDedicated,
        manualTrigger,
        targetLabel,
        { sfwRedactJobLog: sfwOnly },
      );
      result = {
        jobIds: job ? [String(job.id)] : [],
        skipped: job ? 0 : 1,
      };
    } else {
      result = await enqueueMissingVideoJobs(queueName, manualTrigger, sfwOnly);
    }

    return {
      ok: true,
      queueName,
      enqueued: result.jobIds.length,
      skipped: result.skipped,
      jobIds: result.jobIds,
    };
  });

  app.post("/jobs/:jobRunId/cancel", async (request, reply) => {
    const { jobRunId } = request.params as { jobRunId: string };
    const result = await cancelJobRunById(jobRunId);

    if (result.kind === "missing") {
      reply.code(404);
      return { error: "Job run not found" };
    }

    if (result.kind === "not-cancellable") {
      reply.code(409);
      return {
        error: `Job is already ${result.run.status}`,
      };
    }

    return {
      ok: true,
      jobRunId,
      queueName: result.run.queueName,
      queueState: result.queueState,
    };
  });

  app.post("/jobs/cancel-all", async () => {
    const byQueueEntries = await Promise.all(
      queueDefinitions.map((definition) => cancelQueueJobs(definition.name))
    );

    const byQueue = Object.fromEntries(
      byQueueEntries.map((entry) => [
        entry.queueName,
        {
          waitingRemoved: entry.waitingRemoved,
          activeRemoved: entry.activeRemoved,
        },
      ])
    );

    return {
      ok: true,
      waitingRemoved: byQueueEntries.reduce((sum, entry) => sum + entry.waitingRemoved, 0),
      activeRemoved: byQueueEntries.reduce((sum, entry) => sum + entry.activeRemoved, 0),
      byQueue,
    };
  });

  // ─── Cancel all jobs in a queue ────────────────────────────────
  app.post("/jobs/queues/:queueName/cancel", async (request, reply) => {
    const { queueName } = request.params as { queueName: QueueName };

    if (!queueDefinitions.find((definition) => definition.name === queueName)) {
      reply.code(404);
      return { error: "Unknown queue" };
    }

    const result = await cancelQueueJobs(queueName);

    return {
      ok: true,
      queueName,
      waitingRemoved: result.waitingRemoved,
      activeRemoved: result.activeRemoved,
    };
  });

  // ─── Diagnostics: force-rebuild previews ──────────────────────
  app.post("/jobs/phash-backfill", async (request) => {
    const sfwOnly = readSfwOnly(request);

    const episodeRows = await db
      .select({ id: videoEpisodes.id, title: videoEpisodes.title })
      .from(videoEpisodes)
      .where(
        andEpisodeSfw(
          and(isNull(videoEpisodes.phash), not(isNull(videoEpisodes.duration)))!,
          sfwOnly,
        ),
      );
    const movieRows = await db
      .select({ id: videoMovies.id, title: videoMovies.title })
      .from(videoMovies)
      .where(
        andMovieSfw(
          and(isNull(videoMovies.phash), not(isNull(videoMovies.duration)))!,
          sfwOnly,
        ),
      );
    const targets: VideoEntityTarget[] = [
      ...episodeRows.map((r) => ({ kind: "video_episode" as const, ...r })),
      ...movieRows.map((r) => ({ kind: "video_movie" as const, ...r })),
    ];

    const trigger: QueueTrigger = {
      by: "manual",
      kind: "standard",
      label: "pHash backfill",
    };

    const createdJobIds: string[] = [];
    let skipped = 0;

    for (const target of targets) {
      const job = await enqueueQueueJob({
        queueName: "fingerprint",
        jobName: `${target.kind}-fingerprint`,
        data: {
          entityKind: target.kind,
          entityId: target.id,
          phashOnly: true,
        },
        target: {
          type: target.kind,
          id: target.id,
          label: target.title,
        },
        trigger,
      });

      if (job) createdJobIds.push(String(job.id));
      else skipped += 1;
    }

    return {
      ok: true as const,
      enqueued: createdJobIds.length,
      skipped,
      jobIds: createdJobIds,
    };
  });

  app.post("/jobs/rebuild-preview/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const sfwOnly = readSfwOnly(request);

    // The route id may be an episode or a movie — try both.
    const [episode] = await db
      .select({
        id: videoEpisodes.id,
        title: videoEpisodes.title,
        filePath: videoEpisodes.filePath,
        isNsfw: videoEpisodes.isNsfw,
      })
      .from(videoEpisodes)
      .where(eq(videoEpisodes.id, id))
      .limit(1);
    let kind: VideoEntityKind | null = episode ? "video_episode" : null;
    let row: {
      id: string;
      title: string | null;
      filePath: string | null;
      isNsfw: boolean;
    } | null = episode ?? null;
    if (!row) {
      const [movie] = await db
        .select({
          id: videoMovies.id,
          title: videoMovies.title,
          filePath: videoMovies.filePath,
          isNsfw: videoMovies.isNsfw,
        })
        .from(videoMovies)
        .where(eq(videoMovies.id, id))
        .limit(1);
      if (movie) {
        row = movie;
        kind = "video_movie";
      }
    }

    if (!row || !kind) {
      reply.code(404);
      return { error: "Video not found" };
    }

    if (sfwOnly && row.isNsfw) {
      reply.code(409);
      return { error: "Preview rebuild is not available for NSFW content in SFW mode" };
    }

    // Delete existing derivative files (dedicated cache and/or sidecar) so stale assets aren't served.
    if (row.filePath) {
      for (const file of allSceneVideoGeneratedDiskPaths(row.id, row.filePath)) {
        try {
          if (existsSync(file)) unlinkSync(file);
        } catch {
          // ignore — file may already be gone
        }
      }
    }

    const clearSet = {
      thumbnailPath: null as null,
      cardThumbnailPath: null as null,
      previewPath: null as null,
      spritePath: null as null,
      trickplayVttPath: null as null,
      updatedAt: new Date(),
    };
    if (kind === "video_episode") {
      await db.update(videoEpisodes).set(clearSet).where(eq(videoEpisodes.id, id));
    } else {
      await db.update(videoMovies).set(clearSet).where(eq(videoMovies.id, id));
    }

    const payload = withTriggerMetadata(
      { entityKind: kind, entityId: id },
      {
        by: "manual",
        kind: "force-rebuild",
        label: "Force rebuild preview from Operations",
      },
    );
    const jobId = await sendJob("preview", payload);

    await recordQueuedJob({
      queueName: "preview",
      bullmqJobId: jobId,
      targetType: kind,
      targetId: row.id,
      targetLabel: row.title,
      payload,
    });

    return { ok: true, jobId };
  });

  app.post("/jobs/rebuild-previews", async (request) => {
    const sfwOnly = readSfwOnly(request);
    const clearSet = {
      thumbnailPath: null as null,
      cardThumbnailPath: null as null,
      previewPath: null as null,
      spritePath: null as null,
      trickplayVttPath: null as null,
      updatedAt: new Date(),
    };

    if (sfwOnly) {
      await db
        .update(videoEpisodes)
        .set(clearSet)
        .where(ne(videoEpisodes.isNsfw, true));
      await db
        .update(videoMovies)
        .set(clearSet)
        .where(ne(videoMovies.isNsfw, true));
    } else {
      await db.update(videoEpisodes).set(clearSet);
      await db.update(videoMovies).set(clearSet);
    }

    const result = await enqueueMissingVideoJobs(
      "preview",
      {
        by: "manual",
        kind: "force-rebuild",
        label: "Force rebuild previews from Operations",
      },
      sfwOnly,
    );

    return {
      ok: true,
      enqueued: result.jobIds.length,
      skipped: result.skipped,
      jobIds: result.jobIds,
    };
  });

  app.post("/jobs/migrate-scene-asset-storage", async (request, reply) => {
    const body = (request.body ?? {}) as { targetDedicated?: unknown };
    if (typeof body.targetDedicated !== "boolean") {
      reply.code(400);
      return { error: "targetDedicated (boolean) is required" };
    }

    const sfwOnly = readSfwOnly(request);
    const targetLabel = sfwOnly
      ? "Relocate video generated files"
      : body.targetDedicated
        ? "Video assets to dedicated cache"
        : "Video assets beside media files";

    const job = await queueVideoAssetStorageMigration(
      body.targetDedicated,
      {
        by: "manual",
        kind: "standard",
        label: "Migrate video generated asset paths",
      },
      targetLabel,
      { sfwRedactJobLog: sfwOnly },
    );

    if (!job) {
      reply.code(409);
      return { error: "Video asset migration is already queued or running" };
    }

    return { ok: true as const, jobId: String(job.id) };
  });

  app.post("/jobs/acknowledge-failed", async (request, reply) => {
    const body = (request.body ?? {}) as { queueName?: QueueName };
    const queueName = body.queueName;

    if (
      queueName !== undefined &&
      !queueDefinitions.find((definition) => definition.name === queueName)
    ) {
      reply.code(400);
      return { error: "Unknown queue" };
    }

    // Best-effort delete from pg-boss for failed rows we're acknowledging.
    // pg-boss auto-archives failed jobs on its own retention schedule so
    // this is just a courtesy cleanup — failed counts in the UI come from
    // `jobRuns` regardless.
    const failedWhere =
      queueName !== undefined
        ? and(eq(jobRuns.status, "failed"), eq(jobRuns.queueName, queueName))
        : eq(jobRuns.status, "failed");

    const failedRows = await db
      .select({ id: jobRuns.id, externalId: jobRuns.bullmqJobId, queueName: jobRuns.queueName })
      .from(jobRuns)
      .where(failedWhere);

    const externalRemovedByQueue: Record<string, number> = {};
    for (const row of failedRows) {
      await deleteJob(row.queueName as QueueName, row.externalId);
      externalRemovedByQueue[row.queueName] = (externalRemovedByQueue[row.queueName] ?? 0) + 1;
    }

    const updatedRows = await db
      .update(jobRuns)
      .set({
        status: "dismissed",
        error: null,
        updatedAt: new Date(),
      })
      .where(failedWhere)
      .returning({ id: jobRuns.id });

    return {
      ok: true,
      queueName: queueName ?? null,
      runsUpdated: updatedRows.length,
      externalRemovedByQueue,
    };
  });
}
