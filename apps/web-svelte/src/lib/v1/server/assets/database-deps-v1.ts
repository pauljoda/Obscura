import { asc, eq, inArray } from "drizzle-orm";
import { getCollectionDetailRead } from "@obscura/app-core";
import { resolveExistingMediaPath } from "@obscura/media-core";
import { schema, type AppDb } from "@obscura/db";
import type { AssetResolverDeps } from "./resolve-asset-request-v1";

const { galleries, images, bookPages, librarySettings, videoEpisodes, videoMovies } = schema;

export function createDbAssetDeps(db: AppDb): AssetResolverDeps {
  return {
    async resolveVideoFilePath(id) {
      const [episode] = await db
        .select({ filePath: videoEpisodes.filePath })
        .from(videoEpisodes)
        .where(eq(videoEpisodes.id, id))
        .limit(1);
      if (episode?.filePath) {
        return resolveExistingMediaPath(episode.filePath) ?? episode.filePath;
      }

      const [movie] = await db
        .select({ filePath: videoMovies.filePath })
        .from(videoMovies)
        .where(eq(videoMovies.id, id))
        .limit(1);
      return resolveExistingMediaPath(movie?.filePath) ?? movie?.filePath ?? null;
    },

    async getMetadataStorageDedicated() {
      const metadataStorageSelection = {
        metadataStorageDedicated: librarySettings.metadataStorageDedicated,
      };
      const [existing] = await db
        .select(metadataStorageSelection)
        .from(librarySettings)
        .limit(1);
      if (existing) {
        return existing.metadataStorageDedicated ?? true;
      }

      const [created] = await db
        .insert(librarySettings)
        .values({})
        .returning(metadataStorageSelection);
      return created.metadataStorageDedicated ?? true;
    },

    async getGalleryCover(id) {
      const [gallery] = await db
        .select({ coverImageId: galleries.coverImageId })
        .from(galleries)
        .where(eq(galleries.id, id))
        .limit(1);

      if (!gallery) {
        return { found: false, coverImageId: null };
      }

      let coverImageId = gallery.coverImageId;
      if (!coverImageId) {
        const [firstImage] = await db
          .select({ id: images.id })
          .from(images)
          .where(eq(images.galleryId, id))
          .orderBy(asc(images.sortOrder))
          .limit(1);
        coverImageId = firstImage?.id ?? null;
      }

      if (!coverImageId) {
        const childCoverCandidates: string[] = [];
        const childGalleries = await db
          .select({ id: galleries.id, coverImageId: galleries.coverImageId })
          .from(galleries)
          .where(eq(galleries.parentId, id))
          .limit(8);

        for (const child of childGalleries) {
          if (child.coverImageId) {
            childCoverCandidates.push(child.coverImageId);
            continue;
          }

          const [firstChildImage] = await db
            .select({ id: images.id })
            .from(images)
            .where(eq(images.galleryId, child.id))
            .orderBy(asc(images.sortOrder))
            .limit(1);
          if (firstChildImage?.id) {
            childCoverCandidates.push(firstChildImage.id);
          }
        }

        if (childCoverCandidates.length > 0) {
          const childCoverRows = await db
            .select({ id: images.id, width: images.width, height: images.height })
            .from(images)
            .where(inArray(images.id, childCoverCandidates));
          coverImageId =
            childCoverRows.sort(
              (a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0),
            )[0]?.id ?? childCoverCandidates[0] ?? null;
        }
      }

      return { found: true, coverImageId };
    },

    async getImageRecord(id) {
      const [image] = await db
        .select({ filePath: images.filePath, format: images.format })
        .from(images)
        .where(eq(images.id, id))
        .limit(1);
      return image ?? null;
    },

    async getBookPageRecord(id) {
      const [page] = await db
        .select({ filePath: bookPages.filePath, format: bookPages.format })
        .from(bookPages)
        .where(eq(bookPages.id, id))
        .limit(1);
      return page ?? null;
    },

    async getCollectionDetail(id) {
      return getCollectionDetailRead(db, id);
    },
  };
}
