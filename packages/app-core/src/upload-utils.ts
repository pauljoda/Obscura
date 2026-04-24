import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { InternalError, ValidationError } from "./errors";

const uploadCategories = {
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
  },
} as const;

export type UploadCategory = keyof typeof uploadCategories;

export interface UploadFileInput {
  filename: string;
  mimetype?: string | null;
  buffer: Buffer;
}

export function sanitizeUploadFilename(raw: string | undefined | null): string {
  if (!raw) throw new ValidationError("Upload is missing a filename");
  const base = path.basename(raw).trim();
  if (!base) throw new ValidationError("Upload filename is empty");
  if (base === "." || base === "..") {
    throw new ValidationError("Upload filename is invalid");
  }
  if (base.includes("/") || base.includes("\\") || base.includes("\0")) {
    throw new ValidationError("Upload filename contains illegal characters");
  }
  return base;
}

export function validateUploadMetadata(
  file: Pick<UploadFileInput, "filename" | "mimetype"> | null | undefined,
  category: UploadCategory,
) {
  if (!file) throw new ValidationError("No file provided");
  const safeName = sanitizeUploadFilename(file.filename);
  const ext = path.extname(safeName).toLowerCase();
  const config = uploadCategories[category];
  if (!config.extensions.has(ext)) {
    throw new ValidationError(
      `Unsupported ${category} extension "${ext || "(none)"}"`,
    );
  }
  const mime = (file.mimetype ?? "").toLowerCase();
  if (
    mime &&
    !mime.startsWith(config.mimePrefix) &&
    mime !== "application/octet-stream"
  ) {
    throw new ValidationError(`Unsupported ${category} mime type "${mime}"`);
  }
  return { safeName, ext };
}

export function validateUploadInput(
  file: UploadFileInput | null | undefined,
  category: UploadCategory,
) {
  const validated = validateUploadMetadata(file, category);
  if (!file?.buffer.length) {
    throw new ValidationError("Uploaded file is empty");
  }
  return validated;
}

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
      throw new InternalError(
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

export async function assertDirExists(dir: string) {
  let st;
  try {
    st = await stat(dir);
  } catch {
    throw new ValidationError(`Target folder does not exist on disk: ${dir}`);
  }
  if (!st.isDirectory()) {
    throw new ValidationError(`Target path is not a directory: ${dir}`);
  }
}

export async function writeUploadBuffer(dest: string, buffer: Buffer) {
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buffer, { flag: "wx" });
  return { bytesWritten: buffer.length };
}
