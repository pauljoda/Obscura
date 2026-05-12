/**
 * Tag read helpers for the first-party API surface.
 *
 * These functions take a typed Drizzle database as an explicit argument
 * so route handlers can call through without coupling to a global
 * runtime.
 */
import { schema, type AppDb } from "@obscura/db";
import { eq, ne, sql } from "drizzle-orm";
import {
  tagSfwSceneCountExpr,
  tagTotalSceneCountExpr,
} from "./appearance-count-expressions";
import {
  audioTrackVisibleSql,
  galleryVisibleSql,
  imageVisibleSql,
} from "./library-root-visibility";
import { applyTagListQuery, type TagStudioListQuery } from "./tag-studio-list-query";

const {
  tags,
  galleryTags,
  galleries,
  imageTags,
  images,
  audioTrackTags,
  audioTracks,
} = schema;

export interface TagDetail {
  id: string;
  name: string;
  description: string | null;
  aliases: string | null;
  parentId: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  isNsfw: boolean;
  ignoreAutoTag: boolean;
  videoCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function getTagByIdRead(
  db: AppDb,
  id: string,
  sfwOnly: boolean,
): Promise<TagDetail | null> {
  const row = await db.query.tags.findFirst({ where: eq(tags.id, id) });
  if (!row) return null;

  const [cnt] = await db
    .select({
      n: sfwOnly ? tagSfwSceneCountExpr() : tagTotalSceneCountExpr(),
    })
    .from(tags)
    .where(eq(tags.id, id));

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    aliases: row.aliases,
    parentId: row.parentId,
    imageUrl: row.imageUrl,
    imagePath: row.imagePath,
    favorite: row.favorite,
    rating: row.rating,
    isNsfw: row.isNsfw,
    ignoreAutoTag: row.ignoreAutoTag,
    videoCount: Number(cnt?.n ?? 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface TagListEntry {
  id: string;
  name: string;
  description: string | null;
  aliases: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  isNsfw: boolean;
  videoCount: number;
  galleryCount: number;
  imageCount: number;
  audioTrackCount: number;
}

export async function listTagsRead(
  db: AppDb,
  queryOrSfwOnly: boolean | TagStudioListQuery = {},
): Promise<{ tags: TagListEntry[]; total: number; limit: number; offset: number }> {
  const query =
    typeof queryOrSfwOnly === "boolean"
      ? { nsfw: queryOrSfwOnly ? "off" : undefined }
      : queryOrSfwOnly;
  const sfwOnly = query.nsfw === "off";
  const sceneCountExpr = sfwOnly
    ? tagSfwSceneCountExpr()
    : tagTotalSceneCountExpr();

  const imageAgg = sfwOnly
    ? await db
        .select({
          tagId: imageTags.tagId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(imageTags)
        .innerJoin(images, eq(images.id, imageTags.imageId))
        .where(sql`${imageVisibleSql(images.filePath)} AND ${ne(images.isNsfw, true)}`)
        .groupBy(imageTags.tagId)
    : await db
        .select({
          tagId: imageTags.tagId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(imageTags)
        .innerJoin(images, eq(images.id, imageTags.imageId))
        .where(imageVisibleSql(images.filePath))
        .groupBy(imageTags.tagId);
  const imageMap = new Map(imageAgg.map((r) => [r.tagId, Number(r.cnt)]));

  const galleryAgg = sfwOnly
    ? await db
        .select({
          tagId: galleryTags.tagId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(galleryTags)
        .innerJoin(galleries, eq(galleries.id, galleryTags.galleryId))
        .where(
          sql`${galleryVisibleSql(galleries.folderPath, galleries.zipFilePath)}
            AND ${ne(galleries.isNsfw, true)}`,
        )
        .groupBy(galleryTags.tagId)
    : await db
        .select({
          tagId: galleryTags.tagId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(galleryTags)
        .innerJoin(galleries, eq(galleries.id, galleryTags.galleryId))
        .where(galleryVisibleSql(galleries.folderPath, galleries.zipFilePath))
        .groupBy(galleryTags.tagId);
  const galleryMap = new Map(galleryAgg.map((r) => [r.tagId, Number(r.cnt)]));

  const audioTrackAgg = sfwOnly
    ? await db
        .select({
          tagId: audioTrackTags.tagId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(audioTrackTags)
        .innerJoin(audioTracks, eq(audioTracks.id, audioTrackTags.trackId))
        .where(
          sql`${audioTrackVisibleSql(audioTracks.filePath)}
            AND ${ne(audioTracks.isNsfw, true)}`,
        )
        .groupBy(audioTrackTags.tagId)
    : await db
        .select({
          tagId: audioTrackTags.tagId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(audioTrackTags)
        .innerJoin(audioTracks, eq(audioTracks.id, audioTrackTags.trackId))
        .where(audioTrackVisibleSql(audioTracks.filePath))
        .groupBy(audioTrackTags.tagId);
  const audioTrackMap = new Map(audioTrackAgg.map((r) => [r.tagId, Number(r.cnt)]));

  const tagRows = await db
    .select({
      id: tags.id,
      name: tags.name,
      description: tags.description,
      aliases: tags.aliases,
      imagePath: tags.imagePath,
      favorite: tags.favorite,
      rating: tags.rating,
      isNsfw: tags.isNsfw,
      videoCount: sceneCountExpr,
    })
    .from(tags)
    .where(sfwOnly ? ne(tags.isNsfw, true) : undefined);

  const mapped: TagListEntry[] = tagRows.map((tag) => ({
    ...tag,
    videoCount: Number(tag.videoCount ?? 0),
    galleryCount: galleryMap.get(tag.id) ?? 0,
    imageCount: imageMap.get(tag.id) ?? 0,
    audioTrackCount: audioTrackMap.get(tag.id) ?? 0,
  }));

  return applyTagListQuery(mapped, query);
}
