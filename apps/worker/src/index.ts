import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import postgres from "postgres";
import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { queueDefinitions, type QueueName } from "@obscura/contracts";
import {
  computeMd5,
  computeOsHash,
  discoverVideoFiles,
  fileNameToTitle,
  getGeneratedSceneDir,
  probeVideoFile,
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
  const files = await discoverVideoFiles(root.path, root.recursive);

  if (files.length === 0) {
    await db
      .update(libraryRoots)
      .set({ lastScannedAt: new Date(), updatedAt: new Date() })
      .where(eq(libraryRoots.id, root.id));
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

    const scene =
      existing ??
      (
        await db
          .insert(scenes)
          .values({
            title: fileNameToTitle(filePath),
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
          })
      )[0];

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

    if (
      settings.autoGeneratePreview &&
      (!scene.thumbnailPath ||
        !scene.previewPath ||
        !scene.spritePath ||
        !scene.trickplayVttPath)
    ) {
      await enqueuePendingSceneJob("preview", scene.id);
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

  const sceneDir = getGeneratedSceneDir(scene.id);
  await mkdir(sceneDir, { recursive: true });

  const thumbnailFile = path.join(sceneDir, "thumbnail.jpg");
  const previewFile = path.join(sceneDir, "preview.mp4");
  const spriteFile = path.join(sceneDir, "sprite.jpg");
  const trickplayFile = path.join(sceneDir, "trickplay.vtt");

  const duration = metadata.duration ?? 0;
  const previewDuration = Math.max(4, settings.previewClipDurationSeconds);
  const previewStart = duration > previewDuration ? Math.max(0, duration * 0.1) : 0;
  const thumbnailAt = duration > 0 ? Math.min(duration - 0.5, Math.max(1, duration * 0.18)) : 0;
  const frameInterval = Math.max(3, settings.trickplayIntervalSeconds);
  const frameCount = Math.max(1, Math.ceil((duration || frameInterval) / frameInterval));
  const columns = Math.min(5, frameCount);
  const rows = Math.max(1, Math.ceil(frameCount / columns));
  const thumbWidth = 320;
  const thumbHeight =
    metadata.width && metadata.height
      ? Math.max(180, Math.round((metadata.height / metadata.width) * thumbWidth))
      : 180;

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
    thumbnailFile,
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

  await runProcess("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    scene.filePath,
    "-vf",
    `fps=1/${frameInterval},scale=${thumbWidth}:${thumbHeight},tile=${columns}x${rows}`,
    "-frames:v",
    "1",
    spriteFile,
  ]);

  const vttLines = ["WEBVTT", ""];
  for (let index = 0; index < frameCount; index += 1) {
    const start = index * frameInterval;
    const end = start + frameInterval;
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * thumbWidth;
    const y = row * thumbHeight;

    vttLines.push(`${toTimestamp(start)} --> ${toTimestamp(end)}`);
    vttLines.push(`${sceneAssetUrl(scene.id, "sprite.jpg")}#xywh=${x},${y},${thumbWidth},${thumbHeight}`);
    vttLines.push("");
  }

  await writeFile(trickplayFile, vttLines.join("\n"), "utf8");

  await db
    .update(scenes)
    .set({
      thumbnailPath: sceneAssetUrl(scene.id, "thumbnail.jpg"),
      previewPath: sceneAssetUrl(scene.id, "preview.mp4"),
      spritePath: sceneAssetUrl(scene.id, "sprite.jpg"),
      trickplayVttPath: sceneAssetUrl(scene.id, "trickplay.vtt"),
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
      concurrency: queueName === "library-scan" ? 1 : 2,
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
