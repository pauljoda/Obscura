/**
 * Performer read helpers for the first-party API surface.
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

function normalizeRole(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

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

export type PerformerKnownForEntry =
  | {
      sourceType: "series";
      sourceId: string;
      sourceTitle: string;
      character: string | null;
      seriesId: string;
      seriesTitle: string;
      seasonNumber: null;
      episodeNumber: null;
    }
  | {
      sourceType: "movie";
      sourceId: string;
      sourceTitle: string;
      character: string | null;
      seriesId: null;
      seriesTitle: null;
      seasonNumber: null;
      episodeNumber: null;
    }
  | {
      sourceType: "episode";
      sourceId: string;
      sourceTitle: string | null;
      character: string | null;
      seriesId: string;
      seriesTitle: string;
      seasonNumber: number | null;
      episodeNumber: number | null;
    };

export async function listPerformerKnownFor(
  db: AppDb,
  performerId: string,
  sfwOnly: boolean,
): Promise<PerformerKnownForEntry[]> {
  const [seriesRows, movieRows, episodeRows] = await Promise.all([
    db
      .select({
        sourceId: schema.videoSeries.id,
        title: schema.videoSeries.title,
        customName: schema.videoSeries.customName,
        character: schema.videoSeriesPerformers.character,
        isNsfw: schema.videoSeries.isNsfw,
      })
      .from(schema.videoSeriesPerformers)
      .innerJoin(
        schema.videoSeries,
        eq(schema.videoSeriesPerformers.seriesId, schema.videoSeries.id),
      )
      .where(eq(schema.videoSeriesPerformers.performerId, performerId)),
    db
      .select({
        sourceId: schema.videoMovies.id,
        title: schema.videoMovies.title,
        character: schema.videoMoviePerformers.character,
        isNsfw: schema.videoMovies.isNsfw,
      })
      .from(schema.videoMoviePerformers)
      .innerJoin(
        schema.videoMovies,
        eq(schema.videoMoviePerformers.movieId, schema.videoMovies.id),
      )
      .where(eq(schema.videoMoviePerformers.performerId, performerId)),
    db
      .select({
        sourceId: schema.videoEpisodes.id,
        title: schema.videoEpisodes.title,
        character: schema.videoEpisodePerformers.character,
        seasonNumber: schema.videoEpisodes.seasonNumber,
        episodeNumber: schema.videoEpisodes.episodeNumber,
        isNsfw: schema.videoEpisodes.isNsfw,
        seriesId: schema.videoSeries.id,
        seriesTitle: schema.videoSeries.title,
        seriesCustomName: schema.videoSeries.customName,
        seriesIsNsfw: schema.videoSeries.isNsfw,
        seriesCharacter: schema.videoSeriesPerformers.character,
      })
      .from(schema.videoEpisodePerformers)
      .innerJoin(
        schema.videoEpisodes,
        eq(schema.videoEpisodePerformers.episodeId, schema.videoEpisodes.id),
      )
      .innerJoin(
        schema.videoSeries,
        eq(schema.videoEpisodes.seriesId, schema.videoSeries.id),
      )
      .leftJoin(
        schema.videoSeriesPerformers,
        and(
          eq(schema.videoSeriesPerformers.seriesId, schema.videoSeries.id),
          eq(
            schema.videoSeriesPerformers.performerId,
            schema.videoEpisodePerformers.performerId,
          ),
        ),
      )
      .where(eq(schema.videoEpisodePerformers.performerId, performerId)),
  ]);

  const knownFor: PerformerKnownForEntry[] = [
    ...seriesRows
      .filter((row) => !sfwOnly || !row.isNsfw)
      .map((row) => ({
        sourceType: "series" as const,
        sourceId: row.sourceId,
        sourceTitle: row.customName ?? row.title,
        character: normalizeRole(row.character),
        seriesId: row.sourceId,
        seriesTitle: row.customName ?? row.title,
        seasonNumber: null,
        episodeNumber: null,
      }))
      .filter((row) => row.character),
    ...movieRows
      .filter((row) => !sfwOnly || !row.isNsfw)
      .map((row) => ({
        sourceType: "movie" as const,
        sourceId: row.sourceId,
        sourceTitle: row.title,
        character: normalizeRole(row.character),
        seriesId: null,
        seriesTitle: null,
        seasonNumber: null,
        episodeNumber: null,
      }))
      .filter((row) => row.character),
    ...episodeRows
      .filter((row) => !sfwOnly || (!row.isNsfw && !row.seriesIsNsfw))
      .map((row) => {
        const character = normalizeRole(row.character);
        const seriesCharacter = normalizeRole(row.seriesCharacter);
        return {
          sourceType: "episode" as const,
          sourceId: row.sourceId,
          sourceTitle: row.title,
          character,
          seriesId: row.seriesId,
          seriesTitle: row.seriesCustomName ?? row.seriesTitle,
          seasonNumber: row.seasonNumber,
          episodeNumber: row.episodeNumber,
          duplicateOfSeriesRole:
            character !== null &&
            seriesCharacter !== null &&
            character === seriesCharacter,
        };
      })
      .filter((row) => row.character && !row.duplicateOfSeriesRole)
      .map(({ duplicateOfSeriesRole: _duplicate, ...row }) => row),
  ];

  const sourceRank = { series: 0, movie: 1, episode: 2 } as const;
  knownFor.sort((a, b) => {
    const bySource = sourceRank[a.sourceType] - sourceRank[b.sourceType];
    if (bySource !== 0) return bySource;
    const bySeries = (a.seriesTitle ?? "").localeCompare(b.seriesTitle ?? "");
    if (bySeries !== 0) return bySeries;
    const byTitle = (a.sourceTitle ?? "").localeCompare(b.sourceTitle ?? "");
    if (byTitle !== 0) return byTitle;
    return (a.character ?? "").localeCompare(b.character ?? "");
  });

  return knownFor;
}

export interface PerformerDetail {
  id: string;
  name: string;
  disambiguation: string | null;
  aliases: string | null;
  gender: string | null;
  birthdate: string | null;
  country: string | null;
  ethnicity: string | null;
  eyeColor: string | null;
  hairColor: string | null;
  height: number | null;
  weight: number | null;
  measurements: string | null;
  tattoos: string | null;
  piercings: string | null;
  careerStart: number | null;
  careerEnd: number | null;
  details: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  isNsfw: boolean;
  videoCount: number;
  knownFor: PerformerKnownForEntry[];
  tags: Array<{ id: string; name: string; isNsfw: boolean }>;
  createdAt: string;
  updatedAt: string;
}

export async function getPerformerByIdRead(
  db: AppDb,
  id: string,
  sfwOnly: boolean,
): Promise<PerformerDetail | null> {
  const row = await db.query.performers.findFirst({
    where: eq(performers.id, id),
    with: {
      performerTags: {
        with: { tag: true },
      },
    },
  });
  if (!row) return null;
  if (sfwOnly && row.isNsfw) return null;

  const [cnt] = await db
    .select({
      n: sfwOnly
        ? performerSfwSceneCountExpr()
        : performerTotalSceneCountExpr(),
    })
    .from(performers)
    .where(eq(performers.id, id));
  const videoCount = Number(cnt?.n ?? 0);
  const knownFor = await listPerformerKnownFor(db, id, sfwOnly);

  return {
    id: row.id,
    name: row.name,
    disambiguation: row.disambiguation,
    aliases: row.aliases,
    gender: row.gender,
    birthdate: row.birthdate,
    country: row.country,
    ethnicity: row.ethnicity,
    eyeColor: row.eyeColor,
    hairColor: row.hairColor,
    height: row.height,
    weight: row.weight,
    measurements: row.measurements,
    tattoos: row.tattoos,
    piercings: row.piercings,
    careerStart: row.careerStart,
    careerEnd: row.careerEnd,
    details: row.details,
    imageUrl: row.imageUrl,
    imagePath: row.imagePath,
    favorite: row.favorite,
    rating: row.rating,
    isNsfw: row.isNsfw,
    videoCount,
    knownFor,
    tags: row.performerTags.map((pt) => ({
      id: pt.tag.id,
      name: pt.tag.name,
      isNsfw: pt.tag.isNsfw,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
