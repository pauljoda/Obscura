/**
 * Studio read helpers for the first-party API surface.
 */
import { schema, type AppDb } from "@obscura/db";
import { asc, eq, ne, sql } from "drizzle-orm";
import {
  studioAudioLibraryCountExpr,
  studioImageAppearanceCountExpr,
  studioSfwSceneCountExpr,
  studioTotalSceneCountExpr,
} from "./appearance-count-expressions";
import {
  videoMovieVisibleSql,
  videoSeriesVisibleSql,
} from "./library-root-visibility";
import { applyStudioListQuery, type TagStudioListQuery } from "./tag-studio-list-query";

const { studios } = schema;

export interface StudioListEntry {
  id: string;
  name: string;
  description: string | null;
  aliases: string | null;
  url: string | null;
  parentId: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  isNsfw: boolean;
  videoCount: number;
  imageAppearanceCount: number;
  audioLibraryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function listStudiosRead(
  db: AppDb,
  queryOrSfwOnly: boolean | TagStudioListQuery = {},
): Promise<{ studios: StudioListEntry[]; total: number; limit: number; offset: number }> {
  const query =
    typeof queryOrSfwOnly === "boolean"
      ? { nsfw: queryOrSfwOnly ? "off" : undefined }
      : queryOrSfwOnly;
  const sfwOnly = query.nsfw === "off";
  const rows = await db
    .select({
      id: studios.id,
      name: studios.name,
      description: studios.description,
      aliases: studios.aliases,
      url: studios.url,
      parentId: studios.parentId,
      imageUrl: studios.imageUrl,
      imagePath: studios.imagePath,
      favorite: studios.favorite,
      rating: studios.rating,
      isNsfw: studios.isNsfw,
      videoCount: sfwOnly
        ? studioSfwSceneCountExpr()
        : studioTotalSceneCountExpr(),
      createdAt: studios.createdAt,
      updatedAt: studios.updatedAt,
      imageAppearanceCount: studioImageAppearanceCountExpr(sfwOnly),
      audioLibraryCount: studioAudioLibraryCountExpr(sfwOnly),
    })
    .from(studios)
    .where(sfwOnly ? ne(studios.isNsfw, true) : undefined)
    .orderBy(asc(studios.name));

  const mapped = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    aliases: r.aliases,
    url: r.url,
    parentId: r.parentId,
    imageUrl: r.imageUrl,
    imagePath: r.imagePath,
    favorite: r.favorite,
    rating: r.rating,
    isNsfw: r.isNsfw,
    videoCount: Number(r.videoCount ?? 0),
    imageAppearanceCount: Number(r.imageAppearanceCount ?? 0),
    audioLibraryCount: Number(r.audioLibraryCount ?? 0),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return applyStudioListQuery(mapped, query);
}

export interface StudioDetailParent {
  id: string;
  name: string;
  imagePath: string | null;
  imageUrl: string | null;
}

export interface StudioDetailChild {
  id: string;
  name: string;
  imagePath: string | null;
  imageUrl: string | null;
  videoCount: number;
}

export interface StudioDetail {
  id: string;
  name: string;
  description: string | null;
  aliases: string | null;
  url: string | null;
  parentId: string | null;
  parent: StudioDetailParent | null;
  childStudios: StudioDetailChild[];
  imageUrl: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  isNsfw: boolean;
  videoCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function getStudioByIdRead(
  db: AppDb,
  id: string,
  sfwOnly: boolean,
): Promise<StudioDetail | null> {
  const row = await db.query.studios.findFirst({
    where: eq(studios.id, id),
    with: {
      parent: {
        columns: { id: true, name: true, imagePath: true, imageUrl: true },
      },
      children: {
        columns: {
          id: true,
          name: true,
          imagePath: true,
          imageUrl: true,
          isNsfw: true,
        },
        orderBy: asc(studios.name),
      },
    },
  });
  if (!row) return null;
  if (sfwOnly && row.isNsfw) return null;

  const studioIdsForCounts = [row.id, ...row.children.map((c) => c.id)];
  const epNsfwClause = sfwOnly ? sql`AND (ve.is_nsfw IS NOT TRUE)` : sql``;
  const movieNsfwClause = sfwOnly ? sql`AND (vm.is_nsfw IS NOT TRUE)` : sql``;
  const sceneCountsByStudio = await db.execute<{
    studio_id: string;
    cnt: number;
  }>(sql`
    SELECT studio_id::text AS studio_id, SUM(cnt)::int AS cnt FROM (
      SELECT vs.studio_id AS studio_id, COUNT(*)::int AS cnt
      FROM video_episodes ve
      INNER JOIN video_series vs ON vs.id = ve.series_id
      WHERE vs.studio_id IS NOT NULL
        AND vs.studio_id IN ${
          studioIdsForCounts.length > 0
            ? sql`(${sql.join(
                studioIdsForCounts.map((sid) => sql`${sid}::uuid`),
                sql`, `,
              )})`
            : sql`(NULL)`
        }
        AND ${videoSeriesVisibleSql(sql.raw("vs.library_root_id"))}
        ${epNsfwClause}
      GROUP BY vs.studio_id
      UNION ALL
      SELECT vm.studio_id AS studio_id, COUNT(*)::int AS cnt
      FROM video_movies vm
      WHERE vm.studio_id IS NOT NULL
        AND vm.studio_id IN ${
          studioIdsForCounts.length > 0
            ? sql`(${sql.join(
                studioIdsForCounts.map((sid) => sql`${sid}::uuid`),
                sql`, `,
              )})`
            : sql`(NULL)`
        }
        AND ${videoMovieVisibleSql(sql.raw("vm.library_root_id"))}
        ${movieNsfwClause}
      GROUP BY vm.studio_id
    ) combined
    GROUP BY studio_id
  `);
  const sceneCountBy = new Map<string, number>();
  for (const r of sceneCountsByStudio as unknown as Array<{
    studio_id: string;
    cnt: number;
  }>) {
    sceneCountBy.set(r.studio_id, Number(r.cnt ?? 0));
  }

  const videoCount = sceneCountBy.get(row.id) ?? 0;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    aliases: row.aliases,
    url: row.url,
    parentId: row.parentId,
    parent: row.parent
      ? {
          id: row.parent.id,
          name: row.parent.name,
          imagePath: row.parent.imagePath,
          imageUrl: row.parent.imageUrl,
        }
      : null,
    childStudios: row.children
      .filter((c) => !sfwOnly || !c.isNsfw)
      .map((c) => ({
        id: c.id,
        name: c.name,
        imagePath: c.imagePath,
        imageUrl: c.imageUrl,
        videoCount: sceneCountBy.get(c.id) ?? 0,
      })),
    imageUrl: row.imageUrl,
    imagePath: row.imagePath,
    favorite: row.favorite,
    rating: row.rating,
    isNsfw: row.isNsfw,
    videoCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
