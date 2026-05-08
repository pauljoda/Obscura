import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, ilike, inArray, like, sql } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import {
  discoverImageFilesAndDirs,
  extractComicInfoFromZip,
  fileNameToTitle,
  parseComicInfoXml,
  parseZipImageMembers,
  getGeneratedImageDir,
  sortPathsNaturally,
  type ComicInfoMetadata,
} from "@obscura/media-core";
import { listIgnoredMediaPathsUnderRoot } from "@obscura/app-core";
import {
  db,
  images,
  galleries,
  libraryRoots,
  galleryPerformers,
  galleryTags,
  performers,
  studios,
  tags,
} from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";
import { enqueuePendingImageJob, enqueueCollectionRefreshAll } from "../lib/enqueue.js";
import { ensureLibrarySettingsRow } from "../lib/scheduler.js";
import { removeGeneratedImageDirs } from "../lib/helpers.js";
import {
  inferComicArchiveGrouping,
  inferComicArchiveTitle,
} from "./gallery-series.js";
import {
  excludeLibraryRootDir,
  groupFilesByDirectory,
  libraryContainerTitle,
  mergeLibraryRootIntoDiscoveredDirs,
  pickStaleContainerIds,
  resolveParentPathId,
} from "../lib/hierarchy-sync/hierarchy-sync.js";

type ExistingGalleryMetadata = {
  title: string;
  details: string | null;
  date: string | null;
  urls: string[];
  studioId: string | null;
};

async function readFolderComicInfo(dirPath: string): Promise<ComicInfoMetadata | null> {
  const infoPath = path.join(dirPath, "ComicInfo.xml");
  if (!existsSync(infoPath)) return null;
  try {
    return parseComicInfoXml(await readFile(infoPath, "utf8"));
  } catch {
    return null;
  }
}

async function findOrCreateStudioId(name: string | null | undefined) {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return null;
  const [existing] = await db
    .select({ id: studios.id })
    .from(studios)
    .where(ilike(studios.name, trimmed))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(studios)
    .values({ name: trimmed })
    .returning({ id: studios.id });
  return created.id;
}

async function findOrCreatePerformerId(name: string) {
  const trimmed = name.trim();
  const [existing] = await db
    .select({ id: performers.id })
    .from(performers)
    .where(ilike(performers.name, trimmed))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(performers)
    .values({ name: trimmed })
    .returning({ id: performers.id });
  return created.id;
}

async function findOrCreateTagId(name: string) {
  const trimmed = name.trim();
  const [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(ilike(tags.name, trimmed))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(tags)
    .values({ name: trimmed })
    .returning({ id: tags.id });
  return created.id;
}

function shouldSeedText(current: string | null | undefined) {
  return !current || current.trim().length === 0;
}

async function buildComicGalleryUpdate(
  comicInfo: ComicInfoMetadata | null,
  existing?: ExistingGalleryMetadata | null,
) {
  if (!comicInfo) return {};
  const update: Record<string, unknown> = {};
  if (comicInfo.title && (!existing || shouldSeedText(existing.title))) {
    update.title = comicInfo.title;
  }
  if (comicInfo.summary && (!existing || shouldSeedText(existing.details))) {
    update.details = comicInfo.summary;
  }
  if (comicInfo.date && (!existing || shouldSeedText(existing.date))) {
    update.date = comicInfo.date;
  }
  if (comicInfo.urls.length > 0 && (!existing || existing.urls.length === 0)) {
    update.urls = comicInfo.urls;
  }
  if (comicInfo.publisher && (!existing || !existing.studioId)) {
    update.studioId = await findOrCreateStudioId(comicInfo.publisher);
  }
  return update;
}

async function attachComicGalleryRelations(galleryId: string, comicInfo: ComicInfoMetadata | null) {
  if (!comicInfo) return;
  for (const name of comicInfo.creators) {
    const performerId = await findOrCreatePerformerId(name);
    await db
      .insert(galleryPerformers)
      .values({ galleryId, performerId })
      .onConflictDoNothing();
  }
  for (const name of comicInfo.tags) {
    const tagId = await findOrCreateTagId(name);
    await db
      .insert(galleryTags)
      .values({ galleryId, tagId })
      .onConflictDoNothing();
  }
}

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
  const ignoredPaths = await listIgnoredMediaPathsUnderRoot(db, root.path);
  discovery.imageFiles = discovery.imageFiles.filter(
    (filePath) => !ignoredPaths.has(path.resolve(filePath)),
  );
  discovery.zipFiles = discovery.zipFiles.filter(
    (filePath) => !ignoredPaths.has(path.resolve(filePath)),
  );
  discovery.dirs = [
    ...new Set([
      ...discovery.imageFiles.map((filePath) => path.dirname(filePath)),
      ...discovery.zipFiles.map((filePath) => path.dirname(filePath)),
    ]),
  ];
  const sortedDirs = mergeLibraryRootIntoDiscoveredDirs(
    discovery.dirs,
    root.path,
  );
  const galleryDirs = excludeLibraryRootDir(sortedDirs, root.path);
  const discoveredDirSet = new Set(galleryDirs);
  const includeRootInParentMap = discoveredDirSet.has(root.path);

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

  const staleFolderIds = pickStaleContainerIds(knownFolderGalleries, discoveredDirSet);

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

  const totalWork = galleryDirs.length + discovery.zipFiles.length;
  let processed = 0;

  // -- Process folder-based galleries --
  // Group image files by directory
  const imagesByDir = groupFilesByDirectory(discovery.imageFiles);
  const galleryIdByPath: Map<string, string> = new Map(
    knownFolderGalleries
      .filter(
        (g): g is { id: string; folderPath: string } =>
          Boolean(g.folderPath) && (includeRootInParentMap || g.folderPath !== root.path),
      )
      .map((gallery) => [gallery.folderPath, gallery.id]),
  );

  for (const dirPath of galleryDirs) {
    const dirImages = imagesByDir.get(dirPath) ?? [];

    // Upsert gallery
    const [existingGallery] = await db
      .select({
        id: galleries.id,
        title: galleries.title,
        details: galleries.details,
        date: galleries.date,
        urls: galleries.urls,
        studioId: galleries.studioId,
      })
      .from(galleries)
      .where(
        and(
          eq(galleries.galleryType, "folder"),
          eq(galleries.folderPath, dirPath)
        )
      )
      .limit(1);

    let galleryId: string;
    const comicInfo = await readFolderComicInfo(dirPath);
    const comicUpdate = await buildComicGalleryUpdate(comicInfo, existingGallery ?? null);

    if (existingGallery) {
      galleryId = existingGallery.id;
      await db
        .update(galleries)
        .set({
          isNsfw: root.isNsfw,
          title: comicInfo?.title ?? libraryContainerTitle(
            dirPath,
            root.path,
            root.label,
          ),
          ...comicUpdate,
          updatedAt: new Date(),
        })
        .where(eq(galleries.id, galleryId));
    } else {
      // Find parent gallery
      const parentId = resolveParentPathId(
        dirPath,
        root.path,
        galleryIdByPath as Map<string, string>,
      );

      const [created] = await db
        .insert(galleries)
        .values({
          title: libraryContainerTitle(
            dirPath,
            root.path,
            root.label,
          ),
          galleryType: "folder",
          folderPath: dirPath,
          parentId,
          imageCount: 0,
          isNsfw: root.isNsfw,
          ...comicUpdate,
        })
        .returning({ id: galleries.id });
      galleryId = created.id;
      galleryIdByPath.set(dirPath, galleryId);
    }
    await attachComicGalleryRelations(galleryId, comicInfo);

    // Upsert images
    const sortedImages = sortPathsNaturally(dirImages);
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
    const fallbackTitle = fileNameToTitle(zipPath);
    const grouping = inferComicArchiveGrouping(zipPath, root.path, galleryIdByPath);
    const [existingGallery] = await db
      .select({
        id: galleries.id,
        title: galleries.title,
        details: galleries.details,
        date: galleries.date,
        urls: galleries.urls,
        studioId: galleries.studioId,
      })
      .from(galleries)
      .where(
        and(
          eq(galleries.galleryType, "zip"),
          eq(galleries.zipFilePath, zipPath)
        )
      )
      .limit(1);

    let galleryId: string;
    let comicInfo: ComicInfoMetadata | null = null;
    try {
      comicInfo = extractComicInfoFromZip(zipPath);
    } catch {
      comicInfo = null;
    }
    const comicUpdate = await buildComicGalleryUpdate(comicInfo, existingGallery ?? null);
    const scannerTitle = inferComicArchiveTitle({
      zipPath,
      fallbackTitle,
      parentTitle: grouping.parentTitle,
      comicInfoTitle: comicInfo?.title,
      comicInfoNumber: comicInfo?.number,
    });

    if (existingGallery) {
      galleryId = existingGallery.id;
      const shouldApplyScannerTitle =
        shouldSeedText(existingGallery.title) ||
        (grouping.parentId !== null &&
          existingGallery.title !== scannerTitle &&
          [fallbackTitle, comicInfo?.title].filter(Boolean).includes(existingGallery.title));
      await db
        .update(galleries)
        .set({
          isNsfw: root.isNsfw,
          parentId: grouping.parentId,
          ...comicUpdate,
          ...(shouldApplyScannerTitle ? { title: scannerTitle } : {}),
          updatedAt: new Date(),
        })
        .where(eq(galleries.id, galleryId));
    } else {
      const [created] = await db
        .insert(galleries)
        .values({
          galleryType: "zip",
          zipFilePath: zipPath,
          parentId: grouping.parentId,
          imageCount: 0,
          isNsfw: root.isNsfw,
          ...comicUpdate,
          title: scannerTitle,
        })
        .returning({ id: galleries.id });
      galleryId = created.id;
    }
    await attachComicGalleryRelations(galleryId, comicInfo);

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

  // Refresh dynamic collections after gallery scan
  await enqueueCollectionRefreshAll({
    by: "gallery-scan",
    label: "Queued after gallery scan",
  });
}
