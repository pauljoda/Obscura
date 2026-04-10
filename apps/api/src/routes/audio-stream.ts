import type { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { createReadStream, statSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const { audioTracks } = schema;

const AUDIO_MIME_MAP: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".aac": "audio/mp4",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
};

/**
 * Codecs that browsers can play natively inside their common containers.
 * These stream the file directly with HTTP Range support.
 *
 * NOT in this list (requires transcoding):
 *   - alac (Apple Lossless, Safari-only)
 *   - ape, wma, aiff, dsd — no broad browser support
 *   - some exotic mp4 containers
 */
const BROWSER_NATIVE_CODECS = new Set([
  "mp3",
  "aac",
  "opus",
  "vorbis",
  "flac",
  "pcm_s16le",
  "pcm_s24le",
]);

export async function audioStreamRoutes(app: FastifyInstance) {
  app.get("/audio-stream/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [track] = await db
      .select({
        id: audioTracks.id,
        filePath: audioTracks.filePath,
        codec: audioTracks.codec,
      })
      .from(audioTracks)
      .where(eq(audioTracks.id, id))
      .limit(1);

    if (!track?.filePath) {
      return reply.code(404).send({ error: "Track not found" });
    }

    let fileStat;
    try {
      fileStat = statSync(track.filePath);
    } catch {
      return reply.code(404).send({ error: "Audio file not found on disk" });
    }

    const ext = path.extname(track.filePath).toLowerCase();
    const codec = (track.codec ?? "").toLowerCase();
    const needsTranscode = codec && !BROWSER_NATIVE_CODECS.has(codec);

    // ─── Transcode path: pipe ffmpeg output (no range support) ──
    if (needsTranscode) {
      reply
        .header("Content-Type", "audio/mpeg")
        .header("Cache-Control", "no-store")
        .header("X-Transcoded-From", codec);

      const ffmpeg = spawn(
        "ffmpeg",
        [
          "-i", track.filePath,
          "-f", "mp3",
          "-vn",                 // drop any video stream (cover art)
          "-acodec", "libmp3lame",
          "-b:a", "192k",
          "-ar", "44100",
          "-ac", "2",
          "pipe:1",
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );

      // Log ffmpeg errors for debugging
      let stderr = "";
      ffmpeg.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      ffmpeg.on("error", (err) => {
        app.log.error({ err, trackId: track.id }, "ffmpeg spawn failed");
      });
      ffmpeg.on("close", (code) => {
        if (code !== 0 && code !== 255) {
          app.log.warn({ code, stderr: stderr.slice(-500), trackId: track.id }, "ffmpeg exit");
        }
      });

      // Kill ffmpeg if the client disconnects
      request.raw.on("close", () => {
        if (!ffmpeg.killed) {
          ffmpeg.kill("SIGKILL");
        }
      });

      return reply.send(ffmpeg.stdout);
    }

    // ─── Direct streaming with Range support ────────────────────
    const contentType = AUDIO_MIME_MAP[ext] ?? "application/octet-stream";
    const fileSize = fileStat.size;
    const range = request.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      reply
        .code(206)
        .header("Content-Range", `bytes ${start}-${end}/${fileSize}`)
        .header("Accept-Ranges", "bytes")
        .header("Content-Length", chunkSize)
        .header("Content-Type", contentType)
        .header("Cache-Control", "public, max-age=86400");

      return reply.send(createReadStream(track.filePath, { start, end }));
    }

    reply
      .header("Content-Length", fileSize)
      .header("Content-Type", contentType)
      .header("Accept-Ranges", "bytes")
      .header("Cache-Control", "public, max-age=86400");

    return reply.send(createReadStream(track.filePath));
  });
}
