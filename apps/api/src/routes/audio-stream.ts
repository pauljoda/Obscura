import type { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { createReadStream, statSync } from "node:fs";
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
  ".aiff": "audio/aiff",
  ".aif": "audio/aiff",
  ".wma": "audio/x-ms-wma",
  ".alac": "audio/mp4",
  ".ape": "audio/x-ape",
  ".dsf": "audio/dsf",
  ".dff": "audio/dff",
  ".wv": "audio/x-wavpack",
};

export async function audioStreamRoutes(app: FastifyInstance) {
  app.get("/audio-stream/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [track] = await db
      .select({ id: audioTracks.id, filePath: audioTracks.filePath })
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
    const contentType = AUDIO_MIME_MAP[ext] ?? "application/octet-stream";
    const fileSize = fileStat.size;

    // Range request support for seeking
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
