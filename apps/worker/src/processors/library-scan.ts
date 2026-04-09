import { eq, inArray, like } from "drizzle-orm";
import type { Job } from "bullmq";
import {
  discoverVideoFiles,
  fileNameToTitle,
  normalizeNfoRating,
  readNfo,
} from "@obscura/media-core";
import { db, scenes, libraryRoots } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";
import { propagateSceneNsfw } from "../lib/nsfw.js";
import {
  enqueuePendingSceneJob,
  enqueueGalleryRootJob,
} from "../lib/enqueue.js";
import { ensureLibrarySettingsRow } from "../lib/scheduler.js";
import { pruneUntrackedLibraryReferences, removeGeneratedSceneDirs } from "../lib/helpers.js";

export async function processLibraryScan(job: Job) {
  const libraryRootId = String(job.data.libraryRootId);
  const [root] = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.id, libraryRootId))
    .limit(1);

  if (!root) {
    throw new Error("Library root not found");
  }

  await markJobActive(job, "library-scan", {
    type: "library-root",
    id: root.id,
    label: root.label,
  });

  await pruneUntrackedLibraryReferences();

  const settings = await ensureLibrarySettingsRow();

  // Only scan for videos if this root has video scanning enabled
  const scanVideos = root.scanVideos ?? true;
  const files = scanVideos ? await discoverVideoFiles(root.path, root.recursive) : [];
  const discoveredSet = new Set(files);

  const knownScenesInRoot = await db
    .select({
      id: scenes.id,
      filePath: scenes.filePath,
    })
    .from(scenes)
    .where(like(scenes.filePath, `${root.path}%`));

  const staleSceneIds = knownScenesInRoot
    .filter((scene) => scene.filePath && !discoveredSet.has(scene.filePath))
    .map((scene) => scene.id);

  if (staleSceneIds.length > 0) {
    await removeGeneratedSceneDirs(staleSceneIds);
    await db.delete(scenes).where(inArray(scenes.id, staleSceneIds));
  }

  const gallerySfwOpts = Boolean(job.data.sfwOnly) ? { sfwOnly: true as const } : undefined;

  if (files.length === 0) {
    await db
      .update(libraryRoots)
      .set({ lastScannedAt: new Date(), updatedAt: new Date() })
      .where(eq(libraryRoots.id, root.id));

    // Still trigger gallery scan even if no video files were found
    const scanImages = root.scanImages ?? true;
    if (scanImages) {
      await enqueueGalleryRootJob(
        root,
        {
          by: "library-scan",
          label: `Queued during ${root.label} scan`,
        },
        gallerySfwOpts
      );
    }
    return;
  }

  for (const [index, filePath] of files.entries()) {
    const [existing] = await db
      .select({
        id: scenes.id,
        duration: scenes.duration,
        width: scenes.width,
        codec: scenes.codec,
        checksumMd5: scenes.checksumMd5,
        oshash: scenes.oshash,
        thumbnailPath: scenes.thumbnailPath,
        cardThumbnailPath: scenes.cardThumbnailPath,
        previewPath: scenes.previewPath,
        spritePath: scenes.spritePath,
        trickplayVttPath: scenes.trickplayVttPath,
      })
      .from(scenes)
      .where(eq(scenes.filePath, filePath))
      .limit(1);

    let scene = existing;

    // Check for NFO sidecar metadata
    const nfo = await readNfo(filePath);

    if (!scene) {
      const title = nfo?.title || fileNameToTitle(filePath);

      [scene] = await db
        .insert(scenes)
        .values({
          title,
          details: nfo?.plot ?? null,
          date: nfo?.aired ?? null,
          rating: nfo?.rating != null ? normalizeNfoRating(nfo.rating) : null,
          url: nfo?.url ?? null,
          filePath,
          organized: false,
        })
        .returning({
          id: scenes.id,
          duration: scenes.duration,
          width: scenes.width,
          codec: scenes.codec,
          checksumMd5: scenes.checksumMd5,
          oshash: scenes.oshash,
          thumbnailPath: scenes.thumbnailPath,
          cardThumbnailPath: scenes.cardThumbnailPath,
          previewPath: scenes.previewPath,
          spritePath: scenes.spritePath,
          trickplayVttPath: scenes.trickplayVttPath,
        });
    } else if (nfo) {
      // Enrich existing scene with NFO data for any fields that are currently empty
      const [current] = await db
        .select({
          details: scenes.details,
          date: scenes.date,
          rating: scenes.rating,
          url: scenes.url,
        })
        .from(scenes)
        .where(eq(scenes.id, scene.id))
        .limit(1);

      if (current) {
        const patch: Record<string, unknown> = {};
        if (!current.details && nfo.plot) patch.details = nfo.plot;
        if (!current.date && nfo.aired) patch.date = nfo.aired;
        if (current.rating == null && nfo.rating != null) {
          const normalized = normalizeNfoRating(nfo.rating);
          if (normalized != null) patch.rating = normalized;
        }
        if (!current.url && nfo.url) patch.url = nfo.url;

        if (Object.keys(patch).length > 0) {
          patch.updatedAt = new Date();
          await db.update(scenes).set(patch).where(eq(scenes.id, scene.id));
        }
      }
    }

    // Propagate isNsfw: library root flag takes precedence, then relation-based
    await propagateSceneNsfw(scene.id, root.isNsfw);

    const sfwOnly = Boolean(job.data.sfwOnly);
    const [nsfwRow] = await db
      .select({ isNsfw: scenes.isNsfw })
      .from(scenes)
      .where(eq(scenes.id, scene.id))
      .limit(1);
    const skipHeavySceneJobs = sfwOnly && Boolean(nsfwRow?.isNsfw);

    if (
      !skipHeavySceneJobs &&
      settings.autoGenerateMetadata &&
      (!scene.duration || !scene.width || !scene.codec)
    ) {
      await enqueuePendingSceneJob("media-probe", scene.id, {
        by: "library-scan",
        label: `Queued during ${root.label} scan`,
      });
    }

    if (
      !skipHeavySceneJobs &&
      settings.autoGenerateFingerprints &&
      (!scene.checksumMd5 || !scene.oshash)
    ) {
      await enqueuePendingSceneJob("fingerprint", scene.id, {
        by: "library-scan",
        label: `Queued during ${root.label} scan`,
      });
    }

    {
      const hasCustomThumb = scene.thumbnailPath?.includes("thumb-custom") ?? false;
      const isMissingGeneratedThumbnail =
        !hasCustomThumb && (!scene.thumbnailPath || !scene.cardThumbnailPath);
      const isMissingDerivedAssets = !scene.previewPath || !scene.spritePath || !scene.trickplayVttPath;

      if (
        !skipHeavySceneJobs &&
        settings.autoGeneratePreview &&
        (isMissingGeneratedThumbnail || isMissingDerivedAssets)
      ) {
        await enqueuePendingSceneJob("preview", scene.id, {
          by: "library-scan",
          label: `Queued during ${root.label} scan`,
        });
      }
    }

    await markJobProgress(
      job,
      "library-scan",
      Math.max(1, Math.round(((index + 1) / files.length) * 100))
    );
  }

  await db
    .update(libraryRoots)
    .set({ lastScannedAt: new Date(), updatedAt: new Date() })
    .where(eq(libraryRoots.id, root.id));

  // Trigger gallery scan if this root has image scanning enabled
  const scanImages = root.scanImages ?? true;
  if (scanImages) {
    await enqueueGalleryRootJob(
      root,
      {
        by: "library-scan",
        label: `Queued during ${root.label} scan`,
      },
      gallerySfwOpts
    );
  }
}
