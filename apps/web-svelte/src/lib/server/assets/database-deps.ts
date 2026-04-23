import { asc, eq } from "drizzle-orm";
import { getCollectionDetailRead } from "@obscura/app-core";
import { resolveExistingMediaPath } from "@obscura/media-core";
import { schema, type AppDb } from "@obscura/db";
import type { AssetResolverDeps } from "./resolve-asset-request";

const { galleries, images, librarySettings, videoEpisodes, videoMovies } = schema;

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
      const [existing] = await db.select().from(librarySettings).limit(1);
      if (existing) {
        return existing.metadataStorageDedicated ?? true;
      }

      const [created] = await db.insert(librarySettings).values({}).returning();
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

    async getCollectionDetail(id) {
      return getCollectionDetailRead(db, id);
    },
  };
}
