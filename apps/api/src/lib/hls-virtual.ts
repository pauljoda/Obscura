// Virtual HLS: serve a full-length VOD playlist upfront, transcode segments
// on demand. This is the approach Jellyfin / Plex / Emby use so scrubbing
// anywhere in the timeline is instant: the player always sees a complete
// playlist covering the whole scene, and each segment is synthesized by a
// short (~1s) ffmpeg invocation the first time it's requested, then cached
// to disk.
//
// Intentionally independent of `hls.ts` (the linear progressive encoder).
// Adding this alongside the existing path keeps the blast radius small.

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getCacheRootDir } from "@obscura/media-core";
import { getHlsRenditions, type HlsRendition } from "@obscura/contracts/media";

/** Segment duration in seconds. Matches the ffmpeg `-force_key_frames`
 *  expression so each segment starts on a forced IDR frame. */
export const SEGMENT_DURATION = 6;

interface VirtualHlsCacheMeta {
  sourcePath: string;
  sourceSize: number;
  sourceMtimeMs: number;
  duration: number;
  renditions: HlsRendition[];
}

function getCacheDir(sceneId: string) {
  return path.join(getCacheRootDir(), "hls2", sceneId);
}

function getVariantDir(sceneId: string, renditionName: string) {
  return path.join(getCacheDir(sceneId), renditionName);
}

function getSegmentPath(sceneId: string, renditionName: string, segIndex: number) {
  return path.join(
    getVariantDir(sceneId, renditionName),
    `seg_${String(segIndex).padStart(5, "0")}.ts`,
  );
}

function getMetaPath(sceneId: string) {
  return path.join(getCacheDir(sceneId), "meta.json");
}

function log(sceneId: string, message: string) {
  // eslint-disable-next-line no-console
  console.log(`[hls2 ${sceneId.slice(0, 8)}] ${message}`);
}

/** Returns the total segment count for a scene of `duration` seconds. */
export function segmentCount(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.ceil(duration / SEGMENT_DURATION);
}

/** Duration (in seconds) of segment `index` — the last segment is usually
 *  shorter than `SEGMENT_DURATION`. */
export function segmentDuration(duration: number, index: number): number {
  const total = segmentCount(duration);
  if (index < 0 || index >= total) return 0;
  if (index < total - 1) return SEGMENT_DURATION;
  const lastDuration = duration - (total - 1) * SEGMENT_DURATION;
  return lastDuration > 0 ? lastDuration : SEGMENT_DURATION;
}

function toBitsPerSecond(rate: string): number {
  const match = /^(\d+)([kKmM])$/.exec(rate.trim());
  if (!match) return Number.parseInt(rate, 10) || 0;
  const value = Number.parseInt(match[1] ?? "0", 10);
  const unit = (match[2] ?? "k").toLowerCase();
  return unit === "m" ? value * 1_000_000 : value * 1_000;
}

function scaledWidth(
  sourceWidth: number | null,
  sourceHeight: number | null,
  targetHeight: number,
): number | null {
  if (!sourceWidth || !sourceHeight || targetHeight <= 0) return null;
  const raw = Math.round((sourceWidth / sourceHeight) * targetHeight);
  return raw % 2 === 0 ? raw : raw - 1;
}

export function getVirtualHlsRenditions(sourceHeight: number | null | undefined): HlsRendition[] {
  return getHlsRenditions(sourceHeight);
}

/** Build a master playlist pointing at every supported rendition so hls.js
 *  can expose a quality list even though the segments are still generated on
 *  demand. */
export function buildMasterPlaylist(opts: {
  width: number | null;
  height: number | null;
  renditions: readonly HlsRendition[];
}): string {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:6"];
  for (const rendition of opts.renditions) {
    const width = scaledWidth(opts.width, opts.height, rendition.height);
    const resolution = width ? `,RESOLUTION=${width}x${rendition.height}` : "";
    const bandwidth = toBitsPerSecond(rendition.maxRate);
    const averageBandwidth = toBitsPerSecond(rendition.videoBitrate);
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},AVERAGE-BANDWIDTH=${averageBandwidth}${resolution},CODECS="avc1.4d401f,mp4a.40.2"`,
      `v/${rendition.name}/index.m3u8`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

/** Build the variant playlist listing every segment of the scene upfront.
 *  Because `#EXT-X-ENDLIST` is emitted the player treats the stream as VOD
 *  from the first request — `video.seekable` covers the whole duration and
 *  scrubbing is a plain byte-range-like seek from the player's perspective. */
export function buildVariantPlaylist(duration: number): string {
  const total = segmentCount(duration);
  const lines: string[] = [
    "#EXTM3U",
    "#EXT-X-VERSION:6",
    "#EXT-X-PLAYLIST-TYPE:VOD",
    `#EXT-X-TARGETDURATION:${SEGMENT_DURATION + 1}`,
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXT-X-INDEPENDENT-SEGMENTS",
  ];
  for (let i = 0; i < total; i += 1) {
    const dur = segmentDuration(duration, i).toFixed(3);
    lines.push(`#EXTINF:${dur},`);
    lines.push(`seg_${String(i).padStart(5, "0")}.ts`);
  }
  lines.push("#EXT-X-ENDLIST");
  lines.push("");
  return lines.join("\n");
}

async function isCacheFresh(sceneId: string, sourcePath: string): Promise<boolean> {
  const metaPath = getMetaPath(sceneId);
  if (!existsSync(metaPath)) return false;
  try {
    const meta = JSON.parse(await readFile(metaPath, "utf8")) as VirtualHlsCacheMeta;
    const stats = await stat(sourcePath);
    return (
      meta.sourcePath === sourcePath &&
      meta.sourceSize === stats.size &&
      meta.sourceMtimeMs === stats.mtimeMs
    );
  } catch {
    return false;
  }
}

async function ensureCacheDir(
  sceneId: string,
  sourcePath: string,
  duration: number,
  renditions: readonly HlsRendition[],
): Promise<void> {
  const cacheDir = getCacheDir(sceneId);
  const metaPath = getMetaPath(sceneId);
  if (!(await isCacheFresh(sceneId, sourcePath))) {
    // Source changed (replaced or re-scanned) — wipe any stale segments.
    await rm(cacheDir, { recursive: true, force: true });
  }
  await mkdir(cacheDir, { recursive: true });
  if (!existsSync(metaPath)) {
    const stats = await stat(sourcePath);
    const meta: VirtualHlsCacheMeta = {
      sourcePath,
      sourceSize: stats.size,
      sourceMtimeMs: stats.mtimeMs,
      duration,
      renditions: renditions.map((rendition) => ({ ...rendition })),
    };
    await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
  }
}

/** Promise cache so concurrent requests for the same segment share one
 *  ffmpeg invocation instead of racing to write the same file. Key:
 *  `${sceneId}/${segIndex}`. */
const inflight = new Map<string, Promise<string>>();

async function encodeSegment(
  sceneId: string,
  sourcePath: string,
  rendition: HlsRendition,
  segIndex: number,
): Promise<string> {
  const outputPath = getSegmentPath(sceneId, rendition.name, segIndex);
  const tmpPath = `${outputPath}.${randomUUID()}.tmp`;
  const segStart = segIndex * SEGMENT_DURATION;
  await mkdir(path.dirname(outputPath), { recursive: true });

  // Fast input-side `-ss`: ffmpeg jumps to the nearest preceding keyframe
  // before decoding starts. Orders of magnitude faster than accurate seek
  // (`-ss` after `-i`) on long files.
  //
  // Each segment is a fresh libx264 encode so frame 0 is naturally an IDR.
  //
  // `-output_ts_offset segStart` (without `-copyts`) shifts the output's
  // zero-based PTS to the segment's absolute position in the scene, so
  // adjacent segments carry continuous global PTS and MSE can stitch them
  // without needing EXT-X-DISCONTINUITY markers. We deliberately do NOT
  // use `-copyts` here: combined with an MKV/HEVC source and input-side
  // `-ss`, `-copyts` can make ffmpeg's `-t` filter drop every frame and
  // write a 0-byte output file. `-output_ts_offset` alone is the
  // well-supported path.
  //
  // Write to a tmp file and rename into place on success so a failed
  // encode can never leave a broken 0-byte segment in the cache.
  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostats",
    "-ss",
    segStart.toFixed(3),
    "-i",
    sourcePath,
    "-t",
    String(SEGMENT_DURATION),
    "-vf",
    `scale=w=-2:h=${rendition.height}:force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p`,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    String(rendition.crf),
    "-profile:v",
    "main",
    "-pix_fmt",
    "yuv420p",
    "-g",
    "144",
    "-keyint_min",
    "144",
    "-sc_threshold",
    "0",
    "-b:v",
    rendition.videoBitrate,
    "-maxrate",
    rendition.maxRate,
    "-bufsize",
    rendition.bufferSize,
    "-c:a",
    "aac",
    "-b:a",
    rendition.audioBitrate,
    "-ac",
    "2",
    "-ar",
    "48000",
    "-output_ts_offset",
    segStart.toFixed(3),
    "-muxdelay",
    "0",
    "-muxpreload",
    "0",
    "-f",
    "mpegts",
    tmpPath,
  ];

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
        if (stderr.length > 8192) stderr = stderr.slice(-8192);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(
          new Error(
            `ffmpeg seg ${segIndex} exited with code ${code ?? "unknown"}${
              stderr ? `: ${stderr.trim()}` : ""
            }`,
          ),
        );
      });
    });

    // Defensive: some ffmpeg failure modes exit 0 but leave an empty file
    // (see the `-copyts` pitfall above). Treat a zero-byte output as an
    // encode failure so the cache stays clean.
    const stats = await stat(tmpPath);
    if (stats.size === 0) {
      await unlink(tmpPath).catch(() => {});
      throw new Error(`ffmpeg seg ${segIndex} produced an empty file`);
    }

    await rename(tmpPath, outputPath);
    return outputPath;
  } catch (err) {
    await unlink(tmpPath).catch(() => {});
    throw err;
  }
}

/** Return the on-disk path for the given segment, transcoding it first if
 *  it isn't already cached. Concurrent requests for the same segment share
 *  one ffmpeg invocation via the `inflight` map. */
export async function getSegment(
  sceneId: string,
  sourcePath: string,
  duration: number,
  rendition: HlsRendition,
  segIndex: number,
): Promise<string> {
  const total = segmentCount(duration);
  if (segIndex < 0 || segIndex >= total) {
    throw new Error(`segment index ${segIndex} out of range (0..${total - 1})`);
  }

  await ensureCacheDir(sceneId, sourcePath, duration, [rendition]);

  const outputPath = getSegmentPath(sceneId, rendition.name, segIndex);
  if (existsSync(outputPath)) return outputPath;

  const key = `${sceneId}/${rendition.name}/${segIndex}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  log(sceneId, `encode ${rendition.name} segment ${segIndex} (t=${segIndex * SEGMENT_DURATION}s)`);
  const promise = encodeSegment(sceneId, sourcePath, rendition, segIndex).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

/** Test hook: clear the in-memory inflight map. */
export function resetVirtualHlsInflight() {
  inflight.clear();
}
