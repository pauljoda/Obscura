import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import {
  getVideoGeneratedDiskPaths,
  probeVideoFile,
  runProcess,
  videoGeneratedLayoutFromDedicated,
} from "@obscura/media-core";
import { db, videoEpisodes, videoMovies } from "../lib/db.js";
import { markJobActive, markJobProgress, type JobPayload } from "../lib/job-tracking.js";
import { ensureLibrarySettingsRow } from "../lib/scheduler.js";
import { videoAssetUrl } from "../lib/helpers.js";
import { applyVideoProbeToVideoEntity } from "./media-probe.js";

type VideoEntityKind = "video_episode" | "video_movie";

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

export function planTrickplaySheet(input: {
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

export function buildTrickplayFfmpegArgs(input: {
  filePath: string;
  spriteFile: string;
  frameInterval: number;
  frameWidth: number;
  frameHeight: number;
  gridColumns: number;
  gridRows: number;
  jpegQuality: number;
}) {
  const vf = [
    `fps=1/${input.frameInterval}`,
    `scale=${input.frameWidth}:${input.frameHeight}:force_original_aspect_ratio=decrease`,
    `pad=${input.frameWidth}:${input.frameHeight}:(ow-iw)/2:(oh-ih)/2`,
    `tile=${input.gridColumns}x${input.gridRows}`,
  ].join(",");

  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    input.filePath,
    "-vf",
    vf,
    "-frames:v",
    "1",
    "-q:v",
    String(input.jpegQuality),
    input.spriteFile,
  ];
}

export function buildTrickplayVtt(input: {
  assetUrl: string;
  frameCount: number;
  frameInterval: number;
  frameWidth: number;
  frameHeight: number;
  gridColumns: number;
}) {
  const vttLines = ["WEBVTT", ""];

  for (let index = 0; index < input.frameCount; index += 1) {
    const start = index * input.frameInterval;
    const end = start + input.frameInterval;
    const column = index % input.gridColumns;
    const row = Math.floor(index / input.gridColumns);
    const x = column * input.frameWidth;
    const y = row * input.frameHeight;

    vttLines.push(`${toTimestamp(start)} --> ${toTimestamp(end)}`);
    vttLines.push(
      `${input.assetUrl}#xywh=${x},${y},${input.frameWidth},${input.frameHeight}`
    );
    vttLines.push("");
  }

  return vttLines.join("\n");
}

export async function processPreview(job: Job) {
  const entityKind =
    (job.data.entityKind as VideoEntityKind | undefined) ?? null;

  if (entityKind !== "video_episode" && entityKind !== "video_movie") {
    throw new Error(
      `preview processor received unsupported payload ${JSON.stringify(job.data)} — expected entityKind video_episode or video_movie`,
    );
  }

  const entityId = String(job.data.entityId);
  const table = entityKind === "video_episode" ? videoEpisodes : videoMovies;
  const [row] = await db
    .select({
      id: table.id,
      title: table.title,
      filePath: table.filePath,
      duration: table.duration,
      width: table.width,
      height: table.height,
    })
    .from(table)
    .where(eq(table.id, entityId))
    .limit(1);
  if (!row?.filePath) {
    throw new Error("Video file not found");
  }
  const video: {
    id: string;
    title: string | null;
    filePath: string | null;
    duration: number | null;
    width: number | null;
    height: number | null;
  } = row;
  const targetType = entityKind;

  await markJobActive(job, "preview", {
    type: targetType,
    id: video.id,
    label: video.title ?? undefined,
  });

  const payload = job.data as JobPayload;
  const settings = await ensureLibrarySettingsRow();

  const filePath = video.filePath!;
  const metadata =
    payload.jobKind === "force-rebuild"
      ? await applyVideoProbeToVideoEntity(entityKind, video.id, filePath)
      : video.duration && video.width && video.height
        ? video
        : await probeVideoFile(filePath);

  if (payload.jobKind === "force-rebuild") {
    await markJobProgress(job, "preview", 12);
  }

  const layout = videoGeneratedLayoutFromDedicated(
    settings.metadataStorageDedicated ?? true
  );
  const genPaths = getVideoGeneratedDiskPaths(video.id, filePath, layout);

  const thumbnailFile = genPaths.thumb;
  const previewFile = genPaths.preview;
  const spriteFile = genPaths.sprite;
  const trickplayFile = genPaths.trickplay;

  await mkdir(path.dirname(thumbnailFile), { recursive: true });

  const duration = metadata.duration ?? 0;
  const previewDuration = Math.max(4, settings.previewClipDurationSeconds);
  const previewStart = duration > previewDuration ? Math.max(0, duration * 0.1) : 0;
  const thumbnailAt = duration > 0 ? Math.min(duration - 0.5, Math.max(1, duration * 0.18)) : 0;
  const shouldGeneratePreviewAssets = settings.autoGeneratePreview === true;
  const shouldGenerateTrickplay = settings.generateTrickplay === true;
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

  const assetPatch: Record<string, unknown> = { updatedAt: new Date() };

  if (shouldGeneratePreviewAssets) {
    await runProcess("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      String(thumbnailAt),
      "-i",
      filePath,
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
      filePath,
      "-frames:v",
      "1",
      "-vf",
      `scale=${cardWidth}:${cardHeight}`,
      "-q:v",
      thumbQuality,
      cardFile,
    ]);
    await markJobProgress(job, "preview", shouldGenerateTrickplay ? 30 : 50);

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
      filePath,
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
    await markJobProgress(job, "preview", shouldGenerateTrickplay ? 65 : 100);

    assetPatch.thumbnailPath = videoAssetUrl(video.id, "thumb");
    assetPatch.cardThumbnailPath = videoAssetUrl(video.id, "card");
    assetPatch.previewPath = videoAssetUrl(video.id, "preview");
  }

  if (shouldGenerateTrickplay) {
    const gridColumns = Math.min(5, frameCount);
    const gridRows = Math.max(1, Math.ceil(frameCount / gridColumns));

    await runProcess(
      "ffmpeg",
      buildTrickplayFfmpegArgs({
        filePath,
        spriteFile,
        frameInterval,
        frameWidth: plannedSpriteThumbWidth,
        frameHeight: plannedSpriteThumbHeight,
        gridColumns,
        gridRows,
        jpegQuality: trickplayJpegQuality(trickQualityClamped),
      }),
    );

    await writeFile(
      trickplayFile,
      buildTrickplayVtt({
        assetUrl: videoAssetUrl(video.id, "sprite"),
        frameCount,
        frameInterval,
        frameWidth: plannedSpriteThumbWidth,
        frameHeight: plannedSpriteThumbHeight,
        gridColumns,
      }),
      "utf8",
    );

    assetPatch.spritePath = videoAssetUrl(video.id, "sprite");
    assetPatch.trickplayVttPath = videoAssetUrl(video.id, "trickplay");
    await markJobProgress(job, "preview", 100);
  }

  if (entityKind === "video_episode") {
    await db.update(videoEpisodes).set(assetPatch).where(eq(videoEpisodes.id, video.id));
  } else {
    await db.update(videoMovies).set(assetPatch).where(eq(videoMovies.id, video.id));
  }
}
