import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import {
  getSceneVideoGeneratedDiskPaths,
  probeVideoFile,
  runProcess,
  sceneVideoGeneratedLayoutFromDedicated,
} from "@obscura/media-core";
import { db, scenes } from "../lib/db.js";
import { markJobActive, markJobProgress, type JobPayload } from "../lib/job-tracking.js";
import { ensureLibrarySettingsRow } from "../lib/scheduler.js";
import { sceneAssetUrl } from "../lib/helpers.js";
import { applyVideoProbeToScene } from "./media-probe.js";

/**
 * Linearly interpolate resolution based on quality setting.
 * quality 1 -> nativeSize (no downscale), quality 31 -> minSize.
 */
function scaleResolution(nativeSize: number, minSize: number, quality: number): number {
  if (quality <= 1) return nativeSize;
  if (quality >= 31) return minSize;
  // Linear interpolation: q=1 -> native, q=31 -> min
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

export async function processPreview(job: Job) {
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

  const payload = job.data as JobPayload;
  const settings = await ensureLibrarySettingsRow();

  const metadata =
    payload.jobKind === "force-rebuild"
      ? await applyVideoProbeToScene(scene.id, scene.filePath)
      : scene.duration && scene.width && scene.height
        ? scene
        : await probeVideoFile(scene.filePath);

  if (payload.jobKind === "force-rebuild") {
    await markJobProgress(job, "preview", 12);
  }

  const layout = sceneVideoGeneratedLayoutFromDedicated(
    settings.metadataStorageDedicated ?? true
  );
  const genPaths = getSceneVideoGeneratedDiskPaths(scene.id, scene.filePath, layout);

  const thumbnailFile = genPaths.thumb;
  const previewFile = genPaths.preview;
  const spriteFile = genPaths.sprite;
  const trickplayFile = genPaths.trickplay;

  await mkdir(path.dirname(thumbnailFile), { recursive: true });

  const duration = metadata.duration ?? 0;
  const previewDuration = Math.max(4, settings.previewClipDurationSeconds);
  const previewStart = duration > previewDuration ? Math.max(0, duration * 0.1) : 0;
  const thumbnailAt = duration > 0 ? Math.min(duration - 0.5, Math.max(1, duration * 0.18)) : 0;
  const requestedFrameInterval = Math.max(3, settings.trickplayIntervalSeconds);
  // Resolution scales with the quality slider:
  //   quality 1  -> native video resolution (no downscale)
  //   quality 31 -> minimum (320px thumb, 160px card, 160px sprite)
  const nativeW = metadata.width ?? 1920;
  const nativeH = metadata.height ?? 1080;
  const thumbQualityClamped = Math.max(1, Math.min(31, settings.thumbnailQuality));
  const trickQualityClamped = Math.max(1, Math.min(31, settings.trickplayQuality));

  const thumbWidth = scaleResolution(nativeW, 320, thumbQualityClamped);
  const thumbHeight = Math.max(
    Math.round((nativeH / nativeW) * thumbWidth),
    Math.round(scaleResolution(nativeH, 180, thumbQualityClamped))
  );

  const cardFile = genPaths.card;
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
