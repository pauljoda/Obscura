import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import postgres from "postgres";
import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  type JobKind,
  jobRunRetention,
  queueDefinitions,
  queueRedisRetention,
  type JobTriggerKind,
  type QueueName,
} from "@obscura/contracts";
import {
  computeMd5,
  computeOsHash,
  discoverVideoFiles,
  discoverImageFilesAndDirs,
  extractZipMember,
  fileNameToTitle,
  getGeneratedSceneDir,
  getGeneratedImageDir,
  getSidecarPaths,
  parseZipImageMembers,
  probeVideoFile,
  probeImageFile,
  normalizeNfoRating,
  readNfo,
  runProcess,
} from "@obscura/media-core";
import * as schema from "../../api/src/db/schema";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://obscura:obscura@localhost:5432/obscura";

const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const queryClient = postgres(databaseUrl);
const db = drizzle(queryClient, { schema });

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

const {
  scenes,
  libraryRoots,
  librarySettings,
  jobRuns,
  galleries,
  images,
  galleryChapters,
  galleryPerformers,
  galleryTags,
  imagePerformers,
  imageTags,
  performers,
  tags,
  studios,
  scenePerformers,
  sceneTags,
} = schema;

function sceneAssetUrl(sceneId: string, fileName: string) {
  return `/assets/scenes/${sceneId}/${fileName}`;
}

// ─── NSFW Propagation ────────────────────────────────────────────────
// Computes whether a scene should be marked NSFW based on its library root
// flag plus any related entities (tags, performers, studio).
async function propagateSceneNsfw(sceneId: string, libraryRootIsNsfw: boolean) {
  if (libraryRootIsNsfw) {
    await db.update(scenes).set({ isNsfw: true }).where(eq(scenes.id, sceneId));
    return;
  }

  // Check related tags
  const nsfwTag = await db
    .select({ id: tags.id })
    .from(sceneTags)
    .innerJoin(tags, eq(sceneTags.tagId, tags.id))
    .where(and(eq(sceneTags.sceneId, sceneId), eq(tags.isNsfw, true)))
    .limit(1);

  if (nsfwTag.length > 0) {
    await db.update(scenes).set({ isNsfw: true }).where(eq(scenes.id, sceneId));
    return;
  }

  // Check related performers
  const nsfwPerformer = await db
    .select({ id: performers.id })
    .from(scenePerformers)
    .innerJoin(performers, eq(scenePerformers.performerId, performers.id))
    .where(and(eq(scenePerformers.sceneId, sceneId), eq(performers.isNsfw, true)))
    .limit(1);

  if (nsfwPerformer.length > 0) {
    await db.update(scenes).set({ isNsfw: true }).where(eq(scenes.id, sceneId));
    return;
  }

  // Check studio
  const [sceneRow] = await db
    .select({ studioId: scenes.studioId })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .limit(1);

  if (sceneRow?.studioId) {
    const [studio] = await db
      .select({ isNsfw: studios.isNsfw })
      .from(studios)
      .where(eq(studios.id, sceneRow.studioId))
      .limit(1);

    if (studio?.isNsfw) {
      await db.update(scenes).set({ isNsfw: true }).where(eq(scenes.id, sceneId));
      return;
    }
  }

  // No NSFW signals found — clear stale flag if it was set by a previous
  // propagation. This ensures removed NSFW tags/performers/studios are
  // reflected after a rescan.
  await db.update(scenes).set({ isNsfw: false }).where(eq(scenes.id, sceneId));
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

function getRootScopedPath(filePath: string) {
  return filePath.includes("::") ? (filePath.split("::")[0] ?? filePath) : filePath;
}

function isPathWithinRoot(filePath: string, rootPath: string) {
  const candidate = path.resolve(getRootScopedPath(filePath));
  const root = path.resolve(rootPath);
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function isPathWithinAnyRoot(filePath: string, rootPaths: string[]) {
  return rootPaths.some((rootPath) => isPathWithinRoot(filePath, rootPath));
}

async function removeGeneratedSceneDirs(sceneIds: string[]) {
  for (const sceneId of sceneIds) {
    await rm(getGeneratedSceneDir(sceneId), { recursive: true, force: true });
  }
}

async function removeGeneratedImageDirs(imageIds: string[]) {
  for (const imageId of imageIds) {
    await rm(getGeneratedImageDir(imageId), { recursive: true, force: true });
  }
}

async function pruneUntrackedLibraryReferences() {
  const allRoots = await db
    .select({
      path: libraryRoots.path,
      scanVideos: libraryRoots.scanVideos,
      scanImages: libraryRoots.scanImages,
    })
    .from(libraryRoots)
    .where(eq(libraryRoots.enabled, true));

  const videoRootPaths = allRoots.filter((r) => r.scanVideos).map((r) => r.path);
  const imageRootPaths = allRoots.filter((r) => r.scanImages).map((r) => r.path);

  const allKnownScenes = await db
    .select({
      id: scenes.id,
      filePath: scenes.filePath,
    })
    .from(scenes);

  const missingSceneIds = allKnownScenes
    .filter((scene) => scene.filePath && !existsSync(scene.filePath))
    .map((scene) => scene.id);

  if (missingSceneIds.length > 0) {
    await removeGeneratedSceneDirs(missingSceneIds);
    await db.delete(scenes).where(inArray(scenes.id, missingSceneIds));
  }

  const orphanedSceneIds = allKnownScenes
    .filter((scene) => {
      if (!scene.filePath) return false;
      if (missingSceneIds.includes(scene.id)) return false;
      return !isPathWithinAnyRoot(scene.filePath, videoRootPaths);
    })
    .map((scene) => scene.id);

  if (orphanedSceneIds.length > 0) {
    await removeGeneratedSceneDirs(orphanedSceneIds);
    await db.delete(scenes).where(inArray(scenes.id, orphanedSceneIds));
  }

  const allKnownImages = await db
    .select({
      id: images.id,
      filePath: images.filePath,
    })
    .from(images);

  const orphanedImageIds = allKnownImages
    .filter((image) => !isPathWithinAnyRoot(image.filePath, imageRootPaths))
    .map((image) => image.id);

  if (orphanedImageIds.length > 0) {
    await removeGeneratedImageDirs(orphanedImageIds);
    await db.delete(images).where(inArray(images.id, orphanedImageIds));
  }

  const allKnownGalleries = await db
    .select({
      id: galleries.id,
      folderPath: galleries.folderPath,
      zipFilePath: galleries.zipFilePath,
    })
    .from(galleries);

  const orphanedGalleryIds = allKnownGalleries
    .filter((gallery) => {
      const backingPath = gallery.folderPath ?? gallery.zipFilePath;
      if (!backingPath) return false;
      return !isPathWithinAnyRoot(backingPath, imageRootPaths);
    })
    .map((gallery) => gallery.id);

  if (orphanedGalleryIds.length > 0) {
    await db
      .update(galleries)
      .set({ parentId: null, updatedAt: new Date() })
      .where(inArray(galleries.parentId, orphanedGalleryIds));

    await db.delete(galleries).where(inArray(galleries.id, orphanedGalleryIds));
  }
}

function formatJobError(error: unknown) {
  if (error instanceof Error) {
    if (error.stack && error.stack !== error.message) {
      return `${error.message}\n${error.stack}`.slice(0, 4000);
    }

    return error.message;
  }

  return typeof error === "string" ? error : "Unknown error";
}

const workerQueues = Object.fromEntries(
  queueDefinitions.map((definition) => [
    definition.name,
    new Queue(definition.name, {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: queueRedisRetention.completed,
        removeOnFail: queueRedisRetention.failed,
      },
    }),
  ])
) as Record<QueueName, Queue>;

function getWorkerQueue(queueName: QueueName) {
  return workerQueues[queueName];
}

async function ensureLibrarySettingsRow() {
  const [existing] = await db.select().from(librarySettings).limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db.insert(librarySettings).values({}).returning();
  return created;
}

async function upsertJobRun(
  job: Job,
  queueName: QueueName,
  patch: Partial<typeof jobRuns.$inferInsert>
) {
  const payload = (patch.payload ?? (job.data as JobPayload) ?? {}) as JobPayload;

  await db
    .insert(jobRuns)
    .values({
      bullmqJobId: String(job.id),
      queueName,
      status: patch.status ?? "waiting",
      attempts: patch.attempts ?? job.attemptsMade,
      progress: patch.progress ?? 0,
      targetType: patch.targetType ?? null,
      targetId: patch.targetId ?? null,
      targetLabel: patch.targetLabel ?? null,
      payload,
      error: patch.error ?? null,
      startedAt: patch.startedAt ?? null,
      finishedAt: patch.finishedAt ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: jobRuns.bullmqJobId,
      set: {
        status: patch.status ?? "waiting",
        attempts: patch.attempts ?? job.attemptsMade,
        progress: patch.progress ?? 0,
        targetType: patch.targetType ?? null,
        targetId: patch.targetId ?? null,
        targetLabel: patch.targetLabel ?? null,
        payload,
        error: patch.error ?? null,
        startedAt: patch.startedAt ?? undefined,
        finishedAt: patch.finishedAt ?? undefined,
        updatedAt: new Date(),
      },
    });
}

async function markJobActive(
  job: Job,
  queueName: QueueName,
  target: { type?: string; id?: string; label?: string } = {}
) {
  await upsertJobRun(job, queueName, {
    status: "active",
    targetType: target.type ?? null,
    targetId: target.id ?? null,
    targetLabel: target.label ?? null,
    attempts: job.attemptsMade,
    startedAt: new Date(),
  });
}

async function markJobProgress(job: Job, queueName: QueueName, progress: number) {
  await job.updateProgress(progress);
  await upsertJobRun(job, queueName, {
    status: "active",
    progress,
    attempts: job.attemptsMade,
  });
}

async function markJobCompleted(job: Job, queueName: QueueName) {
  await upsertJobRun(job, queueName, {
    status: "completed",
    progress: 100,
    attempts: job.attemptsMade,
    finishedAt: new Date(),
  });
}

async function markJobFailed(job: Job, queueName: QueueName, error: unknown) {
  await upsertJobRun(job, queueName, {
    status: "failed",
    attempts: job.attemptsMade,
    error: formatJobError(error),
    finishedAt: new Date(),
  });
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

async function enqueueJobIfNeeded(input: {
  queueName: QueueName;
  jobName: string;
  data: Record<string, unknown>;
  target: QueueTarget;
  trigger?: QueueTrigger;
}) {
  if (await hasPendingJob(input.queueName, input.target)) {
    return null;
  }

  const queue = getWorkerQueue(input.queueName);
  const payload = withTriggerMetadata(input.data, input.trigger);
  const job = await queue.add(input.jobName, payload);

  await upsertJobRun(job, input.queueName, {
    status: "waiting",
    targetType: input.target.type ?? null,
    targetId: input.target.id ?? null,
    targetLabel: input.target.label ?? null,
    payload,
  });

  return job;
}

async function enqueuePendingSceneJob(
  queueName: QueueName,
  sceneId: string,
  trigger: QueueTrigger = {}
) {
  if (
    await hasPendingJob(queueName, {
      type: "scene",
      id: sceneId,
    })
  ) {
    return;
  }

  const [scene] = await db
    .select({ id: scenes.id, title: scenes.title })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .limit(1);

  if (!scene) {
    return;
  }

  await enqueueJobIfNeeded({
    queueName,
    jobName: `scene-${queueName}`,
    data: { sceneId },
    target: {
      type: "scene",
      id: scene.id,
      label: scene.title,
    },
    trigger,
  });
}

async function enqueuePendingImageJob(
  queueName: QueueName,
  imageId: string,
  trigger: QueueTrigger = {}
) {
  if (
    await hasPendingJob(queueName, {
      type: "image",
      id: imageId,
    })
  ) {
    return;
  }

  const [image] = await db
    .select({ id: images.id, title: images.title })
    .from(images)
    .where(eq(images.id, imageId))
    .limit(1);

  if (!image) return;

  await enqueueJobIfNeeded({
    queueName,
    jobName: `image-${queueName}`,
    data: { imageId },
    target: {
      type: "image",
      id: image.id,
      label: image.title,
    },
    trigger,
  });
}

async function enqueueLibraryRootJob(
  root: { id: string; label: string; path: string; recursive: boolean },
  trigger: QueueTrigger = {}
) {
  await enqueueJobIfNeeded({
    queueName: "library-scan",
    jobName: "library-root-scan",
    data: {
      libraryRootId: root.id,
      path: root.path,
      recursive: root.recursive,
    },
    target: {
      type: "library-root",
      id: root.id,
      label: root.label,
    },
    trigger,
  });
}

async function enqueueGalleryRootJob(
  root: { id: string; label: string },
  trigger: QueueTrigger = {},
  opts?: { sfwOnly?: boolean }
) {
  await enqueueJobIfNeeded({
    queueName: "gallery-scan",
    jobName: "gallery-root-scan",
    data: {
      libraryRootId: root.id,
      ...(opts?.sfwOnly ? { sfwOnly: true } : {}),
    },
    target: {
      type: "library-root",
      id: root.id,
      label: root.label,
    },
    trigger,
  });
}

async function pruneJobRunHistory() {
  await db.execute(sql`
    DELETE FROM job_runs
    WHERE id IN (
      SELECT id
      FROM job_runs
      WHERE status = 'completed'
      ORDER BY COALESCE(finished_at, updated_at, created_at) DESC, created_at DESC
      OFFSET ${jobRunRetention.completed}
    )
  `);

  await db.execute(sql`
    DELETE FROM job_runs
    WHERE id IN (
      SELECT id
      FROM job_runs
      WHERE status = 'dismissed'
      ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC
      OFFSET ${jobRunRetention.dismissed}
    )
  `);
}

async function processLibraryScan(job: Job) {
  const libraryRootId = String(job.data.libraryRootId);
  const [root] = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.id, libraryRootId))
    .limit(1);

  if (!root) {
    throw new Error("Library root not found");
  }

  await markJobActive(job, "library-scan", {
    type: "library-root",
    id: root.id,
    label: root.label,
  });

  await pruneUntrackedLibraryReferences();

  const settings = await ensureLibrarySettingsRow();

  // Only scan for videos if this root has video scanning enabled
  const scanVideos = root.scanVideos ?? true;
  const files = scanVideos ? await discoverVideoFiles(root.path, root.recursive) : [];
  const discoveredSet = new Set(files);

  const knownScenesInRoot = await db
    .select({
      id: scenes.id,
      filePath: scenes.filePath,
    })
    .from(scenes)
    .where(like(scenes.filePath, `${root.path}%`));

  const staleSceneIds = knownScenesInRoot
    .filter((scene) => scene.filePath && !discoveredSet.has(scene.filePath))
    .map((scene) => scene.id);

  if (staleSceneIds.length > 0) {
    await removeGeneratedSceneDirs(staleSceneIds);
    await db.delete(scenes).where(inArray(scenes.id, staleSceneIds));
  }

  const gallerySfwOpts = Boolean(job.data.sfwOnly) ? { sfwOnly: true as const } : undefined;

  if (files.length === 0) {
    await db
      .update(libraryRoots)
      .set({ lastScannedAt: new Date(), updatedAt: new Date() })
      .where(eq(libraryRoots.id, root.id));

    // Still trigger gallery scan even if no video files were found
    const scanImages = root.scanImages ?? true;
    if (scanImages) {
      await enqueueGalleryRootJob(
        root,
        {
          by: "library-scan",
          label: `Queued during ${root.label} scan`,
        },
        gallerySfwOpts
      );
    }
    return;
  }

  for (const [index, filePath] of files.entries()) {
    const [existing] = await db
      .select({
        id: scenes.id,
        duration: scenes.duration,
        width: scenes.width,
        codec: scenes.codec,
        checksumMd5: scenes.checksumMd5,
        oshash: scenes.oshash,
        thumbnailPath: scenes.thumbnailPath,
        cardThumbnailPath: scenes.cardThumbnailPath,
        previewPath: scenes.previewPath,
        spritePath: scenes.spritePath,
        trickplayVttPath: scenes.trickplayVttPath,
      })
      .from(scenes)
      .where(eq(scenes.filePath, filePath))
      .limit(1);

    let scene = existing;

    // Check for NFO sidecar metadata
    const nfo = await readNfo(filePath);

    if (!scene) {
      const title = nfo?.title || fileNameToTitle(filePath);

      [scene] = await db
        .insert(scenes)
        .values({
          title,
          details: nfo?.plot ?? null,
          date: nfo?.aired ?? null,
          rating: nfo?.rating != null ? normalizeNfoRating(nfo.rating) : null,
          url: nfo?.url ?? null,
          filePath,
          organized: false,
        })
        .returning({
          id: scenes.id,
          duration: scenes.duration,
          width: scenes.width,
          codec: scenes.codec,
          checksumMd5: scenes.checksumMd5,
          oshash: scenes.oshash,
          thumbnailPath: scenes.thumbnailPath,
          cardThumbnailPath: scenes.cardThumbnailPath,
          previewPath: scenes.previewPath,
          spritePath: scenes.spritePath,
          trickplayVttPath: scenes.trickplayVttPath,
        });
    } else if (nfo) {
      // Enrich existing scene with NFO data for any fields that are currently empty
      const [current] = await db
        .select({
          details: scenes.details,
          date: scenes.date,
          rating: scenes.rating,
          url: scenes.url,
        })
        .from(scenes)
        .where(eq(scenes.id, scene.id))
        .limit(1);

      if (current) {
        const patch: Record<string, unknown> = {};
        if (!current.details && nfo.plot) patch.details = nfo.plot;
        if (!current.date && nfo.aired) patch.date = nfo.aired;
        if (current.rating == null && nfo.rating != null) {
          const normalized = normalizeNfoRating(nfo.rating);
          if (normalized != null) patch.rating = normalized;
        }
        if (!current.url && nfo.url) patch.url = nfo.url;

        if (Object.keys(patch).length > 0) {
          patch.updatedAt = new Date();
          await db.update(scenes).set(patch).where(eq(scenes.id, scene.id));
        }
      }
    }

    // Propagate isNsfw: library root flag takes precedence, then relation-based
    await propagateSceneNsfw(scene.id, root.isNsfw);

    const sfwOnly = Boolean(job.data.sfwOnly);
    const [nsfwRow] = await db
      .select({ isNsfw: scenes.isNsfw })
      .from(scenes)
      .where(eq(scenes.id, scene.id))
      .limit(1);
    const skipHeavySceneJobs = sfwOnly && Boolean(nsfwRow?.isNsfw);

    if (
      !skipHeavySceneJobs &&
      settings.autoGenerateMetadata &&
      (!scene.duration || !scene.width || !scene.codec)
    ) {
      await enqueuePendingSceneJob("media-probe", scene.id, {
        by: "library-scan",
        label: `Queued during ${root.label} scan`,
      });
    }

    if (
      !skipHeavySceneJobs &&
      settings.autoGenerateFingerprints &&
      (!scene.checksumMd5 || !scene.oshash)
    ) {
      await enqueuePendingSceneJob("fingerprint", scene.id, {
        by: "library-scan",
        label: `Queued during ${root.label} scan`,
      });
    }

    {
      const hasCustomThumb = scene.thumbnailPath?.includes("thumb-custom") ?? false;
      const isMissingGeneratedThumbnail =
        !hasCustomThumb && (!scene.thumbnailPath || !scene.cardThumbnailPath);
      const isMissingDerivedAssets = !scene.previewPath || !scene.spritePath || !scene.trickplayVttPath;

      if (
        !skipHeavySceneJobs &&
        settings.autoGeneratePreview &&
        (isMissingGeneratedThumbnail || isMissingDerivedAssets)
      ) {
        await enqueuePendingSceneJob("preview", scene.id, {
          by: "library-scan",
          label: `Queued during ${root.label} scan`,
        });
      }
    }

    await markJobProgress(
      job,
      "library-scan",
      Math.max(1, Math.round(((index + 1) / files.length) * 100))
    );
  }

  await db
    .update(libraryRoots)
    .set({ lastScannedAt: new Date(), updatedAt: new Date() })
    .where(eq(libraryRoots.id, root.id));

  // Trigger gallery scan if this root has image scanning enabled
  const scanImages = root.scanImages ?? true;
  if (scanImages) {
    await enqueueGalleryRootJob(
      root,
      {
        by: "library-scan",
        label: `Queued during ${root.label} scan`,
      },
      gallerySfwOpts
    );
  }
}

async function processMediaProbe(job: Job) {
  const sceneId = String(job.data.sceneId);
  const [scene] = await db
    .select({ id: scenes.id, title: scenes.title, filePath: scenes.filePath })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .limit(1);

  if (!scene?.filePath) {
    throw new Error("Video file not found");
  }

  await markJobActive(job, "media-probe", {
    type: "scene",
    id: scene.id,
    label: scene.title,
  });

  const metadata = await probeVideoFile(scene.filePath);
  await markJobProgress(job, "media-probe", 70);

  await db
    .update(scenes)
    .set({
      fileSize: metadata.fileSize,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      frameRate: metadata.frameRate,
      bitRate: metadata.bitRate,
      codec: metadata.codec,
      container: metadata.container,
      updatedAt: new Date(),
    })
    .where(eq(scenes.id, scene.id));
}

async function processFingerprint(job: Job) {
  const sceneId = String(job.data.sceneId);
  const [scene] = await db
    .select({ id: scenes.id, title: scenes.title, filePath: scenes.filePath })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .limit(1);

  if (!scene?.filePath) {
    throw new Error("Video file not found");
  }

  await markJobActive(job, "fingerprint", {
    type: "scene",
    id: scene.id,
    label: scene.title,
  });

  const md5 = await computeMd5(scene.filePath);
  await markJobProgress(job, "fingerprint", 50);
  const oshash = await computeOsHash(scene.filePath);

  await db
    .update(scenes)
    .set({
      checksumMd5: md5,
      oshash,
      updatedAt: new Date(),
    })
    .where(eq(scenes.id, scene.id));
}

/**
 * Linearly interpolate resolution based on quality setting.
 * quality 1 → nativeSize (no downscale), quality 31 → minSize.
 */
function scaleResolution(nativeSize: number, minSize: number, quality: number): number {
  if (quality <= 1) return nativeSize;
  if (quality >= 31) return minSize;
  // Linear interpolation: q=1 → native, q=31 → min
  const t = (quality - 1) / 30;
  return Math.round(nativeSize - t * (nativeSize - minSize));
}

const MAX_TRICKPLAY_SHEET_PIXELS = 24_000_000;
const MAX_TRICKPLAY_FRAME_WIDTH = 320;
const MAX_TRICKPLAY_FRAME_HEIGHT = 180;
const MIN_TRICKPLAY_FRAME_WIDTH = 48;
const MIN_TRICKPLAY_FRAME_HEIGHT = 27;

function planTrickplaySheet(input: {
  duration: number;
  frameInterval: number;
  frameWidth: number;
  frameHeight: number;
}) {
  const effectiveDuration = Math.max(0, input.duration);
  let frameInterval = Math.max(1, input.frameInterval);
  let frameWidth = Math.min(
    MAX_TRICKPLAY_FRAME_WIDTH,
    Math.max(MIN_TRICKPLAY_FRAME_WIDTH, input.frameWidth)
  );
  let frameHeight = Math.min(
    MAX_TRICKPLAY_FRAME_HEIGHT,
    Math.max(MIN_TRICKPLAY_FRAME_HEIGHT, input.frameHeight)
  );
  let frameCount = Math.max(
    1,
    Math.ceil((effectiveDuration || frameInterval) / frameInterval)
  );

  let projectedPixels = frameCount * frameWidth * frameHeight;
  if (projectedPixels > MAX_TRICKPLAY_SHEET_PIXELS) {
    const scale = Math.sqrt(MAX_TRICKPLAY_SHEET_PIXELS / projectedPixels);
    frameWidth = Math.max(MIN_TRICKPLAY_FRAME_WIDTH, Math.floor(frameWidth * scale));
    frameHeight = Math.max(MIN_TRICKPLAY_FRAME_HEIGHT, Math.floor(frameHeight * scale));
    projectedPixels = frameCount * frameWidth * frameHeight;
  }

  if (projectedPixels > MAX_TRICKPLAY_SHEET_PIXELS) {
    const maxFrameCount = Math.max(
      1,
      Math.floor(MAX_TRICKPLAY_SHEET_PIXELS / (frameWidth * frameHeight))
    );
    frameInterval = Math.max(
      frameInterval,
      Math.ceil((effectiveDuration || frameInterval) / maxFrameCount)
    );
    frameCount = Math.max(
      1,
      Math.ceil((effectiveDuration || frameInterval) / frameInterval)
    );
  }

  return {
    frameInterval,
    frameCount,
    frameWidth,
    frameHeight,
  };
}

function toTimestamp(seconds: number) {
  const totalMilliseconds = Math.max(0, Math.floor(seconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((totalMilliseconds % 60_000) / 1000);
  const ms = totalMilliseconds % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    secs
  ).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function trickplayJpegQuality(quality: number) {
  const clamped = Math.max(1, Math.min(31, quality));
  const t = (clamped - 1) / 30;
  return Math.round(68 - t * 30);
}

async function processPreview(job: Job) {
  const sceneId = String(job.data.sceneId);
  const [scene] = await db
    .select({
      id: scenes.id,
      title: scenes.title,
      filePath: scenes.filePath,
      duration: scenes.duration,
      width: scenes.width,
      height: scenes.height,
    })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .limit(1);

  if (!scene?.filePath) {
    throw new Error("Video file not found");
  }

  await markJobActive(job, "preview", {
    type: "scene",
    id: scene.id,
    label: scene.title,
  });

  const settings = await ensureLibrarySettingsRow();
  const metadata =
    scene.duration && scene.width && scene.height
      ? scene
      : await probeVideoFile(scene.filePath);

  const sidecar = getSidecarPaths(scene.filePath);

  const thumbnailFile = sidecar.thumbnail;
  const previewFile = sidecar.preview;
  const spriteFile = sidecar.sprite;
  const trickplayFile = sidecar.trickplayVtt;

  const duration = metadata.duration ?? 0;
  const previewDuration = Math.max(4, settings.previewClipDurationSeconds);
  const previewStart = duration > previewDuration ? Math.max(0, duration * 0.1) : 0;
  const thumbnailAt = duration > 0 ? Math.min(duration - 0.5, Math.max(1, duration * 0.18)) : 0;
  const requestedFrameInterval = Math.max(3, settings.trickplayIntervalSeconds);
  // Resolution scales with the quality slider:
  //   quality 1  → native video resolution (no downscale)
  //   quality 31 → minimum (320px thumb, 160px card, 160px sprite)
  const nativeW = metadata.width ?? 1920;
  const nativeH = metadata.height ?? 1080;
  const thumbQualityClamped = Math.max(1, Math.min(31, settings.thumbnailQuality));
  const trickQualityClamped = Math.max(1, Math.min(31, settings.trickplayQuality));

  const thumbWidth = scaleResolution(nativeW, 320, thumbQualityClamped);
  const thumbHeight = Math.max(
    Math.round((nativeH / nativeW) * thumbWidth),
    Math.round(scaleResolution(nativeH, 180, thumbQualityClamped))
  );

  const cardFile = sidecar.cardThumbnail;
  const cardWidth = scaleResolution(nativeW, 160, thumbQualityClamped);
  const cardHeight = Math.max(
    Math.round((nativeH / nativeW) * cardWidth),
    Math.round(scaleResolution(nativeH, 90, thumbQualityClamped))
  );

  // Trickplay sprite frames scale independently with their own quality setting
  const spriteThumbWidth = scaleResolution(nativeW, 160, trickQualityClamped);
  const spriteThumbHeight = Math.max(
    Math.round((nativeH / nativeW) * spriteThumbWidth),
    Math.round(scaleResolution(nativeH, 90, trickQualityClamped))
  );
  const trickplayPlan = planTrickplaySheet({
    duration,
    frameInterval: requestedFrameInterval,
    frameWidth: spriteThumbWidth,
    frameHeight: spriteThumbHeight,
  });
  const frameInterval = trickplayPlan.frameInterval;
  const frameCount = trickplayPlan.frameCount;
  const plannedSpriteThumbWidth = trickplayPlan.frameWidth;
  const plannedSpriteThumbHeight = trickplayPlan.frameHeight;

  const thumbQuality = String(thumbQualityClamped);

  await runProcess("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(thumbnailAt),
    "-i",
    scene.filePath,
    "-frames:v",
    "1",
    "-vf",
    `scale=${thumbWidth}:${thumbHeight}`,
    "-q:v",
    thumbQuality,
    thumbnailFile,
  ]);

  await runProcess("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(thumbnailAt),
    "-i",
    scene.filePath,
    "-frames:v",
    "1",
    "-vf",
    `scale=${cardWidth}:${cardHeight}`,
    "-q:v",
    thumbQuality,
    cardFile,
  ]);
  await markJobProgress(job, "preview", 30);

  await runProcess("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(previewStart),
    "-t",
    String(previewDuration),
    "-i",
    scene.filePath,
    "-vf",
    "scale=960:-2",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "24",
    "-movflags",
    "+faststart",
    previewFile,
  ]);
  await markJobProgress(job, "preview", 65);

  // Extract individual frames via separate ffmpeg calls (robust against
  // mid-stream format changes), then stitch into a sprite with sharp.
  const tmpFrameDir = path.join(tmpdir(), `obscura-sprite-${scene.id}-${Date.now()}`);
  await mkdir(tmpFrameDir, { recursive: true });

  try {
    for (let index = 0; index < frameCount; index += 1) {
      const seekTime = Math.min(index * frameInterval, duration - 0.5);
      const frameFile = path.join(tmpFrameDir, `frame-${String(index).padStart(4, "0")}.png`);
      try {
        await runProcess("ffmpeg", [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-ss",
          String(seekTime),
          "-i",
          scene.filePath,
          "-frames:v",
          "1",
          "-vf",
          `scale=${plannedSpriteThumbWidth}:${plannedSpriteThumbHeight}`,
          frameFile,
        ]);
      } catch {
        // Create a black placeholder so grid stays aligned
        await sharp({
          create: {
            width: plannedSpriteThumbWidth,
            height: plannedSpriteThumbHeight,
            channels: 3,
            background: { r: 0, g: 0, b: 0 },
          },
        })
          .toFormat("png")
          .toFile(frameFile);
      }
    }

    // Read extracted frames in order
    const frameFiles = (await readdir(tmpFrameDir))
      .filter((f) => f.startsWith("frame-"))
      .sort()
      .map((f) => path.join(tmpFrameDir, f));

    const actualFrameCount = frameFiles.length;
    const gridColumns = Math.min(5, actualFrameCount);
    const gridRows = Math.max(1, Math.ceil(actualFrameCount / gridColumns));

    // Stitch frames into a single sprite sheet
    const composites: sharp.OverlayOptions[] = frameFiles.map((file, i) => ({
      input: file,
      left: (i % gridColumns) * plannedSpriteThumbWidth,
      top: Math.floor(i / gridColumns) * plannedSpriteThumbHeight,
    }));

    await sharp({
      create: {
        width: gridColumns * plannedSpriteThumbWidth,
        height: gridRows * plannedSpriteThumbHeight,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .composite(composites)
      .jpeg({
        quality: trickplayJpegQuality(trickQualityClamped),
        mozjpeg: true,
      })
      .toFile(spriteFile);

    // Generate VTT from actual extracted frames
    const vttLines = ["WEBVTT", ""];
    for (let index = 0; index < actualFrameCount; index += 1) {
      const start = index * frameInterval;
      const end = start + frameInterval;
      const column = index % gridColumns;
      const row = Math.floor(index / gridColumns);
      const x = column * plannedSpriteThumbWidth;
      const y = row * plannedSpriteThumbHeight;

      vttLines.push(`${toTimestamp(start)} --> ${toTimestamp(end)}`);
      vttLines.push(
        `${sceneAssetUrl(scene.id, "sprite")}#xywh=${x},${y},${plannedSpriteThumbWidth},${plannedSpriteThumbHeight}`
      );
      vttLines.push("");
    }

    await writeFile(trickplayFile, vttLines.join("\n"), "utf8");
  } finally {
    await rm(tmpFrameDir, { recursive: true, force: true });
  }

  await db
    .update(scenes)
    .set({
      thumbnailPath: sceneAssetUrl(scene.id, "thumb"),
      cardThumbnailPath: sceneAssetUrl(scene.id, "card"),
      previewPath: sceneAssetUrl(scene.id, "preview"),
      spritePath: sceneAssetUrl(scene.id, "sprite"),
      trickplayVttPath: sceneAssetUrl(scene.id, "trickplay"),
      updatedAt: new Date(),
    })
    .where(eq(scenes.id, scene.id));
}

async function processMetadataImport(job: Job) {
  const sceneId = String(job.data.sceneId ?? "");
  const [scene] = sceneId
    ? await db
        .select({ id: scenes.id, title: scenes.title })
        .from(scenes)
        .where(eq(scenes.id, sceneId))
        .limit(1)
    : [];

  await markJobActive(job, "metadata-import", {
    type: scene ? "scene" : undefined,
    id: scene?.id,
    label: scene?.title ?? "Metadata provider sync",
  });

  await markJobProgress(job, "metadata-import", 100);
}

// ─── Gallery Scan ──────────────────────────────────────────────────

async function shouldSkipGalleryDerivedJobs(
  sfwOnly: boolean,
  galleryId: string,
  imageId: string
): Promise<boolean> {
  if (!sfwOnly) return false;
  const [g] = await db
    .select({ isNsfw: galleries.isNsfw })
    .from(galleries)
    .where(eq(galleries.id, galleryId))
    .limit(1);
  const [img] = await db
    .select({ isNsfw: images.isNsfw })
    .from(images)
    .where(eq(images.id, imageId))
    .limit(1);
  return Boolean(g?.isNsfw || img?.isNsfw);
}

async function processGalleryScan(job: Job) {
  const sfwOnly = Boolean(job.data.sfwOnly);
  const libraryRootId = String(job.data.libraryRootId);
  const [root] = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.id, libraryRootId))
    .limit(1);

  if (!root) {
    throw new Error("Library root not found");
  }

  if (!(root.scanImages ?? true)) {
    return;
  }

  await markJobActive(job, "gallery-scan", {
    type: "library-root",
    id: root.id,
    label: root.label,
  });

  const settings = await ensureLibrarySettingsRow();
  const discovery = await discoverImageFilesAndDirs(root.path, root.recursive);

  // ── Cleanup stale folder-based galleries ──
  const knownFolderGalleries = await db
    .select({ id: galleries.id, folderPath: galleries.folderPath })
    .from(galleries)
    .where(
      and(
        eq(galleries.galleryType, "folder"),
        like(galleries.folderPath, `${root.path}%`)
      )
    );

  const discoveredDirSet = new Set(discovery.dirs);
  const staleFolderIds = knownFolderGalleries
    .filter((g) => g.folderPath && !discoveredDirSet.has(g.folderPath))
    .map((g) => g.id);

  if (staleFolderIds.length > 0) {
    await db.delete(galleries).where(inArray(galleries.id, staleFolderIds));
  }

  // ── Cleanup stale zip-based galleries ──
  const knownZipGalleries = await db
    .select({ id: galleries.id, zipFilePath: galleries.zipFilePath })
    .from(galleries)
    .where(
      and(
        eq(galleries.galleryType, "zip"),
        like(galleries.zipFilePath, `${root.path}%`)
      )
    );

  const discoveredZipSet = new Set(discovery.zipFiles);
  const staleZipIds = knownZipGalleries
    .filter((g) => g.zipFilePath && !discoveredZipSet.has(g.zipFilePath))
    .map((g) => g.id);

  if (staleZipIds.length > 0) {
    await db.delete(galleries).where(inArray(galleries.id, staleZipIds));
  }

  // ── Cleanup stale images ──
  const knownImagesInRoot = await db
    .select({ id: images.id, filePath: images.filePath })
    .from(images)
    .where(like(images.filePath, `${root.path}%`));

  const discoveredImageSet = new Set(discovery.imageFiles);
  const staleImageIds = knownImagesInRoot
    .filter((img) => {
      // Regular file: check if discovered
      if (!img.filePath.includes("::")) {
        return !discoveredImageSet.has(img.filePath);
      }
      // Zip member: check if parent zip was discovered
      const zipPath = img.filePath.split("::")[0];
      return !discoveredZipSet.has(zipPath);
    })
    .map((img) => img.id);

  if (staleImageIds.length > 0) {
    await removeGeneratedImageDirs(staleImageIds);
    await db.delete(images).where(inArray(images.id, staleImageIds));
  }

  const totalWork = discovery.dirs.length + discovery.zipFiles.length;
  let processed = 0;

  // ── Process folder-based galleries ──
  // Group image files by directory
  const imagesByDir = new Map<string, string[]>();
  for (const file of discovery.imageFiles) {
    const dir = path.dirname(file);
    const existing = imagesByDir.get(dir);
    if (existing) {
      existing.push(file);
    } else {
      imagesByDir.set(dir, [file]);
    }
  }

  // Sort directories by path depth (parent before child) to ensure parentId resolution works
  const sortedDirs = [...discovery.dirs].sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);

  for (const dirPath of sortedDirs) {
    const dirImages = imagesByDir.get(dirPath) ?? [];
    if (dirImages.length === 0) continue;

    // Upsert gallery
    const [existingGallery] = await db
      .select({ id: galleries.id })
      .from(galleries)
      .where(
        and(
          eq(galleries.galleryType, "folder"),
          eq(galleries.folderPath, dirPath)
        )
      )
      .limit(1);

    let galleryId: string;

    if (existingGallery) {
      galleryId = existingGallery.id;
    } else {
      // Find parent gallery
      const parentDir = path.dirname(dirPath);
      let parentId: string | null = null;
      if (parentDir !== dirPath && parentDir.startsWith(root.path)) {
        const [parentGallery] = await db
          .select({ id: galleries.id })
          .from(galleries)
          .where(
            and(
              eq(galleries.galleryType, "folder"),
              eq(galleries.folderPath, parentDir)
            )
          )
          .limit(1);
        parentId = parentGallery?.id ?? null;
      }

      const [created] = await db
        .insert(galleries)
        .values({
          title: path.basename(dirPath),
          galleryType: "folder",
          folderPath: dirPath,
          parentId,
          imageCount: 0,
          isNsfw: root.isNsfw,
        })
        .returning({ id: galleries.id });
      galleryId = created.id;
    }

    // Upsert images
    const sortedImages = [...dirImages].sort((a, b) => a.localeCompare(b));
    for (let i = 0; i < sortedImages.length; i++) {
      const filePath = sortedImages[i];

      const [existingImage] = await db
        .select({ id: images.id })
        .from(images)
        .where(eq(images.filePath, filePath))
        .limit(1);

      let imageId: string;
      let needsThumbnail = false;
      if (existingImage) {
        imageId = existingImage.id;
        await db
          .update(images)
          .set({ galleryId, sortOrder: i, updatedAt: new Date() })
          .where(eq(images.id, imageId));
        // Check if existing image is missing thumbnail or animated preview
        const [imgRow] = await db
          .select({ thumbnailPath: images.thumbnailPath })
          .from(images)
          .where(eq(images.id, imageId))
          .limit(1);
        if (!imgRow?.thumbnailPath) {
          needsThumbnail = true;
        } else {
          // For video formats, also check if the preview.mp4 has been generated
          const ext = path.extname(filePath).toLowerCase();
          const isVideoFormat = [".mp4", ".m4v", ".mkv", ".mov", ".webm", ".avi", ".wmv", ".flv"].includes(ext);
          if (isVideoFormat && !existsSync(path.join(getGeneratedImageDir(imageId), "preview.mp4"))) {
            needsThumbnail = true;
          }
        }
      } else {
        const [created] = await db
          .insert(images)
          .values({
            title: fileNameToTitle(filePath),
            filePath,
            galleryId,
            sortOrder: i,
            isNsfw: root.isNsfw,
          })
          .returning({ id: images.id });
        imageId = created.id;
        needsThumbnail = true;
      }

      if (needsThumbnail) {
        if (!(await shouldSkipGalleryDerivedJobs(sfwOnly, galleryId, imageId))) {
          await enqueuePendingImageJob("image-thumbnail", imageId, {
            by: "gallery-scan",
            label: `Queued during ${root.label} gallery scan`,
          });
        }
      }
      if (!existingImage && settings.autoGenerateFingerprints) {
        if (!(await shouldSkipGalleryDerivedJobs(sfwOnly, galleryId, imageId))) {
          await enqueuePendingImageJob("image-fingerprint", imageId, {
            by: "gallery-scan",
            label: `Queued during ${root.label} gallery scan`,
          });
        }
      }
    }

    // Update gallery image count
    await db.execute(sql`
      UPDATE galleries SET image_count = (
        SELECT count(*) FROM images WHERE gallery_id = ${galleryId}
      ), updated_at = NOW() WHERE id = ${galleryId}
    `);

    processed++;
    if (totalWork > 0) {
      await markJobProgress(job, "gallery-scan", Math.round((processed / totalWork) * 100));
    }
  }

  // ── Process zip-based galleries ──
  for (const zipPath of discovery.zipFiles) {
    const [existingGallery] = await db
      .select({ id: galleries.id })
      .from(galleries)
      .where(
        and(
          eq(galleries.galleryType, "zip"),
          eq(galleries.zipFilePath, zipPath)
        )
      )
      .limit(1);

    let galleryId: string;

    if (existingGallery) {
      galleryId = existingGallery.id;
    } else {
      const [created] = await db
        .insert(galleries)
        .values({
          title: fileNameToTitle(zipPath),
          galleryType: "zip",
          zipFilePath: zipPath,
          imageCount: 0,
          isNsfw: root.isNsfw,
        })
        .returning({ id: galleries.id });
      galleryId = created.id;
    }

    // Index zip members
    let members: string[];
    try {
      members = parseZipImageMembers(zipPath);
    } catch {
      processed++;
      continue;
    }

    for (let i = 0; i < members.length; i++) {
      const memberPath = members[i];
      const fullPath = `${zipPath}::${memberPath}`;

      const [existingImage] = await db
        .select({ id: images.id })
        .from(images)
        .where(eq(images.filePath, fullPath))
        .limit(1);

      let needsThumbnail = false;
      if (!existingImage) {
        const [created] = await db
          .insert(images)
          .values({
            title: fileNameToTitle(memberPath),
            filePath: fullPath,
            galleryId,
            sortOrder: i,
            isNsfw: root.isNsfw,
          })
          .returning({ id: images.id });

        needsThumbnail = true;
        if (!(await shouldSkipGalleryDerivedJobs(sfwOnly, galleryId, created.id))) {
          await enqueuePendingImageJob("image-thumbnail", created.id, {
            by: "gallery-scan",
            label: `Queued during ${root.label} gallery scan`,
          });
        }
        if (
          settings.autoGenerateFingerprints &&
          !(await shouldSkipGalleryDerivedJobs(sfwOnly, galleryId, created.id))
        ) {
          await enqueuePendingImageJob("image-fingerprint", created.id, {
            by: "gallery-scan",
            label: `Queued during ${root.label} gallery scan`,
          });
        }
      } else {
        await db
          .update(images)
          .set({ galleryId, sortOrder: i, updatedAt: new Date() })
          .where(eq(images.id, existingImage.id));
        // Re-enqueue thumbnail if missing or preview missing for video formats
        const [imgRow] = await db
          .select({ thumbnailPath: images.thumbnailPath })
          .from(images)
          .where(eq(images.id, existingImage.id))
          .limit(1);
        const zipMemberExt = path.extname(memberPath).toLowerCase();
        const isZipVideoFormat = [".mp4", ".m4v", ".mkv", ".mov", ".webm", ".avi", ".wmv", ".flv"].includes(zipMemberExt);
        if (!imgRow?.thumbnailPath ||
            (isZipVideoFormat && !existsSync(path.join(getGeneratedImageDir(existingImage.id), "preview.mp4")))) {
          if (!(await shouldSkipGalleryDerivedJobs(sfwOnly, galleryId, existingImage.id))) {
            await enqueuePendingImageJob("image-thumbnail", existingImage.id, {
              by: "gallery-scan",
              label: `Queued during ${root.label} gallery scan`,
            });
          }
        }
      }
    }

    // Update gallery image count
    await db.execute(sql`
      UPDATE galleries SET image_count = (
        SELECT count(*) FROM images WHERE gallery_id = ${galleryId}
      ), updated_at = NOW() WHERE id = ${galleryId}
    `);

    processed++;
    if (totalWork > 0) {
      await markJobProgress(job, "gallery-scan", Math.round((processed / totalWork) * 100));
    }
  }
}

// ─── Image Thumbnail ──────────────────────────────────────────────

async function processImageThumbnail(job: Job) {
  const imageId = String(job.data.imageId);
  const [image] = await db
    .select({ id: images.id, title: images.title, filePath: images.filePath })
    .from(images)
    .where(eq(images.id, imageId))
    .limit(1);

  if (!image) {
    throw new Error("Image not found");
  }

  await markJobActive(job, "image-thumbnail", {
    type: "image",
    id: image.id,
    label: image.title,
  });

  const outputDir = getGeneratedImageDir(image.id);
  await mkdir(outputDir, { recursive: true });
  const thumbPath = path.join(outputDir, "thumb.jpg");

  const isZipMember = image.filePath.includes("::");
  let inputPath = image.filePath;
  let tempFile: string | null = null;

  if (isZipMember) {
    // Extract zip member to a temp file
    const [zipPath, memberPath] = image.filePath.split("::");
    const data = extractZipMember(zipPath, memberPath);
    if (!data) {
      throw new Error("Failed to extract zip member");
    }
    tempFile = path.join(tmpdir(), `obscura-thumb-${image.id}${path.extname(memberPath)}`);
    await writeFile(tempFile, data);
    inputPath = tempFile;
  }

  try {
    // Detect if this is a video/animated format that needs single-frame extraction
    const ext = path.extname(inputPath).toLowerCase();
    const isVideo = [".mp4", ".m4v", ".mkv", ".mov", ".webm", ".avi", ".wmv", ".flv"].includes(ext);

    // Generate thumbnail with ffmpeg
    const ffmpegArgs = ["-hide_banner", "-loglevel", "error", "-y"];
    if (isVideo) {
      // Seek to 18% of the way through for a representative frame
      ffmpegArgs.push("-ss", "1");
    }
    ffmpegArgs.push("-i", inputPath);
    if (isVideo) {
      ffmpegArgs.push("-frames:v", "1");
    }
    ffmpegArgs.push("-vf", "scale=640:-1", "-q:v", "3", thumbPath);

    await runProcess("ffmpeg", ffmpegArgs);

    // For video/animated formats, also generate a small looping preview
    if (isVideo) {
      const previewPath = path.join(outputDir, "preview.mp4");
      try {
        await runProcess("ffmpeg", [
          "-hide_banner", "-loglevel", "error", "-y",
          "-i", inputPath,
          "-vf", "scale=320:-2",
          "-an",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "28",
          "-movflags", "+faststart",
          "-t", "8",
          previewPath,
        ]);
      } catch {
        // Preview generation is non-fatal
      }
    }

    // Probe for dimensions and format
    const probe = await probeImageFile(inputPath);

    await db
      .update(images)
      .set({
        thumbnailPath: `/assets/images/${image.id}/thumb`,
        width: probe.width,
        height: probe.height,
        format: probe.format,
        updatedAt: new Date(),
      })
      .where(eq(images.id, image.id));
  } finally {
    if (tempFile) {
      await rm(tempFile, { force: true });
    }
  }
}

// ─── Image Fingerprint ────────────────────────────────────────────

async function processImageFingerprint(job: Job) {
  const imageId = String(job.data.imageId);
  const [image] = await db
    .select({ id: images.id, title: images.title, filePath: images.filePath })
    .from(images)
    .where(eq(images.id, imageId))
    .limit(1);

  if (!image) {
    throw new Error("Image not found");
  }

  await markJobActive(job, "image-fingerprint", {
    type: "image",
    id: image.id,
    label: image.title,
  });

  const isZipMember = image.filePath.includes("::");
  let inputPath = image.filePath;
  let tempFile: string | null = null;

  if (isZipMember) {
    const [zipPath, memberPath] = image.filePath.split("::");
    const data = extractZipMember(zipPath, memberPath);
    if (!data) {
      throw new Error("Failed to extract zip member");
    }
    tempFile = path.join(tmpdir(), `obscura-fp-${image.id}${path.extname(memberPath)}`);
    await writeFile(tempFile, data);
    inputPath = tempFile;
  }

  try {
    const md5 = await computeMd5(inputPath);
    await markJobProgress(job, "image-fingerprint", 50);
    const oshash = await computeOsHash(inputPath);

    await db
      .update(images)
      .set({
        checksumMd5: md5,
        oshash,
        updatedAt: new Date(),
      })
      .where(eq(images.id, image.id));
  } finally {
    if (tempFile) {
      await rm(tempFile, { force: true });
    }
  }
}

function createWorker(queueName: QueueName, processor: (job: Job) => Promise<void>) {
  const definition = getQueueDefinition(queueName);

  return new Worker(
    queueName,
    async (job) => {
      try {
        await processor(job);
        await markJobCompleted(job, queueName);
      } catch (error) {
        await markJobFailed(job, queueName, error);
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: definition.concurrency,
    }
  );
}

let scheduling = false;
const scheduleLockKey = "obscura:worker:schedule-library-scan";

async function scheduleRecurringScans() {
  if (scheduling) {
    return;
  }

  const lockToken = `${process.pid}:${Date.now()}`;
  const lockAcquired = await redis.set(scheduleLockKey, lockToken, "PX", 55_000, "NX");
  if (!lockAcquired) {
    return;
  }

  scheduling = true;

  try {
    const settings = await ensureLibrarySettingsRow();
    if (!settings.autoScanEnabled) {
      return;
    }

    const enabledRoots = await db
      .select()
      .from(libraryRoots)
      .where(eq(libraryRoots.enabled, true))
      .orderBy(libraryRoots.path);

    if (enabledRoots.length === 0) {
      return;
    }

    const [lastRun] = await db
      .select({ createdAt: jobRuns.createdAt })
      .from(jobRuns)
      .where(eq(jobRuns.queueName, "library-scan"))
      .orderBy(desc(jobRuns.createdAt))
      .limit(1);

    const intervalMs = Math.max(5, settings.scanIntervalMinutes) * 60_000;
    if (lastRun && Date.now() - new Date(lastRun.createdAt).getTime() < intervalMs) {
      return;
    }

    for (const root of enabledRoots) {
      await enqueueLibraryRootJob(root, {
        by: "schedule",
        label: `Scheduled every ${Math.max(5, settings.scanIntervalMinutes)} minutes`,
      });
    }
  } finally {
    scheduling = false;
    if ((await redis.get(scheduleLockKey)) === lockToken) {
      await redis.del(scheduleLockKey);
    }
  }
}

const workers = [
  createWorker("library-scan", processLibraryScan),
  createWorker("media-probe", processMediaProbe),
  createWorker("fingerprint", processFingerprint),
  createWorker("preview", processPreview),
  createWorker("metadata-import", processMetadataImport),
  createWorker("gallery-scan", processGalleryScan),
  createWorker("image-thumbnail", processImageThumbnail),
  createWorker("image-fingerprint", processImageFingerprint),
];

await scheduleRecurringScans();
setInterval(() => {
  void scheduleRecurringScans();
}, 60_000);
await pruneJobRunHistory();
setInterval(() => {
  void pruneJobRunHistory();
}, 10 * 60_000);

console.log(
  JSON.stringify(
    {
      service: "worker",
      queues: queueDefinitions.map((definition) => definition.name),
      redisUrl,
    },
    null,
    2
  )
);

process.on("SIGINT", async () => {
  await Promise.all(workers.map((worker) => worker.close()));
  await Promise.all(Object.values(workerQueues).map((queue) => queue.close()));
  await redis.quit();
  await queryClient.end();
  process.exit(0);
});
