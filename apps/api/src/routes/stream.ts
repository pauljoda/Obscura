import type { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { createReadStream, statSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const { scenes } = schema;

// Formats browsers can play natively
const BROWSER_NATIVE = new Set([".mp4", ".webm", ".ogg"]);

// Containers that need transcoding
const NEEDS_TRANSCODE = new Set([".mkv", ".avi", ".wmv", ".flv", ".mov", ".ts", ".m2ts"]);

function mimeForExt(ext: string): string {
  switch (ext) {
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
      return "video/mp4";
  }
}

export async function streamRoutes(app: FastifyInstance) {
  // GET /stream/:id — stream video for a scene, transcoding if needed
  app.get("/stream/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const scene = await db.query.scenes.findFirst({
      where: eq(scenes.id, id),
      columns: { filePath: true, container: true },
    });

    if (!scene?.filePath) {
      reply.code(404);
      return { error: "Scene has no video file" };
    }

    const filePath = scene.filePath;

    if (!existsSync(filePath)) {
      reply.code(404);
      return { error: "Video file not found on disk" };
    }

    const ext = path.extname(filePath).toLowerCase();
    const stat = statSync(filePath);
    const fileSize = stat.size;

    // If the format needs transcoding, pipe through ffmpeg
    if (NEEDS_TRANSCODE.has(ext) && !BROWSER_NATIVE.has(ext)) {
      reply.header("Content-Type", "video/mp4");
      reply.header("Transfer-Encoding", "chunked");

      const ffmpeg = spawn("ffmpeg", [
        "-i", filePath,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "frag_keyframe+empty_moov+faststart",
        "-f", "mp4",
        "-",
      ]);

      reply.raw.on("close", () => {
        ffmpeg.kill("SIGTERM");
      });

      return reply.send(ffmpeg.stdout);
    }

    // Native format — serve with range request support for seeking
    const range = request.headers.range;
    const contentType = mimeForExt(ext);

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
  });
}
