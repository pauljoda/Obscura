import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { MultipartFile } from "@fastify/multipart";
import { AppError } from "../plugins/error-handler.js";

// ─── Allow-lists ───────────────────────────────────────────────

/**
 * Upload category allow-lists. Both mime-prefix and extension are checked
 * because browsers lie about mime types for a handful of formats (esp.
 * .mkv, .flac, .opus) and we do not want silent downgrades.
 */
export const uploadCategories = {
  video: {
    mimePrefix: "video/",
    extensions: new Set([
      ".mp4",
      ".mkv",
      ".mov",
      ".webm",
      ".avi",
      ".m4v",
      ".wmv",
      ".flv",
      ".ts",
      ".mpg",
      ".mpeg",
    ]),
    defaultMaxBytes: 20 * 1024 * 1024 * 1024, // 20 GiB
  },
  image: {
    mimePrefix: "image/",
    extensions: new Set([
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".gif",
      ".avif",
      ".bmp",
      ".tif",
      ".tiff",
    ]),
    defaultMaxBytes: 100 * 1024 * 1024, // 100 MiB
  },
  audio: {
    mimePrefix: "audio/",
    extensions: new Set([
      ".mp3",
      ".flac",
      ".m4a",
      ".aac",
      ".ogg",
      ".opus",
      ".wav",
      ".wma",
    ]),
    defaultMaxBytes: 1024 * 1024 * 1024, // 1 GiB
  },
} as const;

export type UploadCategory = keyof typeof uploadCategories;

/** Resolve the effective max upload size for a category, honoring env overrides. */
export function maxUploadBytes(category: UploadCategory): number {
  const envMap: Record<UploadCategory, string> = {
    video: "OBSCURA_MAX_VIDEO_UPLOAD",
    image: "OBSCURA_MAX_IMAGE_UPLOAD",
    audio: "OBSCURA_MAX_AUDIO_UPLOAD",
  };
  const raw = process.env[envMap[category]];
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return uploadCategories[category].defaultMaxBytes;
}

// ─── Filename safety ───────────────────────────────────────────

/**
 * Return a safe base filename — rejects directory traversal, strips any path
 * components, and collapses weird whitespace. Throws AppError(400) on a
 * filename we cannot salvage.
 */
export function sanitizeUploadFilename(raw: string | undefined | null): string {
  if (!raw) throw new AppError(400, "Upload is missing a filename");
  // Strip any path components the client sent — we only trust the basename
  const base = path.basename(raw).trim();
  if (!base) throw new AppError(400, "Upload filename is empty");
  if (base === "." || base === "..") {
    throw new AppError(400, "Upload filename is invalid");
  }
  if (base.includes("/") || base.includes("\\") || base.includes("\0")) {
    throw new AppError(400, "Upload filename contains illegal characters");
  }
  return base;
}

// ─── Validation ────────────────────────────────────────────────

export interface ValidateUploadOptions {
  category: UploadCategory;
  /** Defaults to the category's configured max size. */
  maxBytes?: number;
}

/**
 * Runs metadata-only validation against a received multipart file. Does not
 * consume the stream — stream length is enforced separately by Fastify's
 * `limits.fileSize` and by our post-write size check.
 */
export function validateUpload(
  file: Pick<MultipartFile, "filename" | "mimetype"> | null | undefined,
  { category }: ValidateUploadOptions,
): { safeName: string; ext: string } {
  if (!file) throw new AppError(400, "No file provided");
  const safeName = sanitizeUploadFilename(file.filename);
  const ext = path.extname(safeName).toLowerCase();
  const cat = uploadCategories[category];
  if (!cat.extensions.has(ext)) {
    throw new AppError(
      415,
      `Unsupported ${category} extension "${ext || "(none)"}"`,
    );
  }
  const mime = (file.mimetype ?? "").toLowerCase();
  // Some browsers send application/octet-stream for .mkv/.flac — we allow
  // that when the extension is already in the allow-list.
  if (
    mime &&
    !mime.startsWith(cat.mimePrefix) &&
    mime !== "application/octet-stream"
  ) {
    throw new AppError(
      415,
      `Unsupported ${category} mime type "${mime}"`,
    );
  }
  return { safeName, ext };
}

// ─── Collision-safe destination ────────────────────────────────

/**
 * Return a destination path inside `dir` that does not currently exist.
 * If `filename` is already taken, appends " (1)", " (2)", ... before the
 * extension. Only inspects the target directory — does not create it.
 */
export async function resolveCollisionSafePath(
  dir: string,
  filename: string,
): Promise<string> {
  const parsed = path.parse(filename);
  const base = parsed.name;
  const ext = parsed.ext;
  let candidate = path.join(dir, filename);
  let counter = 1;
  while (await pathExists(candidate)) {
    candidate = path.join(dir, `${base} (${counter})${ext}`);
    counter += 1;
    if (counter > 9999) {
      throw new AppError(
        500,
        "Could not find a free filename after 9999 attempts",
      );
    }
  }
  return candidate;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

// ─── Filesystem guards ─────────────────────────────────────────

/**
 * Throws AppError(400) if `dir` does not exist or is not a directory.
 * Used before writing into library-root / gallery / audio-library folders
 * so the user sees a clear error instead of a buried ENOENT.
 */
export async function assertDirExists(dir: string): Promise<void> {
  let st;
  try {
    st = await stat(dir);
  } catch {
    throw new AppError(
      400,
      `Target folder does not exist on disk: ${dir}`,
    );
  }
  if (!st.isDirectory()) {
    throw new AppError(400, `Target path is not a directory: ${dir}`);
  }
}

// ─── Streaming write ───────────────────────────────────────────

export interface StreamToFileResult {
  bytesWritten: number;
}

/**
 * Pipe a multipart file stream to `dest`. Creates parent dirs as needed.
 * Returns the byte count from fs.stat after the stream completes. The
 * caller is responsible for deleting `dest` on failure if needed.
 */
export async function streamToFile(
  file: MultipartFile,
  dest: string,
): Promise<StreamToFileResult> {
  await mkdir(path.dirname(dest), { recursive: true });
  const out = createWriteStream(dest, { flags: "wx" });
  try {
    await pipeline(file.file, out);
  } catch (err) {
    // Attempt to clean up a partial file on error; ignore cleanup failures.
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(dest);
    } catch {}
    throw err;
  }
  if (file.file.truncated) {
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(dest);
    } catch {}
    throw new AppError(413, "Upload exceeded the maximum allowed size");
  }
  const st = await stat(dest);
  if (st.size === 0) {
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(dest);
    } catch {}
    throw new AppError(400, "Uploaded file is empty");
  }
  return { bytesWritten: st.size };
}
