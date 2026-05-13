import type { RequestHandler } from "@sveltejs/kit";
import { getWebDb } from "$lib/v1/server/db-v1";
import { schema } from "@obscura/db";
import { eq } from "drizzle-orm";
import { spawn } from "node:child_process";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

const AUDIO_MIME_MAP: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".aac": "audio/mp4",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
};

const BROWSER_NATIVE_CODECS = new Set([
  "mp3",
  "aac",
  "opus",
  "vorbis",
  "flac",
  "pcm_s16le",
  "pcm_s24le",
]);

const { audioTracks } = schema;

function nodeStreamResponse(
  stream: NodeJS.ReadableStream,
  init: ResponseInit,
): Response {
  return new Response(
    Readable.toWeb(stream as Readable) as unknown as BodyInit,
    init,
  );
}

export const GET: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const [track] = await db
    .select({
      id: audioTracks.id,
      filePath: audioTracks.filePath,
      codec: audioTracks.codec,
    })
    .from(audioTracks)
    .where(eq(audioTracks.id, params.id!))
    .limit(1);

  if (!track?.filePath) {
    return Response.json({ error: "Track not found" }, { status: 404 });
  }

  let fileStat;
  try {
    fileStat = statSync(track.filePath);
  } catch {
    return Response.json({ error: "Audio file not found on disk" }, { status: 404 });
  }

  const ext = path.extname(track.filePath).toLowerCase();
  const codec = (track.codec ?? "").toLowerCase();
  const needsTranscode = codec.length > 0 && !BROWSER_NATIVE_CODECS.has(codec);

  if (needsTranscode) {
    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-i", track.filePath,
        "-f", "mp3",
        "-vn",
        "-acodec", "libmp3lame",
        "-b:a", "192k",
        "-ar", "44100",
        "-ac", "2",
        "pipe:1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    request.signal.addEventListener("abort", () => {
      if (!ffmpeg.killed) ffmpeg.kill("SIGKILL");
    });

    return nodeStreamResponse(ffmpeg.stdout, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Transcoded-From": codec,
      },
    });
  }

  const contentType = AUDIO_MIME_MAP[ext] ?? "application/octet-stream";
  const fileSize = fileStat.size;
  const range = request.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = Number.parseInt(parts[0] ?? "0", 10);
    const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    return nodeStreamResponse(createReadStream(track.filePath, { start, end }), {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  return nodeStreamResponse(createReadStream(track.filePath), {
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
    },
  });
};
