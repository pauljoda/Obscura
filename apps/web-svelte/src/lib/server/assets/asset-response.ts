import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { json } from "@sveltejs/kit";

export const IMAGE_EXTENSIONS = ["jpg", "png", "svg", "webp"] as const;

export function notFound(message: string): Response {
  return json({ error: message }, { status: 404 });
}

export function firstExistingPath(paths: string[]): string | null {
  for (const candidate of paths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function streamFile(
  filePath: string,
  headers: Record<string, string> = {},
): Response {
  const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(body, { headers });
}

export function sendBuffer(
  buffer: Buffer,
  headers: Record<string, string> = {},
): Response {
  return new Response(new Uint8Array(buffer), { headers });
}

export function mimeForFile(extOrFileName: string): string {
  const ext = extOrFileName.startsWith(".")
    ? extOrFileName.toLowerCase()
    : path.extname(extOrFileName).toLowerCase();

  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".avif":
      return "image/avif";
    case ".heic":
      return "image/heic";
    case ".bmp":
      return "image/bmp";
    case ".tiff":
    case ".tif":
      return "image/tiff";
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mkv":
      return "video/x-matroska";
    case ".mov":
      return "video/quicktime";
    case ".avi":
      return "video/x-msvideo";
    case ".wmv":
      return "video/x-ms-wmv";
    case ".flv":
      return "video/x-flv";
    case ".vtt":
      return "text/vtt";
    case ".json":
      return "application/json";
    default:
      return "application/octet-stream";
  }
}
