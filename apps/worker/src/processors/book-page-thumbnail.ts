import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import {
  extractZipMember,
  getGeneratedBookPageDir,
  probeImageFile,
  runProcess,
} from "@obscura/media-core";
import { db, bookPages } from "../lib/db.js";
import { markJobActive } from "../lib/job-tracking.js";

export async function processBookPageThumbnail(job: Job) {
  const pageId = String(job.data.pageId);
  const [page] = await db
    .select({ id: bookPages.id, title: bookPages.title, filePath: bookPages.filePath })
    .from(bookPages)
    .where(eq(bookPages.id, pageId))
    .limit(1);

  if (!page) throw new Error("Book page not found");

  await markJobActive(job, "book-page-thumbnail", {
    type: "book-page",
    id: page.id,
    label: page.title,
  });

  const [archivePath, memberPath] = page.filePath.split("::");
  if (!archivePath || !memberPath) throw new Error("Book page is not archive-backed");

  const data = extractZipMember(archivePath, memberPath);
  if (!data) throw new Error("Failed to extract book page");

  const outputDir = getGeneratedBookPageDir(page.id);
  await mkdir(outputDir, { recursive: true });
  const thumbPath = path.join(outputDir, "thumb.jpg");
  const tempFile = path.join(tmpdir(), `obscura-book-page-${page.id}${path.extname(memberPath)}`);
  await writeFile(tempFile, data);

  try {
    await runProcess("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      tempFile,
      "-frames:v",
      "1",
      "-vf",
      "scale=640:-1",
      "-q:v",
      "3",
      "-update",
      "1",
      thumbPath,
    ]);

    const probe = await probeImageFile(tempFile);
    await db
      .update(bookPages)
      .set({
        thumbnailPath: `/assets/book-pages/${page.id}/thumb`,
        width: probe.width,
        height: probe.height,
        format: probe.format,
        updatedAt: new Date(),
      })
      .where(eq(bookPages.id, page.id));
  } finally {
    await rm(tempFile, { force: true });
  }
}
