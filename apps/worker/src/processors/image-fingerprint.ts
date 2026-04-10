import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import { computeMd5, computeOsHash, extractZipMember } from "@obscura/media-core";
import { db, images } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";

export async function processImageFingerprint(job: Job) {
  const imageId = String(job.data.imageId);
  const [image] = await db
    .select({ id: images.id, title: images.title, filePath: images.filePath })
    .from(images)
    .where(eq(images.id, imageId))
    .limit(1);

  if (!image) {
    throw new Error("Image not found");
  }

  await markJobActive(job, "image-fingerprint", {
    type: "image",
    id: image.id,
    label: image.title,
  });

  const isZipMember = image.filePath.includes("::");
  let inputPath = image.filePath;
  let tempFile: string | null = null;

  if (isZipMember) {
    const [zipPath, memberPath] = image.filePath.split("::");
    const data = extractZipMember(zipPath, memberPath);
    if (!data) {
      throw new Error("Failed to extract zip member");
    }
    tempFile = path.join(tmpdir(), `obscura-fp-${image.id}${path.extname(memberPath)}`);
    await writeFile(tempFile, data);
    inputPath = tempFile;
  }

  try {
    const md5 = await computeMd5(inputPath);
    await markJobProgress(job, "image-fingerprint", 50);
    const oshash = await computeOsHash(inputPath);

    await db
      .update(images)
      .set({
        checksumMd5: md5,
        oshash,
        updatedAt: new Date(),
      })
      .where(eq(images.id, image.id));
  } finally {
    if (tempFile) {
      await rm(tempFile, { force: true });
    }
  }
}
