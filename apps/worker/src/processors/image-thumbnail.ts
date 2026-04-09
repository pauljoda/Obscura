import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import {
  extractZipMember,
  getGeneratedImageDir,
  probeImageFile,
  runProcess,
} from "@obscura/media-core";
import { db, images } from "../lib/db.js";
import { markJobActive } from "../lib/job-tracking.js";

export async function processImageThumbnail(job: Job) {
  const imageId = String(job.data.imageId);
  const [image] = await db
    .select({ id: images.id, title: images.title, filePath: images.filePath })
    .from(images)
    .where(eq(images.id, imageId))
    .limit(1);

  if (!image) {
    throw new Error("Image not found");
  }

  await markJobActive(job, "image-thumbnail", {
    type: "image",
    id: image.id,
    label: image.title,
  });

  const outputDir = getGeneratedImageDir(image.id);
  await mkdir(outputDir, { recursive: true });
  const thumbPath = path.join(outputDir, "thumb.jpg");

  const isZipMember = image.filePath.includes("::");
  let inputPath = image.filePath;
  let tempFile: string | null = null;

  if (isZipMember) {
    // Extract zip member to a temp file
    const [zipPath, memberPath] = image.filePath.split("::");
    const data = extractZipMember(zipPath, memberPath);
    if (!data) {
      throw new Error("Failed to extract zip member");
    }
    tempFile = path.join(tmpdir(), `obscura-thumb-${image.id}${path.extname(memberPath)}`);
    await writeFile(tempFile, data);
    inputPath = tempFile;
  }

  try {
    // Detect if this is a video/animated format that needs single-frame extraction
    const ext = path.extname(inputPath).toLowerCase();
    const isVideo = [".mp4", ".m4v", ".mkv", ".mov", ".webm", ".avi", ".wmv", ".flv"].includes(ext);

    // Generate thumbnail with ffmpeg
    const ffmpegArgs = ["-hide_banner", "-loglevel", "error", "-y"];
    if (isVideo) {
      // Seek to 18% of the way through for a representative frame
      ffmpegArgs.push("-ss", "1");
    }
    ffmpegArgs.push("-i", inputPath);
    if (isVideo) {
      ffmpegArgs.push("-frames:v", "1");
    }
    ffmpegArgs.push("-vf", "scale=640:-1", "-q:v", "3", thumbPath);

    await runProcess("ffmpeg", ffmpegArgs);

    // For video/animated formats, also generate a small looping preview
    if (isVideo) {
      const previewPath = path.join(outputDir, "preview.mp4");
      try {
        await runProcess("ffmpeg", [
          "-hide_banner", "-loglevel", "error", "-y",
          "-i", inputPath,
          "-vf", "scale=320:-2",
          "-an",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "28",
          "-movflags", "+faststart",
          "-t", "8",
          previewPath,
        ]);
      } catch {
        // Preview generation is non-fatal
      }
    }

    // Probe for dimensions and format
    const probe = await probeImageFile(inputPath);

    await db
      .update(images)
      .set({
        thumbnailPath: `/assets/images/${image.id}/thumb`,
        width: probe.width,
        height: probe.height,
        format: probe.format,
        updatedAt: new Date(),
      })
      .where(eq(images.id, image.id));
  } finally {
    if (tempFile) {
      await rm(tempFile, { force: true });
    }
  }
}
