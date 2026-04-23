/**
 * Tag read helpers shared by the Fastify API and the SvelteKit server.
 *
 * These functions take a typed Drizzle database as an explicit argument
 * so both hosts can call through without depending on each other's
 * runtime. Write-side operations stay in the per-app service layer.
 */
import { schema, type AppDb } from "@obscura/db";
import { eq, ne, sql } from "drizzle-orm";
import {
  tagSfwSceneCountExpr,
  tagTotalSceneCountExpr,
} from "./appearance-count-expressions";
import { imageVisibleSql } from "./library-root-visibility";

const { tags, imageTags, images } = schema;

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
  imageCount: number;
}

export async function listTagsRead(
  db: AppDb,
  sfwOnly: boolean,
): Promise<{ tags: TagListEntry[] }> {
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
    imageCount: imageMap.get(tag.id) ?? 0,
  }));

  mapped.sort((a, b) => b.videoCount - a.videoCount);

  return { tags: mapped };
}
