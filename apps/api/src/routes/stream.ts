import type { FastifyInstance, FastifyReply } from "fastify";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { createReadStream, existsSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { ensureHlsPackage } from "../lib/hls";

const { scenes } = schema;

const BROWSER_NATIVE = new Set([".mp4", ".webm", ".ogg", ".m4v"]);
const NEEDS_TRANSCODE = new Set([".mkv", ".avi", ".wmv", ".flv", ".mov", ".ts", ".m2ts"]);

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

function sendTranscodedSource(reply: FastifyReply, filePath: string) {
  reply.header("Content-Type", "video/mp4");
  reply.header("Transfer-Encoding", "chunked");

  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostats",
      "-i",
      filePath,
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
      "frag_keyframe+empty_moov+faststart",
      "-f",
      "mp4",
      "-",
    ],
    {
      stdio: ["ignore", "pipe", "ignore"],
    }
  );

  reply.raw.on("close", () => {
    ffmpeg.kill("SIGTERM");
  });

  return reply.send(ffmpeg.stdout);
}

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
      return sendTranscodedSource(reply, scene.filePath);
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
      return sendTranscodedSource(reply, scene.filePath);
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
