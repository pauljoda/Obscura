import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import {
  getCacheRootDir,
  resolveExistingMediaPath,
  runProcess,
} from "@obscura/media-core";
import {
  buildMasterPlaylist as buildVirtualMaster,
  buildVariantPlaylist as buildVirtualVariant,
  getHlsStatus,
  getSegment as getVirtualSegment,
  getVirtualHlsRenditions,
  peekHlsTracker,
  segmentCount as virtualSegmentCount,
  startHlsGeneration,
} from "@obscura/app-core";
import { HLS_RETRY_AFTER_SECONDS } from "@obscura/contracts/media";
import { schema, type AppDb } from "@obscura/db";

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
  mode: "remux" | "audio-transcode" | "transcode";
}

const remuxLocks = new Map<string, Promise<string>>();
const REMUX_BUILD_RETRY_AFTER_SECONDS = 1;

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

function preparingDirectSourceResponse() {
  return Response.json(
    {
      error: "Direct source is still being prepared",
      retryAfter: REMUX_BUILD_RETRY_AFTER_SECONDS,
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(REMUX_BUILD_RETRY_AFTER_SECONDS),
      },
    },
  );
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

function parseRangeStart(range: string | null): number | null {
  if (!range?.startsWith("bytes=")) return null;
  const [startRaw] = range.slice("bytes=".length).split("-", 1);
  if (!startRaw) return 0;
  const start = Number.parseInt(startRaw, 10);
  return Number.isFinite(start) ? start : null;
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

  const episodePath = resolveExistingMediaPath(episode?.filePath);
  if (episode && episodePath) {
    return { ...episode, filePath: episodePath };
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

  const moviePath = resolveExistingMediaPath(movie?.filePath);
  if (movie && moviePath) {
    return { ...movie, filePath: moviePath };
  }

  return null;
}

async function probeCodecs(filePath: string): Promise<{ video: string | null; audio: string | null }> {
  const parseCodecName = (stdout: string) => {
    const raw = stdout.trim().split("\n")[0]?.trim();
    return raw?.split(",")[0]?.trim().toLowerCase() || null;
  };

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
    const videoCodec = parseCodecName(stdout);
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
      audioCodec = parseCodecName(audioOut);
    } catch {
      // no audio stream is fine
    }
    return { video: videoCodec, audio: audioCodec };
  } catch {
    return { video: null, audio: null };
  }
}

function getDirectPrepareMode(codecs: {
  video: string | null;
  audio: string | null;
}): RemuxCacheMetadata["mode"] {
  const videoCanCopy =
    codecs.video !== null && REMUXABLE_VIDEO_CODECS.has(codecs.video);
  const audioCanCopy =
    codecs.audio === null || REMUXABLE_AUDIO_CODECS.has(codecs.audio);
  return videoCanCopy
    ? (audioCanCopy ? "remux" : "audio-transcode")
    : "transcode";
}

function isHevcCodec(codec: string | null): boolean {
  const normalized = codec?.trim().toLowerCase();
  return normalized === "hevc" || normalized === "h265" || normalized === "h.265";
}

function appendHevcMp4TagIfNeeded(args: string[], codecs: { video: string | null }) {
  if (isHevcCodec(codecs.video)) {
    args.push("-tag:v", "hvc1");
  }
}

async function isCacheFresh(id: string, sourcePath: string): Promise<boolean> {
  const metaPath = getRemuxMetadataPath(id);
  const cachePath = getRemuxCachePath(id);
  if (!existsSync(metaPath) || !existsSync(cachePath)) return false;

  try {
    const raw = await readFile(metaPath, "utf8");
    const meta = JSON.parse(raw) as RemuxCacheMetadata;
    const [sourceStats, cacheStats] = await Promise.all([
      stat(sourcePath),
      stat(cachePath),
    ]);
    return (
      cacheStats.size > 0 &&
      meta.sourcePath === sourcePath &&
      meta.sourceSize === sourceStats.size &&
      meta.sourceMtimeMs === sourceStats.mtimeMs
    );
  } catch {
    return false;
  }
}

async function isPlayableMp4(filePath: string): Promise<boolean> {
  if (!existsSync(filePath)) return false;
  try {
    const { stdout } = await runProcess("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=format_name",
      "-of",
      "default=nk=1:nw=1",
      filePath,
    ]);
    return stdout.includes("mov,mp4");
  } catch {
    return false;
  }
}

async function writeRemuxMetadata(
  id: string,
  sourcePath: string,
  mode: RemuxCacheMetadata["mode"],
): Promise<void> {
  const sourceStats = await stat(sourcePath);
  const metadata: RemuxCacheMetadata = {
    sourcePath,
    sourceSize: sourceStats.size,
    sourceMtimeMs: sourceStats.mtimeMs,
    mode,
  };
  await writeFile(
    getRemuxMetadataPath(id),
    JSON.stringify(metadata, null, 2),
    "utf8",
  );
}

async function getReadyRemuxCache(
  id: string,
  sourcePath: string,
): Promise<string | null> {
  const cachePath = getRemuxCachePath(id);
  if (await isCacheFresh(id, sourcePath)) {
    return cachePath;
  }
  if (!existsSync(cachePath)) {
    return null;
  }
  try {
    const [sourceStats, cacheStats] = await Promise.all([
      stat(sourcePath),
      stat(cachePath),
    ]);
    if (cacheStats.size <= 0 || cacheStats.mtimeMs + 1000 < sourceStats.mtimeMs) {
      return null;
    }
  } catch {
    return null;
  }
  if (!(await isPlayableMp4(cachePath))) {
    return null;
  }
  await writeRemuxMetadata(id, sourcePath, "transcode");
  return cachePath;
}

async function buildRemuxCache(id: string, sourcePath: string): Promise<string> {
  const cacheDir = getRemuxCacheDir();
  await mkdir(cacheDir, { recursive: true });
  const cachePath = getRemuxCachePath(id);
  const readyCache = await getReadyRemuxCache(id, sourcePath);
  if (readyCache) return readyCache;

  const codecs = await probeCodecs(sourcePath);
  const mode = getDirectPrepareMode(codecs);
  const tempPath = `${cachePath}.${Date.now()}.tmp`;
  const ffmpegArgs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostats",
    "-y",
    "-i",
    sourcePath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-sn",
    "-dn",
  ];

  if (mode === "remux") {
    ffmpegArgs.push(
      "-c:v",
      "copy",
      "-c:a",
      "copy",
    );
  } else if (mode === "audio-transcode") {
    ffmpegArgs.push(
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
    );
  } else {
    ffmpegArgs.push(
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
    );
  }

  if (mode !== "transcode") {
    appendHevcMp4TagIfNeeded(ffmpegArgs, codecs);
  }

  ffmpegArgs.push(
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
    tempPath,
  );

  try {
    await runProcess("ffmpeg", ffmpegArgs);
    await rename(tempPath, cachePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
  await writeRemuxMetadata(id, sourcePath, mode);
  return cachePath;
}

async function streamPreparedVideoSource(sourcePath: string): Promise<Response> {
  const codecs = await probeCodecs(sourcePath);
  const mode = getDirectPrepareMode(codecs);
  const ffmpegArgs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostats",
    "-i",
    sourcePath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-sn",
    "-dn",
  ];

  if (mode === "remux") {
    ffmpegArgs.push(
      "-c:v",
      "copy",
      "-c:a",
      "copy",
    );
  } else if (mode === "audio-transcode") {
    ffmpegArgs.push(
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
    );
  } else {
    ffmpegArgs.push(
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
    );
  }

  if (mode !== "transcode") {
    appendHevcMp4TagIfNeeded(ffmpegArgs, codecs);
  }

  ffmpegArgs.push(
    "-movflags",
    "frag_keyframe+empty_moov+default_base_moof",
    "-f",
    "mp4",
    "pipe:1",
  );

  const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  let finished = false;

  ffmpeg.stderr.setEncoding("utf8");
  ffmpeg.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      ffmpeg.stdout.on("data", (chunk: Buffer) => {
        if (finished) return;
        controller.enqueue(new Uint8Array(chunk));
      });
      ffmpeg.stdout.on("end", () => {
        if (finished) return;
        finished = true;
        controller.close();
      });
      ffmpeg.on("error", (error) => {
        if (finished) return;
        finished = true;
        controller.error(error);
      });
      ffmpeg.on("close", (code) => {
        if (finished) return;
        finished = true;
        if (code === 0 || code === null) {
          controller.close();
          return;
        }
        controller.error(
          new Error(stderr.trim() || `ffmpeg exited with code ${code}`),
        );
      });
    },
    cancel() {
      if (finished) return;
      finished = true;
      ffmpeg.kill("SIGKILL");
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "video/mp4",
    },
  });
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
    const cachedPath = await getReadyRemuxCache(video.id, video.filePath);
    if (cachedPath) {
      return sendRangeStreamResponse(cachedPath, range);
    }
    const rangeStart = parseRangeStart(range);
    if (!range || rangeStart === 0) {
      return streamPreparedVideoSource(video.filePath);
    }
    void ensureRemuxCache(video.id, video.filePath).catch(() => {});
    return preparingDirectSourceResponse();
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
