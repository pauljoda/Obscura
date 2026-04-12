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
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { getCacheRootDir } from "@obscura/media-core";

/** Segment duration in seconds. Matches the ffmpeg `-force_key_frames`
 *  expression so each segment starts on a forced IDR frame. */
export const SEGMENT_DURATION = 6;

interface VirtualHlsCacheMeta {
  sourcePath: string;
  sourceSize: number;
  sourceMtimeMs: number;
  duration: number;
}

function getCacheDir(sceneId: string) {
  return path.join(getCacheRootDir(), "hls2", sceneId);
}

function getSegmentPath(sceneId: string, segIndex: number) {
  return path.join(getCacheDir(sceneId), `seg_${String(segIndex).padStart(5, "0")}.ts`);
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

/** Build a master playlist pointing at the single variant. One rendition
 *  for now — the focus is correct scrubbing, not adaptive bitrate. */
export function buildMasterPlaylist(opts: {
  width: number | null;
  height: number | null;
}): string {
  const resolution =
    opts.width && opts.height ? `,RESOLUTION=${opts.width}x${opts.height}` : "";
  // Rough single-variant bandwidth. hls.js only uses this for ABR decisions;
  // since we expose one variant there's no switching to do.
  const bandwidth = 4_000_000;
  return [
    "#EXTM3U",
    "#EXT-X-VERSION:6",
    `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth}${resolution}`,
    "v/index.m3u8",
    "",
  ].join("\n");
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
    };
    await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
  }
}

/** Promise cache so concurrent requests for the same segment share one
 *  ffmpeg invocation instead of racing to write the same file. Key:
 *  `${sceneId}/${segIndex}`. */
const inflight = new Map<string, Promise<string>>();

function encodeSegment(
  sceneId: string,
  sourcePath: string,
  segIndex: number,
): Promise<string> {
  const outputPath = getSegmentPath(sceneId, segIndex);
  const segStart = segIndex * SEGMENT_DURATION;

  // Fast input-side `-ss`: ffmpeg jumps to the nearest preceding keyframe
  // before decoding starts. Orders of magnitude faster than accurate seek
  // (`-ss` after `-i`) on long files — the small A/V alignment cost at the
  // cut is negligible for scrubbing UX.
  //
  // Each segment is a completely fresh libx264 encode, which guarantees an
  // IDR frame at output frame 0 without any `-force_key_frames` wrangling.
  // We deliberately do NOT use `-copyts`: each segment's PTS starts at 0
  // and hls.js's built-in per-segment PTS rebasing lines it up against the
  // playlist's EXTINF timeline when it appends to MSE.
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
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
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
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ac",
    "2",
    "-ar",
    "48000",
    "-muxdelay",
    "0",
    "-muxpreload",
    "0",
    "-f",
    "mpegts",
    outputPath,
  ];

  return new Promise<string>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 8192) stderr = stderr.slice(-8192);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(outputPath);
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
}

/** Return the on-disk path for the given segment, transcoding it first if
 *  it isn't already cached. Concurrent requests for the same segment share
 *  one ffmpeg invocation via the `inflight` map. */
export async function getSegment(
  sceneId: string,
  sourcePath: string,
  duration: number,
  segIndex: number,
): Promise<string> {
  const total = segmentCount(duration);
  if (segIndex < 0 || segIndex >= total) {
    throw new Error(`segment index ${segIndex} out of range (0..${total - 1})`);
  }

  await ensureCacheDir(sceneId, sourcePath, duration);

  const outputPath = getSegmentPath(sceneId, segIndex);
  if (existsSync(outputPath)) return outputPath;

  const key = `${sceneId}/${segIndex}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  log(sceneId, `encode segment ${segIndex} (t=${segIndex * SEGMENT_DURATION}s)`);
  const promise = encodeSegment(sceneId, sourcePath, segIndex).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

/** Test hook: clear the in-memory inflight map. */
export function resetVirtualHlsInflight() {
  inflight.clear();
}
