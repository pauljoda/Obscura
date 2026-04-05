import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import postgres from "postgres";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { queueDefinitions, type QueueName } from "@obscura/contracts";
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
} = schema;

function sceneAssetUrl(sceneId: string, fileName: string) {
  return `/assets/scenes/${sceneId}/${fileName}`;
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
      payload: patch.payload ?? job.data ?? {},
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
        payload: patch.payload ?? job.data ?? {},
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
    error: error instanceof Error ? error.message : "Unknown error",
    finishedAt: new Date(),
  });
}

async function enqueuePendingSceneJob(queueName: QueueName, sceneId: string) {
  const [pending] = await db
    .select({ id: jobRuns.id })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.queueName, queueName),
        eq(jobRuns.targetId, sceneId),
        inArray(jobRuns.status, ["waiting", "active", "delayed"])
      )
    )
    .limit(1);

  if (pending) {
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

  const queue = new Queue(queueName, {
    connection: redis,
    defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200 },
  });

  const job = await queue.add(`scene-${queueName}`, { sceneId });
  await upsertJobRun(job, queueName, {
    status: "waiting",
    targetType: "scene",
    targetId: scene.id,
    targetLabel: scene.title,
  });

  await queue.close();
}

async function enqueuePendingImageJob(queueName: QueueName, imageId: string) {
  const [pending] = await db
    .select({ id: jobRuns.id })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.queueName, queueName),
        eq(jobRuns.targetId, imageId),
        inArray(jobRuns.status, ["waiting", "active", "delayed"])
      )
    )
    .limit(1);

  if (pending) return;

  const [image] = await db
    .select({ id: images.id, title: images.title })
    .from(images)
    .where(eq(images.id, imageId))
    .limit(1);

  if (!image) return;

  const queue = new Queue(queueName, {
    connection: redis,
    defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200 },
  });

  const job = await queue.add(`image-${queueName}`, { imageId });
  await upsertJobRun(job, queueName, {
    status: "waiting",
    targetType: "image",
    targetId: image.id,
    targetLabel: image.title,
  });

  await queue.close();
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

  const settings = await ensureLibrarySettingsRow();

  // Only scan for videos if this root has video scanning enabled
  const scanVideos = root.scanVideos ?? true;
  const files = scanVideos ? await discoverVideoFiles(root.path, root.recursive) : [];
  const discoveredSet = new Set(files);

  const allKnownScenes = await db
    .select({
      id: scenes.id,
      filePath: scenes.filePath,
    })
    .from(scenes);

  const globallyMissingSceneIds = allKnownScenes
    .filter((scene) => scene.filePath && !existsSync(scene.filePath))
    .map((scene) => scene.id);

  if (globallyMissingSceneIds.length > 0) {
    for (const missingSceneId of globallyMissingSceneIds) {
      await rm(getGeneratedSceneDir(missingSceneId), { recursive: true, force: true });
    }

    await db.delete(scenes).where(inArray(scenes.id, globallyMissingSceneIds));
  }

  // Remove scenes whose file path doesn't fall under any enabled library root
  const allRoots = await db
    .select({ path: libraryRoots.path })
    .from(libraryRoots)
    .where(eq(libraryRoots.enabled, true));

  const enabledRootPaths = allRoots.map((r) => r.path);

  const orphanedSceneIds = allKnownScenes
    .filter((scene) => {
      if (!scene.filePath) return false;
      if (globallyMissingSceneIds.includes(scene.id)) return false;
      return !enabledRootPaths.some((rootPath) => scene.filePath!.startsWith(rootPath));
    })
    .map((scene) => scene.id);

  if (orphanedSceneIds.length > 0) {
    for (const orphanedId of orphanedSceneIds) {
      await rm(getGeneratedSceneDir(orphanedId), { recursive: true, force: true });
    }

    await db.delete(scenes).where(inArray(scenes.id, orphanedSceneIds));
  }

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
    for (const staleSceneId of staleSceneIds) {
      await rm(getGeneratedSceneDir(staleSceneId), { recursive: true, force: true });
    }

    await db.delete(scenes).where(inArray(scenes.id, staleSceneIds));
  }

  if (files.length === 0) {
    await db
      .update(libraryRoots)
      .set({ lastScannedAt: new Date(), updatedAt: new Date() })
      .where(eq(libraryRoots.id, root.id));

    // Still trigger gallery scan even if no video files were found
    const scanImages = root.scanImages ?? true;
    if (scanImages) {
      const galleryScanQueue = new Queue("gallery-scan", {
        connection: redis,
        defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200 },
      });
      const galleryScanJob = await galleryScanQueue.add("gallery-root-scan", {
        libraryRootId: root.id,
      });
      await upsertJobRun(galleryScanJob, "gallery-scan", {
        status: "waiting",
        targetType: "library-root",
        targetId: root.id,
        targetLabel: root.label,
      });
      await galleryScanQueue.close();
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

    if (
      settings.autoGenerateMetadata &&
      (!scene.duration || !scene.width || !scene.codec)
    ) {
      await enqueuePendingSceneJob("media-probe", scene.id);
    }

    if (
      settings.autoGenerateFingerprints &&
      (!scene.checksumMd5 || !scene.oshash)
    ) {
      await enqueuePendingSceneJob("fingerprint", scene.id);
    }

    {
      const hasCustomThumb = scene.thumbnailPath?.includes("thumb-custom") ?? false;
      const isMissing =
        !scene.thumbnailPath ||
        !scene.previewPath ||
        !scene.spritePath ||
        !scene.trickplayVttPath;
      // Always regenerate if the user hasn't set a custom thumbnail so
      // quality setting changes take effect on the next scan.
      if (settings.autoGeneratePreview && (isMissing || !hasCustomThumb)) {
        await enqueuePendingSceneJob("preview", scene.id);
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
    const galleryScanQueue = new Queue("gallery-scan", {
      connection: redis,
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200 },
    });
    const galleryScanJob = await galleryScanQueue.add("gallery-root-scan", {
      libraryRootId: root.id,
    });
    await upsertJobRun(galleryScanJob, "gallery-scan", {
      status: "waiting",
      targetType: "library-root",
      targetId: root.id,
      targetLabel: root.label,
    });
    await galleryScanQueue.close();
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
    throw new Error("Scene file not found");
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
    throw new Error("Scene file not found");
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
    throw new Error("Scene file not found");
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
  const frameInterval = Math.max(3, settings.trickplayIntervalSeconds);
  const frameCount = Math.max(1, Math.ceil((duration || frameInterval) / frameInterval));
  const columns = Math.min(5, frameCount);
  const rows = Math.max(1, Math.ceil(frameCount / columns));
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

  const spriteQuality = String(trickQualityClamped);

  await runProcess("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    scene.filePath,
    "-vf",
    `fps=1/${frameInterval},scale=${spriteThumbWidth}:${spriteThumbHeight},tile=${columns}x${rows}`,
    "-frames:v",
    "1",
    "-q:v",
    spriteQuality,
    spriteFile,
  ]);

  const vttLines = ["WEBVTT", ""];
  for (let index = 0; index < frameCount; index += 1) {
    const start = index * frameInterval;
    const end = start + frameInterval;
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * spriteThumbWidth;
    const y = row * spriteThumbHeight;

    vttLines.push(`${toTimestamp(start)} --> ${toTimestamp(end)}`);
    vttLines.push(`${sceneAssetUrl(scene.id, "sprite")}#xywh=${x},${y},${spriteThumbWidth},${spriteThumbHeight}`);
    vttLines.push("");
  }

  await writeFile(trickplayFile, vttLines.join("\n"), "utf8");

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

async function processGalleryScan(job: Job) {
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
    for (const staleId of staleImageIds) {
      await rm(getGeneratedImageDir(staleId), { recursive: true, force: true });
    }
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
      if (existingImage) {
        imageId = existingImage.id;
        await db
          .update(images)
          .set({ galleryId, sortOrder: i, updatedAt: new Date() })
          .where(eq(images.id, imageId));
      } else {
        const [created] = await db
          .insert(images)
          .values({
            title: fileNameToTitle(filePath),
            filePath,
            galleryId,
            sortOrder: i,
          })
          .returning({ id: images.id });
        imageId = created.id;

        // Enqueue thumbnail and fingerprint jobs for new images
        await enqueuePendingImageJob("image-thumbnail", imageId);
        if (settings.autoGenerateFingerprints) {
          await enqueuePendingImageJob("image-fingerprint", imageId);
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

      if (!existingImage) {
        const [created] = await db
          .insert(images)
          .values({
            title: fileNameToTitle(memberPath),
            filePath: fullPath,
            galleryId,
            sortOrder: i,
          })
          .returning({ id: images.id });

        await enqueuePendingImageJob("image-thumbnail", created.id);
        if (settings.autoGenerateFingerprints) {
          await enqueuePendingImageJob("image-fingerprint", created.id);
        }
      } else {
        await db
          .update(images)
          .set({ galleryId, sortOrder: i, updatedAt: new Date() })
          .where(eq(images.id, existingImage.id));
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
    // Generate thumbnail with ffmpeg
    await runProcess("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", inputPath,
      "-vf", "scale=640:-1",
      "-q:v", "3",
      thumbPath,
    ]);

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
      concurrency:
        queueName === "library-scan" || queueName === "gallery-scan"
          ? 1
          : queueName === "image-thumbnail"
            ? 3
            : 2,
    }
  );
}

async function enqueueScheduledLibraryScan(rootId: string, label: string, rootPath: string, recursive: boolean) {
  const queue = new Queue("library-scan", {
    connection: redis,
    defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200 },
  });

  const job = await queue.add("library-root-scan", {
    libraryRootId: rootId,
    path: rootPath,
    recursive,
  });

  await upsertJobRun(job, "library-scan", {
    status: "waiting",
    targetType: "library-root",
    targetId: rootId,
    targetLabel: label,
  });

  await queue.close();
}

let scheduling = false;

async function scheduleRecurringScans() {
  if (scheduling) {
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
      await enqueueScheduledLibraryScan(root.id, root.label, root.path, root.recursive);
    }
  } finally {
    scheduling = false;
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
  await redis.quit();
  await queryClient.end();
  process.exit(0);
});
