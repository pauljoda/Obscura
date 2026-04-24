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
  performerAudioTrackCountExpr,
  performerGalleryCountExpr,
  performerImageCountExpr,
  performerImageAppearanceCountExpr,
  performerSfwSceneCountExpr,
  performerSeriesCountExpr,
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
  counts?: string;
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
  seriesCount: number;
  galleryCount: number;
  imageCount: number;
  imageAppearanceCount: number;
  audioLibraryCount: number;
  audioTrackCount: number;
  appearanceCount: number;
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
  const requiresCounts =
    query.sort === "videos" ||
    query.sort === "appearances" ||
    query.videoCountMin !== undefined;
  const includeCounts = query.counts !== "false" || requiresCounts;

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

  const zeroCountSelect = sql<number>`0`;
  const sceneCountSelect = includeCounts
    ? sfwOnly
      ? sfwPerformerSceneCountExpr
      : totalPerformerSceneCountExpr
    : zeroCountSelect;
  const seriesCountSelect = includeCounts ? performerSeriesCountExpr(sfwOnly) : zeroCountSelect;
  const galleryCountSelect = includeCounts ? performerGalleryCountExpr(sfwOnly) : zeroCountSelect;
  const imageCountSelect = includeCounts ? performerImageCountExpr(sfwOnly) : zeroCountSelect;
  const imageAppearanceCountSelect = includeCounts
    ? performerImageAppearanceCountExpr(sfwOnly)
    : zeroCountSelect;
  const audioLibraryCountSelect = includeCounts
    ? performerAudioLibraryCountExpr(sfwOnly)
    : zeroCountSelect;
  const audioTrackCountSelect = includeCounts
    ? performerAudioTrackCountExpr(sfwOnly)
    : zeroCountSelect;
  const appearanceCountSelect = sql<number>`(
    ${sceneCountSelect}
    + ${seriesCountSelect}
    + ${galleryCountSelect}
    + ${imageCountSelect}
    + ${audioLibraryCountSelect}
    + ${audioTrackCountSelect}
  )`;

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
    case "appearances":
      orderBy =
        query.order === "asc" ? asc(appearanceCountSelect) : desc(appearanceCountSelect);
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
        seriesCount: seriesCountSelect,
        galleryCount: galleryCountSelect,
        imageCount: imageCountSelect,
        imageAppearanceCount: imageAppearanceCountSelect,
        audioLibraryCount: audioLibraryCountSelect,
        audioTrackCount: audioTrackCountSelect,
        appearanceCount: appearanceCountSelect,
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
      seriesCount: Number(r.seriesCount ?? 0),
      galleryCount: Number(r.galleryCount ?? 0),
      imageCount: Number(r.imageCount ?? 0),
      imageAppearanceCount: Number(r.imageAppearanceCount ?? 0),
      audioLibraryCount: Number(r.audioLibraryCount ?? 0),
      audioTrackCount: Number(r.audioTrackCount ?? 0),
      appearanceCount: Number(r.appearanceCount ?? 0),
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
      thumbnailPath: string | null;
      cardThumbnailPath: string | null;
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
      thumbnailPath: string | null;
      cardThumbnailPath: string | null;
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
      thumbnailPath: string | null;
      cardThumbnailPath: string | null;
      seriesId: string;
      seriesTitle: string;
      seasonNumber: number | null;
      episodeNumber: number | null;
    };

export interface PerformerKnownForSeriesRow {
  sourceId: string;
  title: string;
  customName: string | null;
  thumbnailPath: string | null;
  character: string | null;
  isNsfw: boolean | null;
}

export interface PerformerKnownForMovieRow {
  sourceId: string;
  title: string;
  thumbnailPath: string | null;
  cardThumbnailPath: string | null;
  character: string | null;
  isNsfw: boolean | null;
}

export interface PerformerKnownForEpisodeRow {
  sourceId: string;
  title: string | null;
  thumbnailPath: string | null;
  cardThumbnailPath: string | null;
  character: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  isNsfw: boolean | null;
  seriesId: string;
  seriesTitle: string;
  seriesCustomName: string | null;
  seriesThumbnailPath: string | null;
  seriesIsNsfw: boolean | null;
  seriesCharacter: string | null;
}

function seriesRoleKey(seriesId: string, character: string): string {
  return `${seriesId}\u0000${character}`;
}

export function buildPerformerKnownForEntries({
  seriesRows,
  movieRows,
  episodeRows,
  sfwOnly,
}: {
  seriesRows: PerformerKnownForSeriesRow[];
  movieRows: PerformerKnownForMovieRow[];
  episodeRows: PerformerKnownForEpisodeRow[];
  sfwOnly: boolean;
}): PerformerKnownForEntry[] {
  const seriesEntries = seriesRows
    .filter((row) => !sfwOnly || !row.isNsfw)
    .map((row) => ({
      sourceType: "series" as const,
      sourceId: row.sourceId,
      sourceTitle: row.customName ?? row.title,
      character: normalizeRole(row.character),
      thumbnailPath: row.thumbnailPath,
      cardThumbnailPath: null,
      seriesId: row.sourceId,
      seriesTitle: row.customName ?? row.title,
      seasonNumber: null,
      episodeNumber: null,
    }))
    .filter((row) => row.character);

  const seriesRoleKeys = new Set(
    seriesEntries.map((row) => seriesRoleKey(row.seriesId, row.character!)),
  );

  const movieEntries = movieRows
    .filter((row) => !sfwOnly || !row.isNsfw)
    .map((row) => ({
      sourceType: "movie" as const,
      sourceId: row.sourceId,
      sourceTitle: row.title,
      character: normalizeRole(row.character),
      thumbnailPath: row.thumbnailPath,
      cardThumbnailPath: row.cardThumbnailPath,
      seriesId: null,
      seriesTitle: null,
      seasonNumber: null,
      episodeNumber: null,
    }))
    .filter((row) => row.character);

  const episodeCandidates = episodeRows
    .filter((row) => !sfwOnly || (!row.isNsfw && !row.seriesIsNsfw))
    .map((row) => {
      const character = normalizeRole(row.character);
      const seriesCharacter = normalizeRole(row.seriesCharacter);
      return {
        sourceType: "episode" as const,
        sourceId: row.sourceId,
        sourceTitle: row.title,
        character,
        thumbnailPath: row.thumbnailPath,
        cardThumbnailPath: row.cardThumbnailPath,
        seriesId: row.seriesId,
        seriesTitle: row.seriesCustomName ?? row.seriesTitle,
        seriesThumbnailPath: row.seriesThumbnailPath,
        seasonNumber: row.seasonNumber,
        episodeNumber: row.episodeNumber,
        coveredByExplicitSeriesRole:
          character !== null &&
          seriesCharacter !== null &&
          character === seriesCharacter,
      };
    })
    .filter((row) => row.character);

  const groupedEpisodes = new Map<string, typeof episodeCandidates>();
  for (const row of episodeCandidates) {
    if (
      row.coveredByExplicitSeriesRole ||
      seriesRoleKeys.has(seriesRoleKey(row.seriesId, row.character!))
    ) {
      continue;
    }
    const key = seriesRoleKey(row.seriesId, row.character!);
    const group = groupedEpisodes.get(key);
    if (group) {
      group.push(row);
    } else {
      groupedEpisodes.set(key, [row]);
    }
  }

  const episodeEntries: PerformerKnownForEntry[] = [];
  for (const group of groupedEpisodes.values()) {
    const first = group[0]!;
    if (group.length > 1) {
      episodeEntries.push({
        sourceType: "series",
        sourceId: first.seriesId,
        sourceTitle: first.seriesTitle,
        character: first.character,
        thumbnailPath: first.seriesThumbnailPath ?? first.thumbnailPath,
        cardThumbnailPath: null,
        seriesId: first.seriesId,
        seriesTitle: first.seriesTitle,
        seasonNumber: null,
        episodeNumber: null,
      });
      continue;
    }

    const {
      coveredByExplicitSeriesRole: _covered,
      seriesThumbnailPath: _seriesThumbnail,
      ...episodeEntry
    } = first;
    episodeEntries.push(episodeEntry);
  }

  const knownFor: PerformerKnownForEntry[] = [
    ...seriesEntries,
    ...movieEntries,
    ...episodeEntries,
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
        thumbnailPath: schema.videoSeries.posterPath,
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
        thumbnailPath: schema.videoMovies.thumbnailPath,
        cardThumbnailPath: schema.videoMovies.cardThumbnailPath,
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
        thumbnailPath: schema.videoEpisodes.thumbnailPath,
        cardThumbnailPath: schema.videoEpisodes.cardThumbnailPath,
        character: schema.videoEpisodePerformers.character,
        seasonNumber: schema.videoEpisodes.seasonNumber,
        episodeNumber: schema.videoEpisodes.episodeNumber,
        isNsfw: schema.videoEpisodes.isNsfw,
        seriesId: schema.videoSeries.id,
        seriesTitle: schema.videoSeries.title,
        seriesCustomName: schema.videoSeries.customName,
        seriesThumbnailPath: schema.videoSeries.posterPath,
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

  return buildPerformerKnownForEntries({
    seriesRows,
    movieRows,
    episodeRows,
    sfwOnly,
  });
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
  seriesCount: number;
  galleryCount: number;
  imageCount: number;
  imageAppearanceCount: number;
  audioLibraryCount: number;
  audioTrackCount: number;
  appearanceCount: number;
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
      seriesCount: performerSeriesCountExpr(sfwOnly),
      galleryCount: performerGalleryCountExpr(sfwOnly),
      imageCount: performerImageCountExpr(sfwOnly),
      imageAppearanceCount: performerImageAppearanceCountExpr(sfwOnly),
      audioLibraryCount: performerAudioLibraryCountExpr(sfwOnly),
      audioTrackCount: performerAudioTrackCountExpr(sfwOnly),
    })
    .from(performers)
    .where(eq(performers.id, id));
  const videoCount = Number(cnt?.n ?? 0);
  const seriesCount = Number(cnt?.seriesCount ?? 0);
  const galleryCount = Number(cnt?.galleryCount ?? 0);
  const imageCount = Number(cnt?.imageCount ?? 0);
  const imageAppearanceCount = Number(cnt?.imageAppearanceCount ?? 0);
  const audioLibraryCount = Number(cnt?.audioLibraryCount ?? 0);
  const audioTrackCount = Number(cnt?.audioTrackCount ?? 0);
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
    seriesCount,
    galleryCount,
    imageCount,
    imageAppearanceCount,
    audioLibraryCount,
    audioTrackCount,
    appearanceCount:
      videoCount + seriesCount + galleryCount + imageCount + audioLibraryCount + audioTrackCount,
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
