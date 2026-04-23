import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { getCacheRootDir, runProcess } from "@obscura/media-core";
import { HLS_RETRY_AFTER_SECONDS } from "@obscura/contracts/media";
import { schema, type AppDb } from "@obscura/db";
import { getHlsStatus, peekHlsTracker, startHlsGeneration } from "../../../../api/src/lib/hls";
import {
  buildMasterPlaylist as buildVirtualMaster,
  buildVariantPlaylist as buildVirtualVariant,
  getSegment as getVirtualSegment,
  getVirtualHlsRenditions,
  segmentCount as virtualSegmentCount,
} from "../../../../api/src/lib/hls-virtual";

const { videoEpisodes, videoMovies } = schema;

const BROWSER_NATIVE = new Set([".mp4", ".webm", ".ogg", ".m4v"]);
const NEEDS_TRANSCODE = new Set([".mkv", ".avi", ".wmv", ".flv", ".mov", ".ts", ".m2ts"]);

const REMUXABLE_VIDEO_CODECS = new Set(["h264", "h265", "hevc", "vp9", "av1"]);
const REMUXABLE_AUDIO_CODECS = new Set(["aac", "mp3", "opus", "flac", "vorbis"]);

interface VideoSource {
  id: string;
  filePath: string;
  duration: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
}

interface RemuxCacheMetadata {
  sourcePath: string;
  sourceSize: number;
  sourceMtimeMs: number;
  mode: "remux" | "transcode";
}

const remuxLocks = new Map<string, Promise<string>>();

function mimeForExt(ext: string): string {
  switch (ext) {
    case ".m3u8":
      return "application/vnd.apple.mpegurl";
    case ".ts":
      return "video/mp2t";
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".ogg":
    case ".ogv":
      return "video/ogg";
    case ".mov":
      return "video/quicktime";
    default:
      return "application/octet-stream";
  }
}

function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return Response.json({ error, ...extra }, { status });
}

function toResponseStream(filePath: string, headers: HeadersInit, status = 200): Response {
  const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(body, { status, headers });
}

function sendRangeStreamResponse(filePath: string, range: string | null): Response {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeForExt(ext);
  const fileSize = statSync(filePath).size;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = Number.parseInt(parts[0] ?? "0", 10);
    const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end < start ||
      end >= fileSize
    ) {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${fileSize}`,
          "Accept-Ranges": "bytes",
        },
      });
    }

    const body = Readable.toWeb(
      createReadStream(filePath, { start, end }),
    ) as ReadableStream;
    return new Response(body, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Content-Type": contentType,
      },
    });
  }

  return toResponseStream(filePath, {
    "Content-Length": String(fileSize),
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
  });
}

function resolveAssetPath(rootDir: string, assetPath: string) {
  const resolved = path.resolve(rootDir, assetPath);
  const normalizedRoot = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;
  if (resolved !== rootDir && !resolved.startsWith(normalizedRoot)) {
    return null;
  }
  return resolved;
}

function getRemuxCacheDir() {
  return path.join(getCacheRootDir(), "remux");
}

function getRemuxCachePath(id: string) {
  return path.join(getRemuxCacheDir(), `${id}.mp4`);
}

function getRemuxMetadataPath(id: string) {
  return path.join(getRemuxCacheDir(), `${id}.json`);
}

async function getVideoSource(db: AppDb, id: string): Promise<VideoSource | null> {
  const [episode] = await db
    .select({
      id: videoEpisodes.id,
      filePath: videoEpisodes.filePath,
      duration: videoEpisodes.duration,
      width: videoEpisodes.width,
      height: videoEpisodes.height,
      codec: videoEpisodes.codec,
    })
    .from(videoEpisodes)
    .where(eq(videoEpisodes.id, id))
    .limit(1);

  if (episode?.filePath && existsSync(episode.filePath)) {
    return episode;
  }

  const [movie] = await db
    .select({
      id: videoMovies.id,
      filePath: videoMovies.filePath,
      duration: videoMovies.duration,
      width: videoMovies.width,
      height: videoMovies.height,
      codec: videoMovies.codec,
    })
    .from(videoMovies)
    .where(eq(videoMovies.id, id))
    .limit(1);

  if (movie?.filePath && existsSync(movie.filePath)) {
    return movie;
  }

  return null;
}

async function probeCodecs(filePath: string): Promise<{ video: string | null; audio: string | null }> {
  try {
    const { stdout } = await runProcess("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=codec_name",
      "-of",
      "csv=p=0",
      filePath,
    ]);
    const videoCodec = stdout.trim().split("\n")[0]?.trim() || null;
    let audioCodec: string | null = null;
    try {
      const { stdout: audioOut } = await runProcess("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=codec_name",
        "-of",
        "csv=p=0",
        filePath,
      ]);
      audioCodec = audioOut.trim().split("\n")[0]?.trim() || null;
    } catch {
      // no audio stream is fine
    }
    return { video: videoCodec, audio: audioCodec };
  } catch {
    return { video: null, audio: null };
  }
}

async function isCacheFresh(id: string, sourcePath: string): Promise<boolean> {
  const metaPath = getRemuxMetadataPath(id);
  const cachePath = getRemuxCachePath(id);
  if (!existsSync(metaPath) || !existsSync(cachePath)) return false;

  try {
    const raw = await readFile(metaPath, "utf8");
    const meta = JSON.parse(raw) as RemuxCacheMetadata;
    const sourceStats = await stat(sourcePath);
    return (
      meta.sourcePath === sourcePath &&
      meta.sourceSize === sourceStats.size &&
      meta.sourceMtimeMs === sourceStats.mtimeMs
    );
  } catch {
    return false;
  }
}

async function buildRemuxCache(id: string, sourcePath: string): Promise<string> {
  const cacheDir = getRemuxCacheDir();
  await mkdir(cacheDir, { recursive: true });
  const cachePath = getRemuxCachePath(id);
  if (await isCacheFresh(id, sourcePath)) return cachePath;

  const codecs = await probeCodecs(sourcePath);
  const canRemux =
    codecs.video !== null &&
    REMUXABLE_VIDEO_CODECS.has(codecs.video) &&
    (codecs.audio === null || REMUXABLE_AUDIO_CODECS.has(codecs.audio));

  if (canRemux) {
    await runProcess("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostats",
      "-y",
      "-i",
      sourcePath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      "-f",
      "mp4",
      cachePath,
    ]);
  } else {
    await runProcess("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostats",
      "-y",
      "-i",
      sourcePath,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-movflags",
      "+faststart",
      "-f",
      "mp4",
      cachePath,
    ]);
  }

  const sourceStats = await stat(sourcePath);
  const metadata: RemuxCacheMetadata = {
    sourcePath,
    sourceSize: sourceStats.size,
    sourceMtimeMs: sourceStats.mtimeMs,
    mode: canRemux ? "remux" : "transcode",
  };
  await writeFile(
    getRemuxMetadataPath(id),
    JSON.stringify(metadata, null, 2),
    "utf8",
  );
  return cachePath;
}

async function ensureRemuxCache(id: string, sourcePath: string): Promise<string> {
  const existing = remuxLocks.get(id);
  if (existing) return existing;
  const pending = buildRemuxCache(id, sourcePath).finally(() => {
    remuxLocks.delete(id);
  });
  remuxLocks.set(id, pending);
  return pending;
}

export async function serveVideoSource(
  db: AppDb,
  id: string,
  range: string | null,
): Promise<Response> {
  const video = await getVideoSource(db, id);
  if (!video?.filePath) {
    return jsonError(404, "Video file not found on disk");
  }

  const ext = path.extname(video.filePath).toLowerCase();
  if (NEEDS_TRANSCODE.has(ext) && !BROWSER_NATIVE.has(ext)) {
    const cachedPath = await ensureRemuxCache(video.id, video.filePath);
    return sendRangeStreamResponse(cachedPath, range);
  }

  return sendRangeStreamResponse(video.filePath, range);
}

export async function serveHlsStatus(db: AppDb, id: string): Promise<Response> {
  const video = await getVideoSource(db, id);
  if (!video?.filePath) {
    return jsonError(404, "Video file not found on disk");
  }

  const status = await getHlsStatus(id, video.filePath, video.height);
  return Response.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function serveLegacyHlsAsset(
  db: AppDb,
  id: string,
  assetPath: string,
): Promise<Response> {
  const video = await getVideoSource(db, id);
  if (!video?.filePath) {
    return jsonError(404, "Video file not found on disk");
  }

  if (assetPath === "master.m3u8") {
    const status = await getHlsStatus(id, video.filePath, video.height);
    if (status.state === "error") {
      return jsonError(500, status.error ?? "HLS generation failed");
    }
    if (status.state !== "ready") {
      void startHlsGeneration(id, video.filePath, video.height).catch(() => {});
      return jsonError(503, "HLS package is still being generated", {
        retryAfter: HLS_RETRY_AFTER_SECONDS,
      });
    }

    const cacheDir = path.join(getCacheRootDir(), "hls", id);
    const masterManifestPath = path.join(cacheDir, "master.m3u8");
    if (!existsSync(masterManifestPath)) {
      void startHlsGeneration(id, video.filePath, video.height).catch(() => {});
      return jsonError(503, "HLS manifest missing on disk", {
        retryAfter: HLS_RETRY_AFTER_SECONDS,
      });
    }

    const tracker = peekHlsTracker(id);
    return toResponseStream(
      masterManifestPath,
      {
        "Cache-Control": tracker?.isEncodeActive ? "no-store" : "public, max-age=60",
        "Content-Type": mimeForExt(".m3u8"),
      },
    );
  }

  const tracker = peekHlsTracker(id);
  if (!tracker || tracker.state === "pending") {
    return jsonError(503, "HLS package not ready", {
      retryAfter: HLS_RETRY_AFTER_SECONDS,
    });
  }
  if (tracker.state === "error") {
    return jsonError(500, tracker.error ?? "HLS generation failed");
  }

  const cacheDir = path.join(getCacheRootDir(), "hls", id);
  const resolvedAsset = resolveAssetPath(cacheDir, assetPath);
  if (!resolvedAsset || !existsSync(resolvedAsset)) {
    return jsonError(404, "Stream asset not found");
  }

  const ext = path.extname(resolvedAsset).toLowerCase();
  const latest = peekHlsTracker(id);
  return toResponseStream(resolvedAsset, {
    "Cache-Control": ext === ".m3u8" && latest?.isEncodeActive ? "no-store" : "public, max-age=300",
    "Content-Type": mimeForExt(ext),
  });
}

export async function serveVirtualHlsAsset(
  db: AppDb,
  id: string,
  assetPath: string,
): Promise<Response> {
  const video = await getVideoSource(db, id);
  if (!video?.filePath) {
    return jsonError(404, "Video file not found on disk");
  }
  if (!video.duration || video.duration <= 0) {
    return jsonError(409, "Video has no probed duration yet");
  }

  if (assetPath === "master.m3u8") {
    const body = buildVirtualMaster({
      width: video.width,
      height: video.height,
      renditions: getVirtualHlsRenditions(video.height),
    });
    return new Response(body, {
      headers: {
        "Content-Type": mimeForExt(".m3u8"),
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const parts = assetPath.split("/");
  if (parts.length === 3 && parts[0] === "v" && parts[2] === "index.m3u8") {
    const body = buildVirtualVariant(video.duration);
    return new Response(body, {
      headers: {
        "Content-Type": mimeForExt(".m3u8"),
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  if (parts.length !== 3 || parts[0] !== "v") {
    return jsonError(404, "Unknown HLS asset");
  }

  const renditionName = parts[1] ?? "";
  const fileName = parts[2] ?? "";
  const renditions = getVirtualHlsRenditions(video.height);
  const selectedRendition = renditions.find((entry) => entry.name === renditionName);
  if (!selectedRendition) {
    return jsonError(404, "Unknown rendition");
  }

  const match = /^seg_(\d+)\.ts$/.exec(fileName);
  if (!match) {
    return jsonError(404, "Unknown segment file");
  }

  const segIndex = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(segIndex) || segIndex < 0) {
    return jsonError(400, "Invalid segment index");
  }

  const total = virtualSegmentCount(video.duration);
  if (segIndex >= total) {
    return jsonError(404, `segment index ${segIndex} out of range (0..${total - 1})`);
  }

  try {
    const segmentPath = await getVirtualSegment(
      video.id,
      video.filePath,
      video.duration,
      selectedRendition,
      segIndex,
    );
    return toResponseStream(segmentPath, {
      "Content-Type": "video/mp2t",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : String(err));
  }
}
