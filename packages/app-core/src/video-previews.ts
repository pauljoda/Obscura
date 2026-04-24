import { existsSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { AppDb } from "@obscura/db";
import {
  allVideoGeneratedDiskPaths,
  getGeneratedVideoDir,
  resolveExistingMediaPath,
  runProcess,
} from "@obscura/media-core";
import {
  InternalError,
  NotFoundError,
  UpstreamError,
  ValidationError,
} from "./errors";
import {
  defaultEnqueueJob,
  findVideoEntity,
  videoEntityTable,
  type VideoWriteDeps,
} from "./video-core";

async function saveCustomVideoThumbnail(
  db: AppDb,
  id: string,
  buffer: Buffer,
): Promise<{ thumbnailPath: string }> {
  const entity = await findVideoEntity(db, id);
  if (!entity) throw new NotFoundError("Video not found");

  const genDir = getGeneratedVideoDir(id);
  await mkdir(genDir, { recursive: true });
  const thumbPath = path.join(genDir, "thumbnail-custom.jpg");
  await writeFile(thumbPath, buffer);

  const assetUrl = `/assets/videos/${id}/thumb-custom`;
  const table = videoEntityTable(entity.kind);
  await db
    .update(table)
    .set({
      thumbnailPath: assetUrl,
      cardThumbnailPath: null,
      updatedAt: new Date(),
    })
    .where(eq(table.id, id));
  return { thumbnailPath: assetUrl };
}

export async function setCustomVideoThumbnailWrite(
  db: AppDb,
  id: string,
  buffer: Buffer,
) {
  return saveCustomVideoThumbnail(db, id, buffer);
}

export async function setCustomVideoThumbnailFromUrlWrite(
  db: AppDb,
  id: string,
  imageUrl: string,
) {
  if (!imageUrl || !imageUrl.startsWith("http")) {
    throw new ValidationError("Invalid image URL");
  }
  let buffer: Buffer;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      throw new UpstreamError(`Failed to fetch image: ${res.status}`);
    }
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError("Failed to download image");
  }
  return saveCustomVideoThumbnail(db, id, buffer);
}

export async function setCustomVideoThumbnailFromFrameWrite(
  db: AppDb,
  id: string,
  requestedSeconds: number,
) {
  if (!Number.isFinite(requestedSeconds)) {
    throw new ValidationError("Invalid frame time");
  }
  const entity = await findVideoEntity(db, id);
  if (!entity) throw new NotFoundError("Video not found");
  const sourcePath = resolveExistingMediaPath(entity.filePath);
  if (!sourcePath) {
    throw new NotFoundError("Video file not found");
  }

  const table = videoEntityTable(entity.kind);
  const [row] = await db
    .select({ duration: table.duration })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);
  const duration = row?.duration ?? null;
  const maxSeconds =
    duration && duration > 0 ? Math.max(0, duration - 0.05) : null;
  const seconds =
    maxSeconds != null
      ? Math.min(Math.max(0, requestedSeconds), maxSeconds)
      : Math.max(0, requestedSeconds);

  const genDir = getGeneratedVideoDir(id);
  await mkdir(genDir, { recursive: true });
  const thumbPath = path.join(genDir, "thumbnail-custom.jpg");

  try {
    await runProcess("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      sourcePath,
      "-ss",
      seconds.toFixed(3),
      "-frames:v",
      "1",
      "-q:v",
      "2",
      thumbPath,
    ]);
  } catch {
    throw new InternalError("Failed to generate thumbnail from frame");
  }

  const assetUrl = `/assets/videos/${id}/thumb-custom`;
  await db
    .update(table)
    .set({
      thumbnailPath: assetUrl,
      cardThumbnailPath: null,
      updatedAt: new Date(),
    })
    .where(eq(table.id, id));

  return { ok: true as const, thumbnailPath: assetUrl, seconds };
}

export async function resetVideoThumbnailWrite(db: AppDb, id: string) {
  const entity = await findVideoEntity(db, id);
  if (!entity) throw new NotFoundError("Video not found");

  const customPath = path.join(getGeneratedVideoDir(id), "thumbnail-custom.jpg");
  try {
    if (existsSync(customPath)) await unlink(customPath);
  } catch {}

  const defaultUrl = `/assets/videos/${id}/thumb`;
  const defaultCardUrl = `/assets/videos/${id}/card`;
  const table = videoEntityTable(entity.kind);
  await db
    .update(table)
    .set({
      thumbnailPath: defaultUrl,
      cardThumbnailPath: defaultCardUrl,
      updatedAt: new Date(),
    })
    .where(eq(table.id, id));

  return { ok: true as const, thumbnailPath: defaultUrl };
}

export async function rebuildVideoPreviewWrite(
  db: AppDb,
  id: string,
  deps: VideoWriteDeps = {},
) {
  const entity = await findVideoEntity(db, id);
  if (!entity) throw new NotFoundError("Video not found");
  const sourcePath = resolveExistingMediaPath(entity.filePath);
  if (!sourcePath) {
    throw new ValidationError("Video has no file on disk");
  }

  for (const p of allVideoGeneratedDiskPaths(id, sourcePath)) {
    try {
      if (existsSync(p)) await unlink(p);
    } catch {}
  }

  const table = videoEntityTable(entity.kind);
  await db
    .update(table)
    .set({
      thumbnailPath: null,
      cardThumbnailPath: null,
      previewPath: null,
      spritePath: null,
      trickplayVttPath: null,
      updatedAt: new Date(),
    })
    .where(eq(table.id, id));

  const enqueue = deps.enqueueJob ?? defaultEnqueueJob(db);
  const result = await enqueue({
    queueName: "preview",
    jobName: `${entity.kind}-preview`,
    data: { entityKind: entity.kind, entityId: id },
    target: {
      type: entity.kind,
      id,
      label: entity.title,
    },
    trigger: {
      by: "manual",
      kind: "force-rebuild",
      label: "Force rebuild preview",
    },
  });

  return { ok: true as const, jobId: result?.id ?? null };
}
