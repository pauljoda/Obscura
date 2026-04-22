/**
 * Performer read helpers shared by the Fastify API and the SvelteKit server.
 */
import { schema, type AppDb } from "@obscura/db";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  performerAudioLibraryCountExpr,
  performerImageAppearanceCountExpr,
  performerSfwSceneCountExpr,
  performerTotalSceneCountExpr,
} from "./appearance-count-expressions";

const { performers } = schema;

export const MAX_PERFORMER_LIST_LIMIT = 50_000;

export interface ListPerformersQuery {
  search?: string;
  sort?: string;
  order?: string;
  gender?: string;
  favorite?: string;
  country?: string;
  limit?: string;
  offset?: string;
  nsfw?: string;
  ratingMin?: string;
  ratingMax?: string;
  hasImage?: string;
  videoCountMin?: string;
}

export interface PerformerListEntry {
  id: string;
  name: string;
  disambiguation: string | null;
  gender: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  isNsfw: boolean;
  videoCount: number;
  imageAppearanceCount: number;
  audioLibraryCount: number;
  country: string | null;
  createdAt: string;
}

export interface PerformerListResult {
  performers: PerformerListEntry[];
  total: number;
  limit: number;
  offset: number;
}

function clampPagination(
  limitStr: string | undefined,
  offsetStr: string | undefined,
  defaultLimit: number,
  maxLimit: number,
) {
  return {
    limit: Math.min(Number(limitStr) || defaultLimit, maxLimit),
    offset: Number(offsetStr) || 0,
  };
}

export async function listPerformersRead(
  db: AppDb,
  query: ListPerformersQuery,
): Promise<PerformerListResult> {
  const { limit, offset } = clampPagination(
    query.limit,
    query.offset,
    50,
    MAX_PERFORMER_LIST_LIMIT,
  );
  const sfwOnly = query.nsfw === "off";

  const sfwPerformerSceneCountExpr = performerSfwSceneCountExpr();
  const totalPerformerSceneCountExpr = performerTotalSceneCountExpr();

  const conditions = [];

  if (sfwOnly) {
    conditions.push(ne(performers.isNsfw, true));
  }

  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(
      or(
        ilike(performers.name, term),
        ilike(performers.aliases, term),
        ilike(performers.disambiguation, term),
      )!,
    );
  }

  if (query.gender) {
    conditions.push(ilike(performers.gender, query.gender));
  }

  if (query.favorite === "true") {
    conditions.push(eq(performers.favorite, true));
  }

  if (query.country) {
    conditions.push(ilike(performers.country, query.country));
  }

  const pRatingMin =
    query.ratingMin !== undefined ? Number(query.ratingMin) : NaN;
  if (Number.isInteger(pRatingMin) && pRatingMin >= 1 && pRatingMin <= 5) {
    conditions.push(
      and(isNotNull(performers.rating), gte(performers.rating, pRatingMin))!,
    );
  }
  const pRatingMax =
    query.ratingMax !== undefined ? Number(query.ratingMax) : NaN;
  if (Number.isInteger(pRatingMax) && pRatingMax >= 1 && pRatingMax <= 5) {
    conditions.push(
      and(isNotNull(performers.rating), lte(performers.rating, pRatingMax))!,
    );
  }

  if (query.hasImage === "true") {
    conditions.push(isNotNull(performers.imagePath));
  }
  if (query.hasImage === "false") {
    conditions.push(isNull(performers.imagePath));
  }

  const vcm =
    query.videoCountMin !== undefined ? Number(query.videoCountMin) : NaN;
  if (Number.isInteger(vcm) && vcm >= 1) {
    conditions.push(
      gte(
        sfwOnly ? sfwPerformerSceneCountExpr : totalPerformerSceneCountExpr,
        vcm,
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sceneCountSelect = sfwOnly
    ? sfwPerformerSceneCountExpr
    : totalPerformerSceneCountExpr;

  const sortDir = query.order === "asc" ? asc : desc;
  const sortAsc = query.order === "asc" ? asc : null;
  let orderBy;
  switch (query.sort) {
    case "name":
      orderBy = (sortAsc ?? asc)(performers.name);
      break;
    case "videos":
      orderBy =
        query.order === "asc" ? asc(sceneCountSelect) : desc(sceneCountSelect);
      break;
    case "rating":
      orderBy = sortDir(performers.rating);
      break;
    case "recent":
    default:
      orderBy = sortDir(performers.createdAt);
      break;
  }

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: performers.id,
        name: performers.name,
        disambiguation: performers.disambiguation,
        gender: performers.gender,
        imagePath: performers.imagePath,
        favorite: performers.favorite,
        rating: performers.rating,
        isNsfw: performers.isNsfw,
        videoCount: sceneCountSelect,
        imageAppearanceCount: performerImageAppearanceCountExpr(sfwOnly),
        audioLibraryCount: performerAudioLibraryCountExpr(sfwOnly),
        country: performers.country,
        createdAt: performers.createdAt,
      })
      .from(performers)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(performers)
      .where(where),
  ]);

  return {
    performers: rows.map((r) => ({
      ...r,
      videoCount: Number(r.videoCount ?? 0),
      imageAppearanceCount: Number(r.imageAppearanceCount ?? 0),
      audioLibraryCount: Number(r.audioLibraryCount ?? 0),
      createdAt: r.createdAt.toISOString(),
    })),
    total: countResult[0]?.count ?? 0,
    limit,
    offset,
  };
}
