import type { FastifyInstance, FastifyReply } from "fastify";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, stat, writeFile, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { getHlsStatus, peekHlsTracker, startHlsGeneration } from "../lib/hls";
import {
  buildMasterPlaylist as buildVirtualMaster,
  buildVariantPlaylist as buildVirtualVariant,
  getSegment as getVirtualSegment,
  segmentCount as virtualSegmentCount,
} from "../lib/hls-virtual";
import { HLS_RETRY_AFTER_SECONDS } from "@obscura/contracts/media";
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
      duration: true,
      width: true,
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

  app.get("/stream/:id/hls/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scene = await getSceneSource(id);

    if (!scene?.filePath) {
      reply.code(404);
      return { error: "Video file not found on disk" };
    }

    const status = await getHlsStatus(id, scene.filePath, scene.height);
    reply.header("Cache-Control", "no-store");
    return status;
  });

  app.get("/stream/:id/hls/master.m3u8", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scene = await getSceneSource(id);

    if (!scene?.filePath) {
      reply.code(404);
      return { error: "Video file not found on disk" };
    }

    const status = await getHlsStatus(id, scene.filePath, scene.height);

    if (status.state === "error") {
      reply.code(500);
      return { error: status.error ?? "HLS generation failed" };
    }

    if (status.state !== "ready") {
      // Kick off if idle; otherwise getHlsStatus already flipped us to pending.
      startHlsGeneration(id, scene.filePath, scene.height).catch(() => {
        // Error is tracked in tracker state; /status and subsequent requests
        // will surface it.
      });
      reply.code(503);
      reply.header("Retry-After", String(HLS_RETRY_AFTER_SECONDS));
      reply.header("Cache-Control", "no-store");
      return { error: "HLS package is still being generated", retryAfter: HLS_RETRY_AFTER_SECONDS };
    }

    const cacheDir = path.join(getCacheRootDir(), "hls", id);
    const masterManifestPath = path.join(cacheDir, "master.m3u8");

    if (!existsSync(masterManifestPath)) {
      // Ready in tracker but file missing on disk — re-trigger.
      startHlsGeneration(id, scene.filePath, scene.height).catch(() => {});
      reply.code(503);
      reply.header("Retry-After", String(HLS_RETRY_AFTER_SECONDS));
      return { error: "HLS manifest missing on disk", retryAfter: HLS_RETRY_AFTER_SECONDS };
    }

    const tracker = peekHlsTracker(id);
    reply.header(
      "Cache-Control",
      tracker?.isEncodeActive ? "no-store" : "public, max-age=60",
    );
    reply.header("Content-Type", mimeForExt(".m3u8"));
    return reply.send(createReadStream(masterManifestPath));
  });

  app.get("/stream/:id/hls/*", async (request, reply) => {
    const { id } = request.params as { id: string; "*": string };
    const assetPath = (request.params as { "*": string })["*"];
    const scene = await getSceneSource(id);

    if (!scene?.filePath) {
      reply.code(404);
      return { error: "Video file not found on disk" };
    }

    const tracker = peekHlsTracker(id);
    if (!tracker || tracker.state === "pending") {
      reply.code(503);
      reply.header("Retry-After", String(HLS_RETRY_AFTER_SECONDS));
      reply.header("Cache-Control", "no-store");
      return { error: "HLS package not ready", retryAfter: HLS_RETRY_AFTER_SECONDS };
    }

    if (tracker.state === "error") {
      reply.code(500);
      return { error: tracker.error ?? "HLS generation failed" };
    }

    const cacheDir = path.join(getCacheRootDir(), "hls", id);
    const resolvedAsset = resolveAssetPath(cacheDir, assetPath);
    if (!resolvedAsset) {
      reply.code(404);
      return { error: "Stream asset not found" };
    }

    // Hanging GET: while ffmpeg is still encoding in the background, the
    // player pre-buffers segments ahead of the encode head. Instead of
    // returning 503 and letting hls.js log a red console error on every
    // lookahead miss, hold the request here and poll the filesystem until
    // the segment appears (or the encode dies / we time out).
    if (!existsSync(resolvedAsset)) {
      if (!peekHlsTracker(id)?.isEncodeActive) {
        reply.code(404);
        return { error: "Stream asset not found" };
      }

      const HANG_TIMEOUT_MS = 30_000;
      const POLL_MS = 200;
      const start = Date.now();
      while (Date.now() - start < HANG_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (existsSync(resolvedAsset)) break;
        if (!peekHlsTracker(id)?.isEncodeActive) break;
      }

      if (!existsSync(resolvedAsset)) {
        const stillActive = peekHlsTracker(id)?.isEncodeActive ?? false;
        if (stillActive) {
          reply.code(503);
          reply.header("Retry-After", String(HLS_RETRY_AFTER_SECONDS));
          reply.header("Cache-Control", "no-store");
          return { error: "Segment still encoding", retryAfter: HLS_RETRY_AFTER_SECONDS };
        }
        reply.code(404);
        return { error: "Stream asset not found" };
      }

      // Small stabilization wait so we don't stream a half-written segment.
      // ffmpeg writes the segment then appends to the playlist; by the time
      // the playlist has the reference hls.js won't usually race us, but a
      // 25ms settle makes this safe.
      await new Promise((r) => setTimeout(r, 25));
    }

    const latest = peekHlsTracker(id);
    const ext = path.extname(resolvedAsset).toLowerCase();
    if (ext === ".m3u8" && latest?.isEncodeActive) {
      // Variant playlists get re-fetched by hls.js to discover new segments
      // while the encode is active — don't let a cache pin an early partial
      // playlist.
      reply.header("Cache-Control", "no-store");
    } else {
      reply.header("Cache-Control", "public, max-age=300");
    }
    reply.header("Content-Type", mimeForExt(ext));
    return reply.send(createReadStream(resolvedAsset));
  });

  // ─── Virtual HLS (on-demand per-segment transcoding) ──────────────
  // A full-length VOD playlist is fabricated upfront and each segment is
  // transcoded the first time the player requests it (then cached). Unlike
  // the linear progressive `/hls/*` path, seeking is free from the first
  // frame — hls.js sees a complete `video.seekable` range and any segment
  // is synthesized in ~1s when requested.

  app.get("/stream/:id/hls2/master.m3u8", async (_request, reply) => {
    const { id } = _request.params as { id: string };
    const scene = await getSceneSource(id);
    if (!scene?.filePath) {
      reply.code(404);
      return { error: "Video file not found on disk" };
    }
    if (!scene.duration || scene.duration <= 0) {
      reply.code(409);
      return { error: "Scene has no probed duration yet" };
    }
    const body = buildVirtualMaster({ width: scene.width, height: scene.height });
    reply.header("Content-Type", mimeForExt(".m3u8"));
    reply.header("Cache-Control", "public, max-age=300");
    return reply.send(body);
  });

  app.get("/stream/:id/hls2/v/:file", async (request, reply) => {
    const { id, file } = request.params as { id: string; file: string };
    const scene = await getSceneSource(id);
    if (!scene?.filePath) {
      reply.code(404);
      return { error: "Video file not found on disk" };
    }
    if (!scene.duration || scene.duration <= 0) {
      reply.code(409);
      return { error: "Scene has no probed duration yet" };
    }

    if (file === "index.m3u8") {
      const body = buildVirtualVariant(scene.duration);
      reply.header("Content-Type", mimeForExt(".m3u8"));
      reply.header("Cache-Control", "public, max-age=300");
      return reply.send(body);
    }

    const match = /^seg_(\d+)\.ts$/.exec(file);
    if (!match) {
      reply.code(404);
      return { error: "Unknown segment file" };
    }
    const segIndex = Number.parseInt(match[1], 10);
    if (!Number.isFinite(segIndex) || segIndex < 0) {
      reply.code(400);
      return { error: "Invalid segment index" };
    }
    const total = virtualSegmentCount(scene.duration);
    if (segIndex >= total) {
      reply.code(404);
      return { error: `segment index ${segIndex} out of range (0..${total - 1})` };
    }

    try {
      const segmentPath = await getVirtualSegment(
        scene.id,
        scene.filePath,
        scene.duration,
        segIndex,
      );
      reply.header("Content-Type", "video/mp2t");
      reply.header("Cache-Control", "public, max-age=31536000, immutable");
      return reply.send(createReadStream(segmentPath));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reply.code(500);
      return { error: message };
    }
  });
}
