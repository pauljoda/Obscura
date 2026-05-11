import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
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
import { resolveRequiredMediaPath } from "../lib/media-paths.js";
import { applyVideoProbeToVideoEntity } from "./media-probe.js";

type VideoEntityKind = "video_episode" | "video_movie";

async function fileExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.size > 0;
  } catch {
    return false;
  }
}

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

export function buildTrickplayFrameFfmpegArgs(input: {
  filePath: string;
  outputFile: string;
  timestampSeconds: number;
  frameWidth: number;
  frameHeight: number;
  jpegQuality: number;
}) {
  // format=yuvj420p is required: ffmpeg's mjpeg encoder refuses to write
  // full-range YUV (color_range=pc) without it, which makes raw extraction
  // fail on a large fraction of real-world sources (HDR, phone video,
  // rendered animation). Standardising on JPEG-range here is correct.
  const vf = [
    `scale=${input.frameWidth}:${input.frameHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
    `setsar=1`,
    `pad=${input.frameWidth}:${input.frameHeight}:(ow-iw)/2:(oh-ih)/2`,
    `format=yuvj420p`,
  ].join(",");

  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    // -skip_frame nokey makes the decoder discard B/P frame packets entirely,
    // so seeking lands on a keyframe and we decode only that one frame.
    // Combined with input-seek (-ss before -i) this is dramatically faster
    // than letting ffmpeg decode the GOP up to an exact timestamp — and
    // for trickplay scrub previews the visual cost (frame snaps to the
    // nearest preceding keyframe, typically within a few seconds of the
    // requested time) is negligible.
    "-skip_frame",
    "nokey",
    "-ss",
    input.timestampSeconds.toFixed(3),
    "-i",
    input.filePath,
    "-frames:v",
    "1",
    "-vf",
    vf,
    "-q:v",
    String(input.jpegQuality),
    input.outputFile,
  ];
}

export function trickplayFrameTimestamp(
  frameIndex: number,
  frameInterval: number,
  duration?: number,
) {
  // Center the sample inside its VTT interval so keyframe-snapping doesn't
  // push it outside the cue's time range.
  const center = frameIndex * frameInterval + frameInterval / 2;
  if (typeof duration === "number" && Number.isFinite(duration) && duration >= 0) {
    // Don't seek past the end of the source. ffmpeg with -skip_frame nokey
    // and an out-of-range -ss exits 0 without writing the output, which
    // breaks the downstream sharp composite. Cap a half-second before EOF
    // so we always have a real frame to land on; multiple slots may collapse
    // to the same timestamp on very short videos and re-extract the same
    // keyframe, which is fine for trickplay.
    const cap = Math.max(0, duration - 0.5);
    return Math.min(center, cap);
  }
  return center;
}

export function trickplaySharpQuality(quality: number) {
  const clamped = Math.max(1, Math.min(31, quality));
  const t = (clamped - 1) / 30;
  // q=1 -> 90, q=31 -> 60. Mirrors the visual range of the previous
  // ffmpeg -q:v 38..68 mapping.
  return Math.round(90 - t * 30);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number) => void | Promise<void>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  let completed = 0;
  const poolSize = Math.min(Math.max(1, limit), items.length);

  async function runner() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
      completed += 1;
      if (onProgress) {
        await onProgress(completed);
      }
    }
  }

  await Promise.all(Array.from({ length: poolSize }, () => runner()));
  return results;
}

export function trickplayConcurrency() {
  // Half the cores, clamped to [2, 8]. The unified Docker image runs
  // Postgres, the worker, and SvelteKit on the same host, so we leave
  // headroom for everything else.
  const cores = os.cpus().length || 2;
  return Math.max(2, Math.min(8, Math.floor(cores / 2)));
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

export function buildPreviewAssetPatch(videoId: string) {
  return {
    thumbnailPath: videoAssetUrl(videoId, "thumb"),
    cardThumbnailPath: videoAssetUrl(videoId, "card"),
    previewPath: videoAssetUrl(videoId, "preview"),
    updatedAt: new Date(),
  };
}

export function buildTrickplayAssetPatch(videoId: string) {
  return {
    spritePath: videoAssetUrl(videoId, "sprite"),
    trickplayVttPath: videoAssetUrl(videoId, "trickplay"),
    updatedAt: new Date(),
  };
}

async function updateVideoAssetPaths(
  entityKind: VideoEntityKind,
  videoId: string,
  patch: Record<string, unknown>,
) {
  if (entityKind === "video_episode") {
    await db.update(videoEpisodes).set(patch).where(eq(videoEpisodes.id, videoId));
  } else {
    await db.update(videoMovies).set(patch).where(eq(videoMovies.id, videoId));
  }
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
      thumbnailPath: table.thumbnailPath,
      cardThumbnailPath: table.cardThumbnailPath,
      previewPath: table.previewPath,
      spritePath: table.spritePath,
      trickplayVttPath: table.trickplayVttPath,
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
  const isForceRebuild = payload.jobKind === "force-rebuild";
  const settings = await ensureLibrarySettingsRow();

  const filePath = resolveRequiredMediaPath(video.filePath!);

  const layout = videoGeneratedLayoutFromDedicated(
    settings.metadataStorageDedicated ?? true
  );
  const genPaths = getVideoGeneratedDiskPaths(video.id, filePath, layout);

  const thumbnailFile = genPaths.thumb;
  const previewFile = genPaths.preview;
  const spriteFile = genPaths.sprite;
  const trickplayFile = genPaths.trickplay;
  const cardFile = genPaths.card;

  // Existence test: a preview/trickplay phase is "already done" only when both
  // the DB columns are populated AND the artifacts still exist on disk. If a
  // user wiped /data, we must regenerate even though the row says we have
  // assets.
  const previewAssetsPresent =
    row.thumbnailPath != null &&
    row.cardThumbnailPath != null &&
    row.previewPath != null &&
    (await fileExists(thumbnailFile)) &&
    (await fileExists(cardFile)) &&
    (await fileExists(previewFile));
  const trickplayPresent =
    row.spritePath != null &&
    row.trickplayVttPath != null &&
    (await fileExists(spriteFile)) &&
    (await fileExists(trickplayFile));

  const shouldGeneratePreviewAssets =
    settings.autoGeneratePreview === true &&
    (isForceRebuild || !previewAssetsPresent);
  const shouldGenerateTrickplay =
    settings.generateTrickplay === true &&
    (isForceRebuild || !trickplayPresent);

  if (!shouldGeneratePreviewAssets && !shouldGenerateTrickplay) {
    await markJobProgress(job, "preview", 100);
    return;
  }

  const metadata = isForceRebuild
    ? await applyVideoProbeToVideoEntity(entityKind, video.id, filePath)
    : video.duration && video.width && video.height
      ? video
      : await probeVideoFile(filePath);

  if (isForceRebuild) {
    await markJobProgress(job, "preview", 12);
  }

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

  let assetPatch: Record<string, unknown> = { updatedAt: new Date() };

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
    assetPatch = { ...assetPatch, ...buildPreviewAssetPatch(video.id) };
    await updateVideoAssetPaths(entityKind, video.id, assetPatch);
    await markJobProgress(job, "preview", shouldGenerateTrickplay ? 65 : 100);
  }

  if (shouldGenerateTrickplay) {
    const gridColumns = Math.min(5, frameCount);
    const gridRows = Math.max(1, Math.ceil(frameCount / gridColumns));
    const jpegQuality = trickplayJpegQuality(trickQualityClamped);
    const sharpQuality = trickplaySharpQuality(trickQualityClamped);

    const tmpDir = path.join(
      os.tmpdir(),
      `obscura-trickplay-${video.id}-${randomUUID()}`,
    );
    await mkdir(tmpDir, { recursive: true });

    try {
      const frameIndexes = Array.from({ length: frameCount }, (_, index) => index);
      const framePaths = frameIndexes.map((index) =>
        path.join(tmpDir, `frame_${String(index).padStart(5, "0")}.jpg`),
      );

      const progressBase = shouldGeneratePreviewAssets ? 65 : 0;
      const progressSpan = shouldGeneratePreviewAssets ? 30 : 95;

      await mapWithConcurrency(
        frameIndexes,
        trickplayConcurrency(),
        async (index) => {
          try {
            await runProcess(
              "ffmpeg",
              buildTrickplayFrameFfmpegArgs({
                filePath,
                outputFile: framePaths[index]!,
                timestampSeconds: trickplayFrameTimestamp(
                  index,
                  frameInterval,
                  duration,
                ),
                frameWidth: plannedSpriteThumbWidth,
                frameHeight: plannedSpriteThumbHeight,
                jpegQuality,
              }),
            );
          } catch (err) {
            // Don't fail the whole job for a single bad frame — the
            // missing-file substitution below will fill the slot from a
            // neighbouring extracted frame.
            console.warn(
              `[preview] trickplay frame ${index} (t=${trickplayFrameTimestamp(index, frameInterval, duration).toFixed(1)}s) failed for ${entityKind} ${video.id}: ${(err as Error).message}`,
            );
          }
        },
        async (completed) => {
          if (completed === frameCount || completed % 8 === 0) {
            const pct =
              progressBase + Math.floor((completed / frameCount) * progressSpan);
            await markJobProgress(job, "preview", Math.min(95, pct));
          }
        },
      );

      // ffmpeg can silently exit 0 without writing the output (out-of-range
      // seek, unindexable region, single bad keyframe, …). Fill any missing
      // slot with the closest successfully-extracted neighbour so the strip
      // stays visually contiguous; if literally none came back, log and
      // skip trickplay for this video rather than crashing the preview job.
      const presence = await Promise.all(
        framePaths.map(async (p) => {
          try {
            const s = await stat(p);
            return s.size > 0;
          } catch {
            return false;
          }
        }),
      );
      const validIndexes = presence
        .map((ok, i) => (ok ? i : -1))
        .filter((i) => i >= 0);

      if (validIndexes.length === 0) {
        console.warn(
          `[preview] trickplay produced no usable frames for ${entityKind} ${video.id} — skipping sprite/VTT`,
        );
        await markJobProgress(job, "preview", 100);
        return;
      }

      function nearestValid(i: number): number {
        let lo = i, hi = i;
        while (lo >= 0 || hi < frameCount) {
          if (lo >= 0 && presence[lo]) return lo;
          if (hi < frameCount && presence[hi]) return hi;
          lo--;
          hi++;
        }
        return validIndexes[0]!;
      }

      const composites = framePaths.map((_input, index) => ({
        input: framePaths[presence[index] ? index : nearestValid(index)]!,
        left: (index % gridColumns) * plannedSpriteThumbWidth,
        top: Math.floor(index / gridColumns) * plannedSpriteThumbHeight,
      }));

      await sharp({
        create: {
          width: plannedSpriteThumbWidth * gridColumns,
          height: plannedSpriteThumbHeight * gridRows,
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
      })
        .composite(composites)
        .jpeg({ quality: sharpQuality, mozjpeg: true })
        .toFile(spriteFile);

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

      assetPatch = { ...assetPatch, ...buildTrickplayAssetPatch(video.id) };
      await updateVideoAssetPaths(entityKind, video.id, assetPatch);
      await markJobProgress(job, "preview", 100);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }
}
