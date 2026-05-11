import { and, eq, inArray, isNull, like, ne, not, or, type SQL } from "drizzle-orm";
import { queueDefinitions, type QueueName } from "@obscura/contracts";
import { schema, type AppDb } from "@obscura/db";
import { pruneUntrackedLibraryReferences } from "@obscura/db/src/lib/library-prune";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "./errors";
import {
  cancelQueueJob,
  deleteQueueJob,
  enqueueQueueJob,
  type QueueTarget,
  type QueueTrigger,
} from "./queue-writes";

const {
  audioTracks,
  bookPages,
  jobRuns,
  libraryRoots,
  librarySettings,
  scrapeResults,
  videoEpisodePerformers,
  videoEpisodeTags,
  videoEpisodes,
  videoMoviePerformers,
  videoMovieTags,
  videoMovies,
  videoSeasons,
  videoSeries,
  videoSeriesPerformers,
  videoSeriesTags,
} = schema;

type VideoEntityKind = "video_episode" | "video_movie";

interface VideoEntityTarget {
  kind: VideoEntityKind;
  id: string;
  title: string | null;
}

interface QueueJobInput {
  queueName: QueueName;
  jobName: string;
  data: Record<string, unknown>;
  target: QueueTarget;
  trigger?: QueueTrigger;
}

export interface JobsWriteDeps {
  enqueueJob?: (input: QueueJobInput) => Promise<{ id: string } | null>;
  cancelJob?: (queueName: QueueName, jobId: string) => Promise<void>;
  deleteJob?: (queueName: QueueName, jobId: string) => Promise<void>;
  pruneLibraryReferences?: (db: AppDb) => Promise<void>;
}

function defaultEnqueueJob(db: AppDb) {
  return ({ queueName, data, target, trigger }: QueueJobInput) =>
    enqueueQueueJob(db, { queueName, data, target, trigger });
}

function defaultPruneLibraryReferences(db: AppDb) {
  return pruneUntrackedLibraryReferences(db);
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

function assertQueueName(queueName: string): QueueName {
  const definition = queueDefinitions.find((entry) => entry.name === queueName);
  if (!definition) {
    throw new NotFoundError("Unknown queue");
  }
  return definition.name;
}

async function ensureLibrarySettingsRow(db: AppDb) {
  const [existing] = await db.select().from(librarySettings).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(librarySettings).values({}).returning();
  return created;
}

async function queueVideoAssetStorageMigration(
  db: AppDb,
  targetDedicated: boolean,
  trigger: QueueTrigger,
  targetLabel: string,
  deps: JobsWriteDeps,
  options?: { sfwRedactJobLog?: boolean },
) {
  const enqueue = deps.enqueueJob ?? defaultEnqueueJob(db);
  return enqueue({
    queueName: "library-maintenance",
    jobName: "migrate-video-assets",
    data: {
      targetDedicated,
      ...(options?.sfwRedactJobLog ? { sfwRedactJobLog: true as const } : {}),
    },
    target: {
      type: "library",
      id: "video-asset-layout",
      label: targetLabel,
    },
    trigger,
  });
}

async function enqueueLibraryScans(
  db: AppDb,
  trigger: QueueTrigger,
  sfwOnly: boolean,
  deps: JobsWriteDeps,
) {
  await (deps.pruneLibraryReferences ?? defaultPruneLibraryReferences)(db);

  const roots = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.enabled, true))
    .orderBy(libraryRoots.path);

  const enqueue = deps.enqueueJob ?? defaultEnqueueJob(db);
  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const root of roots) {
    const job = await enqueue({
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

    if (job) createdJobIds.push(String(job.id));
    else skipped += 1;
  }

  return { jobIds: createdJobIds, skipped };
}

async function enqueueGalleryScans(
  db: AppDb,
  trigger: QueueTrigger,
  sfwOnly: boolean,
  deps: JobsWriteDeps,
) {
  const roots = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.enabled, true))
    .orderBy(libraryRoots.path);

  const enqueue = deps.enqueueJob ?? defaultEnqueueJob(db);
  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const root of roots) {
    if (!(root.scanImages ?? true)) {
      skipped += 1;
      continue;
    }

    const job = await enqueue({
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

    if (job) createdJobIds.push(String(job.id));
    else skipped += 1;
  }

  return { jobIds: createdJobIds, skipped };
}

async function enqueueBookScans(
  db: AppDb,
  trigger: QueueTrigger,
  sfwOnly: boolean,
  deps: JobsWriteDeps,
) {
  const roots = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.enabled, true))
    .orderBy(libraryRoots.path);

  const enqueue = deps.enqueueJob ?? defaultEnqueueJob(db);
  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const root of roots) {
    if (!root.scanBooks) {
      skipped += 1;
      continue;
    }

    const job = await enqueue({
      queueName: "book-scan",
      jobName: "book-root-scan",
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

    if (job) createdJobIds.push(String(job.id));
    else skipped += 1;
  }

  return { jobIds: createdJobIds, skipped };
}

async function enqueueAudioScans(
  db: AppDb,
  trigger: QueueTrigger,
  sfwOnly: boolean,
  deps: JobsWriteDeps,
) {
  const roots = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.enabled, true))
    .orderBy(libraryRoots.path);

  const enqueue = deps.enqueueJob ?? defaultEnqueueJob(db);
  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const root of roots) {
    if (!(root.scanAudio ?? true)) {
      skipped += 1;
      continue;
    }

    const job = await enqueue({
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

    if (job) createdJobIds.push(String(job.id));
    else skipped += 1;
  }

  return { jobIds: createdJobIds, skipped };
}

async function enqueueMissingAudioTrackJobs(
  db: AppDb,
  queueName: Extract<QueueName, "audio-probe" | "audio-fingerprint" | "audio-waveform">,
  trigger: QueueTrigger,
  deps: JobsWriteDeps,
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
  } else {
    trackRows = await db
      .select({ id: audioTracks.id, title: audioTracks.title })
      .from(audioTracks)
      .where(isNull(audioTracks.waveformPath));
  }

  const enqueue = deps.enqueueJob ?? defaultEnqueueJob(db);
  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const track of trackRows) {
    const job = await enqueue({
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

    if (job) createdJobIds.push(String(job.id));
    else skipped += 1;
  }

  return { jobIds: createdJobIds, skipped };
}

async function enqueueMissingBookPageJobs(
  db: AppDb,
  trigger: QueueTrigger,
  deps: JobsWriteDeps,
) {
  const rows = await db
    .select({ id: bookPages.id, title: bookPages.title })
    .from(bookPages)
    .where(isNull(bookPages.thumbnailPath));

  const enqueue = deps.enqueueJob ?? defaultEnqueueJob(db);
  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const row of rows) {
    const job = await enqueue({
      queueName: "book-page-thumbnail",
      jobName: "book-page-thumbnail",
      data: { pageId: row.id },
      target: {
        type: "book-page",
        id: row.id,
        label: row.title,
      },
      trigger,
    });

    if (job) createdJobIds.push(String(job.id));
    else skipped += 1;
  }

  return { jobIds: createdJobIds, skipped };
}

async function collectMissingVideoTargets(
  db: AppDb,
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
    for (const row of episodeRows) {
      targets.push({ kind: "video_episode", ...row });
    }

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
    for (const row of movieRows) {
      targets.push({ kind: "video_movie", ...row });
    }
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
    for (const row of episodeRows) {
      targets.push({ kind: "video_episode", ...row });
    }

    const movieRows = await db
      .select({ id: videoMovies.id, title: videoMovies.title })
      .from(videoMovies)
      .where(
        andMovieSfw(
          or(isNull(videoMovies.checksumMd5), isNull(videoMovies.oshash))!,
          sfwOnly,
        ),
      );
    for (const row of movieRows) {
      targets.push({ kind: "video_movie", ...row });
    }
  } else if (queueName === "preview") {
    const settings = await ensureLibrarySettingsRow(db);
    const previewMissing = (kind: "episode" | "movie") => {
      const table = kind === "episode" ? videoEpisodes : videoMovies;
      const previewAssetsMissing = or(
        isNull(table.previewPath),
        and(
          or(
            isNull(table.thumbnailPath),
            not(like(table.thumbnailPath, "%thumb-custom%")),
          ),
          or(isNull(table.thumbnailPath), isNull(table.cardThumbnailPath)),
        ),
      );
      const trickplayAssetsMissing = or(
        isNull(table.spritePath),
        isNull(table.trickplayVttPath),
      );

      if (settings.autoGeneratePreview && settings.generateTrickplay) {
        return or(previewAssetsMissing, trickplayAssetsMissing)!;
      }
      if (settings.autoGeneratePreview) {
        return previewAssetsMissing!;
      }
      if (settings.generateTrickplay) {
        return trickplayAssetsMissing!;
      }
      return undefined;
    };

    const episodeFilter = previewMissing("episode");
    if (episodeFilter) {
      const episodeRows = await db
        .select({ id: videoEpisodes.id, title: videoEpisodes.title })
        .from(videoEpisodes)
        .where(andEpisodeSfw(episodeFilter, sfwOnly));
      for (const row of episodeRows) {
        targets.push({ kind: "video_episode", ...row });
      }
    }

    const movieFilter = previewMissing("movie");
    if (movieFilter) {
      const movieRows = await db
        .select({ id: videoMovies.id, title: videoMovies.title })
        .from(videoMovies)
        .where(andMovieSfw(movieFilter, sfwOnly));
      for (const row of movieRows) {
        targets.push({ kind: "video_movie", ...row });
      }
    }
  } else if (queueName === "metadata-import") {
    const episodeRows = await db
      .select({ id: videoEpisodes.id, title: videoEpisodes.title })
      .from(videoEpisodes)
      .where(episodesSfwFilter(sfwOnly))
      .limit(25);
    for (const row of episodeRows) {
      targets.push({ kind: "video_episode", ...row });
    }

    const movieRows = await db
      .select({ id: videoMovies.id, title: videoMovies.title })
      .from(videoMovies)
      .where(moviesSfwFilter(sfwOnly))
      .limit(25);
    for (const row of movieRows) {
      targets.push({ kind: "video_movie", ...row });
    }
  }

  return targets;
}

async function enqueueMissingVideoJobs(
  db: AppDb,
  queueName: Extract<
    QueueName,
    "media-probe" | "fingerprint" | "preview" | "metadata-import"
  >,
  trigger: QueueTrigger,
  sfwOnly: boolean,
  deps: JobsWriteDeps,
) {
  const targets = await collectMissingVideoTargets(db, queueName, sfwOnly);
  const enqueue = deps.enqueueJob ?? defaultEnqueueJob(db);
  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const target of targets) {
    const job = await enqueue({
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

    if (job) createdJobIds.push(String(job.id));
    else skipped += 1;
  }

  return { jobIds: createdJobIds, skipped };
}

export async function runQueueWrite(
  db: AppDb,
  input: { queueName: string; sfwOnly: boolean },
  deps: JobsWriteDeps = {},
) {
  const queueName = assertQueueName(input.queueName);
  const trigger: QueueTrigger = {
    by: "manual",
    label: "Started from Operations",
  };

  let result: { jobIds: string[]; skipped: number };

  if (queueName === "library-scan") {
    result = await enqueueLibraryScans(db, trigger, input.sfwOnly, deps);
  } else if (queueName === "gallery-scan") {
    result = await enqueueGalleryScans(db, trigger, input.sfwOnly, deps);
  } else if (queueName === "book-scan") {
    result = await enqueueBookScans(db, trigger, input.sfwOnly, deps);
  } else if (queueName === "audio-scan") {
    result = await enqueueAudioScans(db, trigger, input.sfwOnly, deps);
  } else if (queueName === "book-page-thumbnail") {
    result = await enqueueMissingBookPageJobs(db, trigger, deps);
  } else if (
    queueName === "audio-probe" ||
    queueName === "audio-fingerprint" ||
    queueName === "audio-waveform"
  ) {
    result = await enqueueMissingAudioTrackJobs(db, queueName, trigger, deps);
  } else if (queueName === "library-maintenance") {
    const settings = await ensureLibrarySettingsRow(db);
    const targetDedicated = settings.metadataStorageDedicated ?? true;
    const targetLabel = input.sfwOnly
      ? "Relocate video generated files"
      : targetDedicated
        ? "Video assets to dedicated cache"
        : "Video assets beside media files";
    const job = await queueVideoAssetStorageMigration(
      db,
      targetDedicated,
      trigger,
      targetLabel,
      deps,
      { sfwRedactJobLog: input.sfwOnly },
    );
    result = {
      jobIds: job ? [String(job.id)] : [],
      skipped: job ? 0 : 1,
    };
  } else {
    result = await enqueueMissingVideoJobs(
      db,
      queueName as Extract<
        QueueName,
        "media-probe" | "fingerprint" | "preview" | "metadata-import"
      >,
      trigger,
      input.sfwOnly,
      deps,
    );
  }

  return {
    ok: true as const,
    queueName,
    enqueued: result.jobIds.length,
    skipped: result.skipped,
    jobIds: result.jobIds,
  };
}

export async function cancelJobRunWrite(
  db: AppDb,
  input: { jobRunId: string },
  deps: JobsWriteDeps = {},
) {
  const [run] = await db
    .select()
    .from(jobRuns)
    .where(eq(jobRuns.id, input.jobRunId))
    .limit(1);

  if (!run) {
    throw new NotFoundError("Job run not found");
  }

  if (!["waiting", "active", "delayed"].includes(run.status)) {
    throw new ConflictError(`Job is already ${run.status}`);
  }

  const cancel = deps.cancelJob ?? cancelQueueJob;
  const queueState = run.status;
  await cancel(run.queueName as QueueName, run.bullmqJobId);

  await db
    .update(jobRuns)
    .set({
      status: "dismissed",
      error: "Cancelled by user",
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobRuns.id, run.id));

  return {
    ok: true as const,
    jobRunId: input.jobRunId,
    queueName: run.queueName,
    queueState,
  };
}

export async function cancelQueueWrite(
  db: AppDb,
  input: { queueName: string },
  deps: JobsWriteDeps = {},
) {
  const queueName = assertQueueName(input.queueName);
  const pending = await db
    .select({ externalId: jobRuns.bullmqJobId, status: jobRuns.status })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.queueName, queueName),
        inArray(jobRuns.status, ["waiting", "active", "delayed"]),
      ),
    );

  const cancel = deps.cancelJob ?? cancelQueueJob;
  let waitingRemoved = 0;
  let activeRemoved = 0;

  for (const row of pending) {
    await cancel(queueName, row.externalId);
    if (row.status === "active") activeRemoved += 1;
    else waitingRemoved += 1;
  }

  await db
    .update(jobRuns)
    .set({
      status: "dismissed",
      error: "Cancelled by user",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobRuns.queueName, queueName),
        inArray(jobRuns.status, ["waiting", "active", "delayed"]),
      ),
    );

  return {
    ok: true as const,
    queueName,
    waitingRemoved,
    activeRemoved,
  };
}

export async function cancelAllJobsWrite(
  db: AppDb,
  deps: JobsWriteDeps = {},
) {
  const byQueueEntries = await Promise.all(
    queueDefinitions.map((definition) =>
      cancelQueueWrite(db, { queueName: definition.name }, deps),
    ),
  );

  const byQueue = Object.fromEntries(
    byQueueEntries.map((entry) => [
      entry.queueName,
      {
        waitingRemoved: entry.waitingRemoved,
        activeRemoved: entry.activeRemoved,
      },
    ]),
  );

  return {
    ok: true as const,
    waitingRemoved: byQueueEntries.reduce(
      (sum, entry) => sum + entry.waitingRemoved,
      0,
    ),
    activeRemoved: byQueueEntries.reduce(
      (sum, entry) => sum + entry.activeRemoved,
      0,
    ),
    byQueue,
  };
}

export async function backfillPhashesWrite(
  db: AppDb,
  input: { sfwOnly: boolean },
  deps: JobsWriteDeps = {},
) {
  const episodeRows = await db
    .select({ id: videoEpisodes.id, title: videoEpisodes.title })
    .from(videoEpisodes)
    .where(
      andEpisodeSfw(
        and(isNull(videoEpisodes.phash), not(isNull(videoEpisodes.duration)))!,
        input.sfwOnly,
      ),
    );
  const movieRows = await db
    .select({ id: videoMovies.id, title: videoMovies.title })
    .from(videoMovies)
    .where(
      andMovieSfw(
        and(isNull(videoMovies.phash), not(isNull(videoMovies.duration)))!,
        input.sfwOnly,
      ),
    );

  const targets: VideoEntityTarget[] = [
    ...episodeRows.map((row) => ({ kind: "video_episode" as const, ...row })),
    ...movieRows.map((row) => ({ kind: "video_movie" as const, ...row })),
  ];
  const enqueue = deps.enqueueJob ?? defaultEnqueueJob(db);
  const trigger: QueueTrigger = {
    by: "manual",
    kind: "standard",
    label: "pHash backfill",
  };
  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const target of targets) {
    const job = await enqueue({
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
}

export async function rebuildPreviewsWrite(
  db: AppDb,
  input: { sfwOnly: boolean },
  deps: JobsWriteDeps = {},
) {
  const clearSet = {
    thumbnailPath: null as null,
    cardThumbnailPath: null as null,
    previewPath: null as null,
    spritePath: null as null,
    trickplayVttPath: null as null,
    updatedAt: new Date(),
  };

  if (input.sfwOnly) {
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
    db,
    "preview",
    {
      by: "manual",
      kind: "force-rebuild",
      label: "Force rebuild previews from Operations",
    },
    input.sfwOnly,
    deps,
  );

  return {
    ok: true as const,
    enqueued: result.jobIds.length,
    skipped: result.skipped,
    jobIds: result.jobIds,
  };
}

export async function migrateVideoAssetStorageWrite(
  db: AppDb,
  input: { targetDedicated: boolean; sfwOnly: boolean },
  deps: JobsWriteDeps = {},
) {
  if (typeof input.targetDedicated !== "boolean") {
    throw new ValidationError("targetDedicated (boolean) is required");
  }

  const targetLabel = input.sfwOnly
    ? "Relocate video generated files"
    : input.targetDedicated
      ? "Video assets to dedicated cache"
      : "Video assets beside media files";

  const job = await queueVideoAssetStorageMigration(
    db,
    input.targetDedicated,
    {
      by: "manual",
      kind: "standard",
      label: "Migrate video generated asset paths",
    },
    targetLabel,
    deps,
    { sfwRedactJobLog: input.sfwOnly },
  );

  if (!job) {
    throw new ConflictError("Video asset migration is already queued or running");
  }

  return { ok: true as const, jobId: String(job.id) };
}

export async function acknowledgeFailedJobsWrite(
  db: AppDb,
  input: { queueName?: string },
  deps: JobsWriteDeps = {},
) {
  const queueName =
    input.queueName === undefined ? undefined : assertQueueName(input.queueName);
  const failedWhere =
    queueName !== undefined
      ? and(eq(jobRuns.status, "failed"), eq(jobRuns.queueName, queueName))
      : eq(jobRuns.status, "failed");

  const failedRows = await db
    .select({ externalId: jobRuns.bullmqJobId, queueName: jobRuns.queueName })
    .from(jobRuns)
    .where(failedWhere);

  const remove = deps.deleteJob ?? deleteQueueJob;
  const externalRemovedByQueue: Record<string, number> = {};
  for (const row of failedRows) {
    await remove(row.queueName as QueueName, row.externalId);
    externalRemovedByQueue[row.queueName] =
      (externalRemovedByQueue[row.queueName] ?? 0) + 1;
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
    ok: true as const,
    queueName: queueName ?? null,
    runsUpdated: updatedRows.length,
    externalRemovedByQueue,
  };
}

export async function clearMetadataWrite(
  db: AppDb,
  deps: JobsWriteDeps = {},
) {
  const now = new Date();

  await db.delete(videoEpisodePerformers);
  await db.delete(videoEpisodeTags);
  await db.delete(videoMoviePerformers);
  await db.delete(videoMovieTags);
  await db.delete(videoSeriesPerformers);
  await db.delete(videoSeriesTags);
  await db.delete(scrapeResults);

  const episodeClear = await db
    .update(videoEpisodes)
    .set({
      title: null,
      overview: null,
      airDate: null,
      runtime: null,
      stillPath: null,
      url: null,
      externalIds: {},
      rating: null,
      organized: false,
      updatedAt: now,
    })
    .returning({ id: videoEpisodes.id });

  const movieClear = await db
    .update(videoMovies)
    .set({
      sortTitle: null,
      originalTitle: null,
      overview: null,
      tagline: null,
      releaseDate: null,
      runtime: null,
      posterPath: null,
      backdropPath: null,
      logoPath: null,
      url: null,
      studioId: null,
      rating: null,
      contentRating: null,
      organized: false,
      externalIds: {},
      updatedAt: now,
    })
    .returning({ id: videoMovies.id });

  const seriesClear = await db
    .update(videoSeries)
    .set({
      sortTitle: null,
      originalTitle: null,
      overview: null,
      tagline: null,
      status: null,
      firstAirDate: null,
      endAirDate: null,
      posterPath: null,
      backdropPath: null,
      logoPath: null,
      studioId: null,
      rating: null,
      contentRating: null,
      organized: false,
      externalIds: {},
      updatedAt: now,
    })
    .returning({ id: videoSeries.id });

  await db.update(videoSeasons).set({
    title: null,
    overview: null,
    posterPath: null,
    airDate: null,
    externalIds: {},
    updatedAt: now,
  });

  const scanResult = await enqueueLibraryScans(
    db,
    {
      by: "manual",
      kind: "standard",
      label: "Rescan after Clear Metadata",
    },
    false,
    deps,
  );

  return {
    ok: true as const,
    episodesCleared: episodeClear.length,
    moviesCleared: movieClear.length,
    seriesCleared: seriesClear.length,
    librariesQueued: scanResult.jobIds.length,
    librariesSkipped: scanResult.skipped,
  };
}
