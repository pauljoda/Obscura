import { existsSync } from "node:fs";
import path from "node:path";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import {
  discoverImageFilesAndDirs,
  fileNameToTitle,
  parseZipImageMembers,
  getGeneratedImageDir,
} from "@obscura/media-core";
import { db, scenes, images, galleries, libraryRoots } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";
import { enqueuePendingImageJob } from "../lib/enqueue.js";
import { ensureLibrarySettingsRow } from "../lib/scheduler.js";
import { removeGeneratedImageDirs } from "../lib/helpers.js";

async function shouldSkipGalleryDerivedJobs(
  sfwOnly: boolean,
  galleryId: string,
  imageId: string
): Promise<boolean> {
  if (!sfwOnly) return false;
  const [g] = await db
    .select({ isNsfw: galleries.isNsfw })
    .from(galleries)
    .where(eq(galleries.id, galleryId))
    .limit(1);
  const [img] = await db
    .select({ isNsfw: images.isNsfw })
    .from(images)
    .where(eq(images.id, imageId))
    .limit(1);
  return Boolean(g?.isNsfw || img?.isNsfw);
}

export async function processGalleryScan(job: Job) {
  const sfwOnly = Boolean(job.data.sfwOnly);
  const libraryRootId = String(job.data.libraryRootId);
  const [root] = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.id, libraryRootId))
    .limit(1);

  if (!root) {
    throw new Error("Library root not found");
  }

  if (!(root.scanImages ?? true)) {
    return;
  }

  await markJobActive(job, "gallery-scan", {
    type: "library-root",
    id: root.id,
    label: root.label,
  });

  const settings = await ensureLibrarySettingsRow();
  const discovery = await discoverImageFilesAndDirs(root.path, root.recursive);

  // -- Cleanup stale folder-based galleries --
  const knownFolderGalleries = await db
    .select({ id: galleries.id, folderPath: galleries.folderPath })
    .from(galleries)
    .where(
      and(
        eq(galleries.galleryType, "folder"),
        like(galleries.folderPath, `${root.path}%`)
      )
    );

  const discoveredDirSet = new Set(discovery.dirs);
  const staleFolderIds = knownFolderGalleries
    .filter((g) => g.folderPath && !discoveredDirSet.has(g.folderPath))
    .map((g) => g.id);

  if (staleFolderIds.length > 0) {
    await db.delete(galleries).where(inArray(galleries.id, staleFolderIds));
  }

  // -- Cleanup stale zip-based galleries --
  const knownZipGalleries = await db
    .select({ id: galleries.id, zipFilePath: galleries.zipFilePath })
    .from(galleries)
    .where(
      and(
        eq(galleries.galleryType, "zip"),
        like(galleries.zipFilePath, `${root.path}%`)
      )
    );

  const discoveredZipSet = new Set(discovery.zipFiles);
  const staleZipIds = knownZipGalleries
    .filter((g) => g.zipFilePath && !discoveredZipSet.has(g.zipFilePath))
    .map((g) => g.id);

  if (staleZipIds.length > 0) {
    await db.delete(galleries).where(inArray(galleries.id, staleZipIds));
  }

  // -- Cleanup stale images --
  const knownImagesInRoot = await db
    .select({ id: images.id, filePath: images.filePath })
    .from(images)
    .where(like(images.filePath, `${root.path}%`));

  const discoveredImageSet = new Set(discovery.imageFiles);
  const staleImageIds = knownImagesInRoot
    .filter((img) => {
      // Regular file: check if discovered
      if (!img.filePath.includes("::")) {
        return !discoveredImageSet.has(img.filePath);
      }
      // Zip member: check if parent zip was discovered
      const zipPath = img.filePath.split("::")[0];
      return !discoveredZipSet.has(zipPath);
    })
    .map((img) => img.id);

  if (staleImageIds.length > 0) {
    await removeGeneratedImageDirs(staleImageIds);
    await db.delete(images).where(inArray(images.id, staleImageIds));
  }

  const totalWork = discovery.dirs.length + discovery.zipFiles.length;
  let processed = 0;

  // -- Process folder-based galleries --
  // Group image files by directory
  const imagesByDir = new Map<string, string[]>();
  for (const file of discovery.imageFiles) {
    const dir = path.dirname(file);
    const existing = imagesByDir.get(dir);
    if (existing) {
      existing.push(file);
    } else {
      imagesByDir.set(dir, [file]);
    }
  }

  // Sort directories by path depth (parent before child) to ensure parentId resolution works
  const sortedDirs = [...discovery.dirs].sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);

  for (const dirPath of sortedDirs) {
    const dirImages = imagesByDir.get(dirPath) ?? [];
    if (dirImages.length === 0) continue;

    // Upsert gallery
    const [existingGallery] = await db
      .select({ id: galleries.id })
      .from(galleries)
      .where(
        and(
          eq(galleries.galleryType, "folder"),
          eq(galleries.folderPath, dirPath)
        )
      )
      .limit(1);

    let galleryId: string;

    if (existingGallery) {
      galleryId = existingGallery.id;
      await db
        .update(galleries)
        .set({ isNsfw: root.isNsfw, updatedAt: new Date() })
        .where(eq(galleries.id, galleryId));
    } else {
      // Find parent gallery
      const parentDir = path.dirname(dirPath);
      let parentId: string | null = null;
      if (parentDir !== dirPath && parentDir.startsWith(root.path)) {
        const [parentGallery] = await db
          .select({ id: galleries.id })
          .from(galleries)
          .where(
            and(
              eq(galleries.galleryType, "folder"),
              eq(galleries.folderPath, parentDir)
            )
          )
          .limit(1);
        parentId = parentGallery?.id ?? null;
      }

      const [created] = await db
        .insert(galleries)
        .values({
          title: path.basename(dirPath),
          galleryType: "folder",
          folderPath: dirPath,
          parentId,
          imageCount: 0,
          isNsfw: root.isNsfw,
        })
        .returning({ id: galleries.id });
      galleryId = created.id;
    }

    // Upsert images
    const sortedImages = [...dirImages].sort((a, b) => a.localeCompare(b));
    for (let i = 0; i < sortedImages.length; i++) {
      const filePath = sortedImages[i];

      const [existingImage] = await db
        .select({ id: images.id })
        .from(images)
        .where(eq(images.filePath, filePath))
        .limit(1);

      let imageId: string;
      let needsThumbnail = false;
      if (existingImage) {
        imageId = existingImage.id;
        await db
          .update(images)
          .set({ galleryId, sortOrder: i, isNsfw: root.isNsfw, updatedAt: new Date() })
          .where(eq(images.id, imageId));
        // Check if existing image is missing thumbnail or animated preview
        const [imgRow] = await db
          .select({ thumbnailPath: images.thumbnailPath })
          .from(images)
          .where(eq(images.id, imageId))
          .limit(1);
        if (!imgRow?.thumbnailPath) {
          needsThumbnail = true;
        } else {
          // For video formats, also check if the preview.mp4 has been generated
          const ext = path.extname(filePath).toLowerCase();
          const isVideoFormat = [".mp4", ".m4v", ".mkv", ".mov", ".webm", ".avi", ".wmv", ".flv"].includes(ext);
          if (isVideoFormat && !existsSync(path.join(getGeneratedImageDir(imageId), "preview.mp4"))) {
            needsThumbnail = true;
          }
        }
      } else {
        const [created] = await db
          .insert(images)
          .values({
            title: fileNameToTitle(filePath),
            filePath,
            galleryId,
            sortOrder: i,
            isNsfw: root.isNsfw,
          })
          .returning({ id: images.id });
        imageId = created.id;
        needsThumbnail = true;
      }

      if (needsThumbnail) {
        if (!(await shouldSkipGalleryDerivedJobs(sfwOnly, galleryId, imageId))) {
          await enqueuePendingImageJob("image-thumbnail", imageId, {
            by: "gallery-scan",
            label: `Queued during ${root.label} gallery scan`,
          });
        }
      }
      if (!existingImage && settings.autoGenerateFingerprints) {
        if (!(await shouldSkipGalleryDerivedJobs(sfwOnly, galleryId, imageId))) {
          await enqueuePendingImageJob("image-fingerprint", imageId, {
            by: "gallery-scan",
            label: `Queued during ${root.label} gallery scan`,
          });
        }
      }
    }

    // Update gallery image count
    await db.execute(sql`
      UPDATE galleries SET image_count = (
        SELECT count(*) FROM images WHERE gallery_id = ${galleryId}
      ), updated_at = NOW() WHERE id = ${galleryId}
    `);

    processed++;
    if (totalWork > 0) {
      await markJobProgress(job, "gallery-scan", Math.round((processed / totalWork) * 100));
    }
  }

  // -- Process zip-based galleries --
  for (const zipPath of discovery.zipFiles) {
    const [existingGallery] = await db
      .select({ id: galleries.id })
      .from(galleries)
      .where(
        and(
          eq(galleries.galleryType, "zip"),
          eq(galleries.zipFilePath, zipPath)
        )
      )
      .limit(1);

    let galleryId: string;

    if (existingGallery) {
      galleryId = existingGallery.id;
      await db
        .update(galleries)
        .set({ isNsfw: root.isNsfw, updatedAt: new Date() })
        .where(eq(galleries.id, galleryId));
    } else {
      const [created] = await db
        .insert(galleries)
        .values({
          title: fileNameToTitle(zipPath),
          galleryType: "zip",
          zipFilePath: zipPath,
          imageCount: 0,
          isNsfw: root.isNsfw,
        })
        .returning({ id: galleries.id });
      galleryId = created.id;
    }

    // Index zip members
    let members: string[];
    try {
      members = parseZipImageMembers(zipPath);
    } catch {
      processed++;
      continue;
    }

    for (let i = 0; i < members.length; i++) {
      const memberPath = members[i];
      const fullPath = `${zipPath}::${memberPath}`;

      const [existingImage] = await db
        .select({ id: images.id })
        .from(images)
        .where(eq(images.filePath, fullPath))
        .limit(1);

      if (!existingImage) {
        const [created] = await db
          .insert(images)
          .values({
            title: fileNameToTitle(memberPath),
            filePath: fullPath,
            galleryId,
            sortOrder: i,
            isNsfw: root.isNsfw,
          })
          .returning({ id: images.id });

        if (!(await shouldSkipGalleryDerivedJobs(sfwOnly, galleryId, created.id))) {
          await enqueuePendingImageJob("image-thumbnail", created.id, {
            by: "gallery-scan",
            label: `Queued during ${root.label} gallery scan`,
          });
        }
        if (
          settings.autoGenerateFingerprints &&
          !(await shouldSkipGalleryDerivedJobs(sfwOnly, galleryId, created.id))
        ) {
          await enqueuePendingImageJob("image-fingerprint", created.id, {
            by: "gallery-scan",
            label: `Queued during ${root.label} gallery scan`,
          });
        }
      } else {
        await db
          .update(images)
          .set({ galleryId, sortOrder: i, isNsfw: root.isNsfw, updatedAt: new Date() })
          .where(eq(images.id, existingImage.id));
        // Re-enqueue thumbnail if missing or preview missing for video formats
        const [imgRow] = await db
          .select({ thumbnailPath: images.thumbnailPath })
          .from(images)
          .where(eq(images.id, existingImage.id))
          .limit(1);
        const zipMemberExt = path.extname(memberPath).toLowerCase();
        const isZipVideoFormat = [".mp4", ".m4v", ".mkv", ".mov", ".webm", ".avi", ".wmv", ".flv"].includes(zipMemberExt);
        if (!imgRow?.thumbnailPath ||
            (isZipVideoFormat && !existsSync(path.join(getGeneratedImageDir(existingImage.id), "preview.mp4")))) {
          if (!(await shouldSkipGalleryDerivedJobs(sfwOnly, galleryId, existingImage.id))) {
            await enqueuePendingImageJob("image-thumbnail", existingImage.id, {
              by: "gallery-scan",
              label: `Queued during ${root.label} gallery scan`,
            });
          }
        }
      }
    }

    // Update gallery image count
    await db.execute(sql`
      UPDATE galleries SET image_count = (
        SELECT count(*) FROM images WHERE gallery_id = ${galleryId}
      ), updated_at = NOW() WHERE id = ${galleryId}
    `);

    processed++;
    if (totalWork > 0) {
      await markJobProgress(job, "gallery-scan", Math.round((processed / totalWork) * 100));
    }
  }
}
