import { existsSync, unlinkSync } from "node:fs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, asc, desc, eq, inArray, isNull, like, ne, not, or, sql, type SQL } from "drizzle-orm";
import {
  queueDefinitions,
  type JobKind,
  type JobTriggerKind,
  type QueueName,
} from "@obscura/contracts";
import { getSidecarPaths } from "@obscura/media-core";
import { db, schema } from "../db";
import { ensureLibrarySettingsRow } from "../lib/library";
import { getQueue } from "../lib/queues";

const { jobRuns, libraryRoots, scenes } = schema;

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

function scenesSfwFilter(sfwOnly: boolean): SQL | undefined {
  return sfwOnly ? ne(scenes.isNsfw, true) : undefined;
}

function andSceneSfw(base: SQL, sfwOnly: boolean): SQL {
  const sfw = scenesSfwFilter(sfwOnly);
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

  const queue = getQueue(input.queueName);
  const payload = withTriggerMetadata(input.data, input.trigger);
  const job = await queue.add(input.jobName, payload);

  await recordQueuedJob({
    queueName: input.queueName,
    bullmqJobId: String(job.id),
    targetType: input.target.type ?? null,
    targetId: input.target.id ?? null,
    targetLabel: input.target.label ?? null,
    payload,
  });

  return job;
}

async function enqueueLibraryScans(trigger: QueueTrigger = {}, sfwOnly = false) {
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

async function enqueueMissingSceneJobs(
  queueName: QueueName,
  trigger: QueueTrigger = {},
  sfwOnly = false
) {
  let sceneRows: Array<{ id: string; title: string }> = [];

  if (queueName === "media-probe") {
    sceneRows = await db
      .select({ id: scenes.id, title: scenes.title })
      .from(scenes)
      .where(
        andSceneSfw(or(isNull(scenes.duration), isNull(scenes.width), isNull(scenes.codec))!, sfwOnly)
      );
  } else if (queueName === "fingerprint") {
    sceneRows = await db
      .select({ id: scenes.id, title: scenes.title })
      .from(scenes)
      .where(andSceneSfw(or(isNull(scenes.checksumMd5), isNull(scenes.oshash))!, sfwOnly));
  } else if (queueName === "preview") {
    sceneRows = await db
      .select({ id: scenes.id, title: scenes.title })
      .from(scenes)
      .where(
        andSceneSfw(
          or(
            isNull(scenes.previewPath),
            isNull(scenes.spritePath),
            isNull(scenes.trickplayVttPath),
            and(
              or(isNull(scenes.thumbnailPath), not(like(scenes.thumbnailPath, "%thumb-custom%"))),
              or(isNull(scenes.thumbnailPath), isNull(scenes.cardThumbnailPath))
            )
          )!,
          sfwOnly
        )
      );
  } else if (queueName === "metadata-import") {
    const sfw = scenesSfwFilter(sfwOnly);
    sceneRows = sfw
      ? await db
          .select({ id: scenes.id, title: scenes.title })
          .from(scenes)
          .where(sfw)
          .limit(25)
      : await db.select({ id: scenes.id, title: scenes.title }).from(scenes).limit(25);
  }

  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const scene of sceneRows) {
    const job = await enqueueQueueJob({
      queueName,
      jobName: `scene-${queueName}`,
      data: { sceneId: scene.id },
      target: {
        type: "scene",
        id: scene.id,
        label: scene.title,
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
  const queue = getQueue(queueName);
  const redisJob = await queue.getJob(run.bullmqJobId);
  const redisState = redisJob ? await redisJob.getState() : null;

  if (redisJob) {
    if (redisState === "waiting" || redisState === "delayed") {
      await redisJob.remove();
    } else if (redisState === "active") {
      await redisJob.moveToFailed(new Error(reason), "0", true);
      await queue.clean(0, 1_000, "failed");
    }
  }

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
    redisState,
  };
}

async function cancelQueueJobs(queueName: QueueName, reason = "Cancelled by user") {
  const queue = getQueue(queueName);

  const waitingJobs = await queue.getWaiting();
  const delayedJobs = await queue.getDelayed();
  let waitingRemoved = 0;
  for (const job of [...waitingJobs, ...delayedJobs]) {
    try {
      await job.remove();
      waitingRemoved += 1;
    } catch {
      // Job may have moved on before removal.
    }
  }

  const activeJobs = await queue.getActive();
  let activeRemoved = 0;
  for (const job of activeJobs) {
    try {
      await job.moveToFailed(new Error(reason), "0", true);
      activeRemoved += 1;
    } catch {
      // Job may have already completed
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

  await queue.clean(0, 100_000, "failed");

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

    const queues = await Promise.all(
      queueDefinitions.map(async (definition) => {
        const queue = getQueue(definition.name);
        const counts = await queue.getJobCounts("active", "waiting", "delayed");
        const [failedRow] = await db
          .select({ total: sql<number>`count(*)::int` })
          .from(jobRuns)
          .where(and(eq(jobRuns.queueName, definition.name), eq(jobRuns.status, "failed")));
        const [completedRow] = await db
          .select({ total: sql<number>`count(*)::int` })
          .from(jobRuns)
          .where(and(eq(jobRuns.queueName, definition.name), eq(jobRuns.status, "completed")));
        const failed = failedRow?.total ?? 0;
        const waiting = counts.waiting ?? 0;
        const delayed = counts.delayed ?? 0;
        const active = counts.active ?? 0;
        const status =
          failed > 0 ? "warning" : active > 0 || waiting > 0 || delayed > 0 ? "active" : "idle";

        return {
          name: definition.name,
          label: definition.label,
          description: definition.description,
          status,
          concurrency: definition.concurrency,
          active,
          waiting,
          delayed,
          backlog: waiting + delayed,
          completed: completedRow?.total ?? 0,
          failed,
        };
      })
    );

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

    const result =
      queueName === "library-scan"
        ? await enqueueLibraryScans(
            {
              by: "manual",
              label: "Started from Operations",
            },
            sfwOnly
          )
        : await enqueueMissingSceneJobs(
            queueName,
            {
              by: "manual",
              label: "Started from Operations",
            },
            sfwOnly
          );

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
      redisState: result.redisState,
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
  app.post("/jobs/rebuild-preview/:sceneId", async (request, reply) => {
    const { sceneId } = request.params as { sceneId: string };
    const sfwOnly = readSfwOnly(request);
    const scene = await db.query.scenes.findFirst({
      where: eq(scenes.id, sceneId),
      columns: { id: true, title: true, filePath: true, isNsfw: true },
    });

    if (!scene) {
      reply.code(404);
      return { error: "Scene not found" };
    }

    if (sfwOnly && scene.isNsfw) {
      reply.code(409);
      return { error: "Preview rebuild is not available for NSFW content in SFW mode" };
    }

    // Delete existing sidecar files so stale assets aren't served
    if (scene.filePath) {
      const sidecar = getSidecarPaths(scene.filePath);
      for (const file of Object.values(sidecar)) {
        try {
          if (existsSync(file)) unlinkSync(file);
        } catch {
          // ignore — file may already be gone
        }
      }
    }

    await db
      .update(scenes)
      .set({
        thumbnailPath: null,
        cardThumbnailPath: null,
        previewPath: null,
        spritePath: null,
        trickplayVttPath: null,
        updatedAt: new Date(),
      })
      .where(eq(scenes.id, sceneId));

    const queue = getQueue("preview");
    const payload = withTriggerMetadata(
      { sceneId },
      {
        by: "manual",
        kind: "force-rebuild",
        label: "Force rebuild preview from Operations",
      }
    );
    const job = await queue.add("scene-preview", payload);

    await recordQueuedJob({
      queueName: "preview",
      bullmqJobId: String(job.id),
      targetType: "scene",
      targetId: scene.id,
      targetLabel: scene.title,
      payload,
    });

    return { ok: true, jobId: String(job.id) };
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
      await db.update(scenes).set(clearSet).where(ne(scenes.isNsfw, true));
    } else {
      await db.update(scenes).set(clearSet);
    }

    const result = await enqueueMissingSceneJobs(
      "preview",
      {
        by: "manual",
        kind: "force-rebuild",
        label: "Force rebuild previews from Operations",
      },
      sfwOnly
    );

    return {
      ok: true,
      enqueued: result.jobIds.length,
      skipped: result.skipped,
      jobIds: result.jobIds,
    };
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

    const targetQueues = queueName
      ? [queueName]
      : (queueDefinitions.map((definition) => definition.name) as QueueName[]);

    const redisRemovedByQueue: Record<string, number> = {};
    let redisRemovedTotal = 0;

    for (const name of targetQueues) {
      const queue = getQueue(name);
      const removedIds = await queue.clean(0, 100_000, "failed");
      redisRemovedByQueue[name] = removedIds.length;
      redisRemovedTotal += removedIds.length;
    }

    const whereClause =
      queueName !== undefined
        ? and(eq(jobRuns.status, "failed"), eq(jobRuns.queueName, queueName))
        : eq(jobRuns.status, "failed");

    const updatedRows = await db
      .update(jobRuns)
      .set({
        status: "dismissed",
        error: null,
        updatedAt: new Date(),
      })
      .where(whereClause)
      .returning({ id: jobRuns.id });

    return {
      ok: true,
      queueName: queueName ?? null,
      redisRemoved: redisRemovedTotal,
      redisRemovedByQueue,
      runsUpdated: updatedRows.length,
    };
  });
}
