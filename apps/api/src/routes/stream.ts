import type { FastifyInstance, FastifyReply } from "fastify";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, stat, writeFile, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { ensureHlsPackage } from "../lib/hls";
import { getCacheRootDir, runProcess } from "@obscura/media-core";

const { scenes } = schema;

const BROWSER_NATIVE = new Set([".mp4", ".webm", ".ogg", ".m4v"]);
const NEEDS_TRANSCODE = new Set([".mkv", ".avi", ".wmv", ".flv", ".mov", ".ts", ".m2ts"]);

/** Codecs the browser can play natively inside an MP4 container */
const REMUXABLE_VIDEO_CODECS = new Set(["h264", "h265", "hevc", "vp9", "av1"]);
const REMUXABLE_AUDIO_CODECS = new Set(["aac", "mp3", "opus", "flac", "vorbis"]);

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

async function getSceneSource(id: string) {
  const scene = await db.query.scenes.findFirst({
    where: eq(scenes.id, id),
    columns: {
      id: true,
      filePath: true,
      height: true,
      codec: true,
    },
  });

  if (!scene?.filePath) {
    return null;
  }

  if (!existsSync(scene.filePath)) {
    return null;
  }

  return scene;
}

function sendRangeStream(reply: FastifyReply, filePath: string, range?: string) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeForExt(ext);
  const fileSize = statSync(filePath).size;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    reply.code(206);
    reply.header("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    reply.header("Accept-Ranges", "bytes");
    reply.header("Content-Length", chunkSize);
    reply.header("Content-Type", contentType);

    return reply.send(createReadStream(filePath, { start, end }));
  }

  reply.header("Content-Length", fileSize);
  reply.header("Content-Type", contentType);
  reply.header("Accept-Ranges", "bytes");

  return reply.send(createReadStream(filePath));
}

// ─── Cached remux / transcode ──────────────────────────────────────

interface RemuxCacheMetadata {
  sourcePath: string;
  sourceSize: number;
  sourceMtimeMs: number;
  mode: "remux" | "transcode";
}

function getRemuxCacheDir() {
  return path.join(getCacheRootDir(), "remux");
}

function getRemuxCachePath(sceneId: string) {
  return path.join(getRemuxCacheDir(), `${sceneId}.mp4`);
}

function getRemuxMetadataPath(sceneId: string) {
  return path.join(getRemuxCacheDir(), `${sceneId}.json`);
}

const remuxLocks = new Map<string, Promise<string>>();

async function probeCodecs(filePath: string): Promise<{ video: string | null; audio: string | null }> {
  try {
    const { stdout } = await runProcess("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=codec_name",
      "-of", "csv=p=0",
      filePath,
    ]);
    const videoCodec = stdout.trim().split("\n")[0]?.trim() || null;

    let audioCodec: string | null = null;
    try {
      const { stdout: audioOut } = await runProcess("ffprobe", [
        "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=codec_name",
        "-of", "csv=p=0",
        filePath,
      ]);
      audioCodec = audioOut.trim().split("\n")[0]?.trim() || null;
    } catch {
      // No audio stream is fine
    }

    return { video: videoCodec, audio: audioCodec };
  } catch {
    return { video: null, audio: null };
  }
}

async function isCacheFresh(sceneId: string, sourcePath: string): Promise<boolean> {
  const metaPath = getRemuxMetadataPath(sceneId);
  const cachePath = getRemuxCachePath(sceneId);

  if (!existsSync(metaPath) || !existsSync(cachePath)) {
    return false;
  }

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

async function buildRemuxCache(sceneId: string, sourcePath: string): Promise<string> {
  const cacheDir = getRemuxCacheDir();
  await mkdir(cacheDir, { recursive: true });

  const cachePath = getRemuxCachePath(sceneId);

  if (await isCacheFresh(sceneId, sourcePath)) {
    return cachePath;
  }

  const codecs = await probeCodecs(sourcePath);
  const canRemux =
    codecs.video !== null &&
    REMUXABLE_VIDEO_CODECS.has(codecs.video) &&
    (codecs.audio === null || REMUXABLE_AUDIO_CODECS.has(codecs.audio));

  const mode = canRemux ? "remux" : "transcode";

  if (canRemux) {
    // Fast path: stream-copy into fragmented MP4
    await runProcess("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-nostats",
      "-y",
      "-i", sourcePath,
      "-c", "copy",
      "-movflags", "+faststart",
      "-f", "mp4",
      cachePath,
    ]);
  } else {
    // Slow path: full transcode (one-time cost)
    await runProcess("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-nostats",
      "-y",
      "-i", sourcePath,
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "18",
      "-c:a", "aac",
      "-b:a", "160k",
      "-movflags", "+faststart",
      "-f", "mp4",
      cachePath,
    ]);
  }

  const sourceStats = await stat(sourcePath);
  const metadata: RemuxCacheMetadata = {
    sourcePath,
    sourceSize: sourceStats.size,
    sourceMtimeMs: sourceStats.mtimeMs,
    mode,
  };

  await writeFile(getRemuxMetadataPath(sceneId), JSON.stringify(metadata, null, 2), "utf8");

  return cachePath;
}

async function ensureRemuxCache(sceneId: string, sourcePath: string): Promise<string> {
  const existing = remuxLocks.get(sceneId);
  if (existing) {
    return existing;
  }

  const pending = buildRemuxCache(sceneId, sourcePath).finally(() => {
    remuxLocks.delete(sceneId);
  });

  remuxLocks.set(sceneId, pending);
  return pending;
}

// ─── Routes ────────────────────────────────────────────────────────

function resolveAssetPath(rootDir: string, assetPath: string) {
  const resolved = path.resolve(rootDir, assetPath);
  const normalizedRoot = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;
  if (resolved !== rootDir && !resolved.startsWith(normalizedRoot)) {
    return null;
  }

  return resolved;
}

export async function streamRoutes(app: FastifyInstance) {
  app.get("/stream/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scene = await getSceneSource(id);

    if (!scene?.filePath) {
      reply.code(404);
      return { error: "Video file not found on disk" };
    }

    const ext = path.extname(scene.filePath).toLowerCase();
    if (NEEDS_TRANSCODE.has(ext) && !BROWSER_NATIVE.has(ext)) {
      const cachedPath = await ensureRemuxCache(scene.id, scene.filePath);
      return sendRangeStream(reply, cachedPath, request.headers.range);
    }

    return sendRangeStream(reply, scene.filePath, request.headers.range);
  });

  app.get("/stream/:id/source", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scene = await getSceneSource(id);

    if (!scene?.filePath) {
      reply.code(404);
      return { error: "Video file not found on disk" };
    }

    const ext = path.extname(scene.filePath).toLowerCase();
    if (NEEDS_TRANSCODE.has(ext) && !BROWSER_NATIVE.has(ext)) {
      const cachedPath = await ensureRemuxCache(scene.id, scene.filePath);
      return sendRangeStream(reply, cachedPath, request.headers.range);
    }

    return sendRangeStream(reply, scene.filePath, request.headers.range);
  });

  app.get("/stream/:id/hls/master.m3u8", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scene = await getSceneSource(id);

    if (!scene?.filePath) {
      reply.code(404);
      return { error: "Video file not found on disk" };
    }

    const hlsPackage = await ensureHlsPackage(id, scene.filePath, scene.height);
    reply.header("Cache-Control", "public, max-age=60");
    reply.header("Content-Type", mimeForExt(".m3u8"));

    return reply.send(createReadStream(hlsPackage.masterManifestPath));
  });

  app.get("/stream/:id/hls/*", async (request, reply) => {
    const { id } = request.params as { id: string; "*": string };
    const assetPath = (request.params as { "*": string })["*"];
    const scene = await getSceneSource(id);

    if (!scene?.filePath) {
      reply.code(404);
      return { error: "Video file not found on disk" };
    }

    const hlsPackage = await ensureHlsPackage(id, scene.filePath, scene.height);
    const resolvedAsset = resolveAssetPath(hlsPackage.outputDir, assetPath);

    if (!resolvedAsset || !existsSync(resolvedAsset)) {
      reply.code(404);
      return { error: "Stream asset not found" };
    }

    reply.header("Cache-Control", "public, max-age=300");
    reply.header("Content-Type", mimeForExt(path.extname(resolvedAsset).toLowerCase()));
    return reply.send(createReadStream(resolvedAsset));
  });
}
