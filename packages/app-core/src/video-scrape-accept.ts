import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
import type {
  NormalizedEpisodeResult,
  NormalizedMovieResult,
  NormalizedSeriesResult,
} from "@obscura/contracts";
import { getCacheRootDir, getGeneratedPerformerDir, getGeneratedSeriesDir } from "@obscura/media-core";
import { schema, type AppDb } from "@obscura/db";
import { NotFoundError, ValidationError } from "./errors";

const {
  performers,
  scrapeResults,
  studios,
  tags,
  videoEpisodePerformers,
  videoEpisodeTags,
  videoEpisodes,
  videoMoviePerformers,
  videoMovieTags,
  videoMovies,
  videoSeasons,
  videoSeries,
  videoSeriesPerformers,
  videoSeriesTags,
} = schema;

const IMAGE_FETCH_TIMEOUT_MS = 20_000;

export interface AcceptFieldMask {
  title?: boolean;
  overview?: boolean;
  tagline?: boolean;
  releaseDate?: boolean;
  airDate?: boolean;
  runtime?: boolean;
  genres?: boolean;
  studio?: boolean;
  cast?: boolean;
  rating?: boolean;
  contentRating?: boolean;
  externalIds?: boolean;
}

export interface SelectedImages {
  poster?: string;
  backdrop?: string;
  logo?: string;
  still?: string;
}

export interface CascadeAcceptSpec {
  acceptAllSeasons?: boolean;
  seasonOverrides?: Record<
    number,
    {
      accepted: boolean;
      fieldMask?: AcceptFieldMask;
      selectedImages?: SelectedImages;
      episodes?: Record<
        number,
        {
          accepted: boolean;
          fieldMask?: AcceptFieldMask;
          selectedImages?: SelectedImages;
        }
      >;
    }
  >;
}

export interface AcceptMovieScrapeInput {
  movieId: string;
  scrapeResultId: string;
  fieldMask?: AcceptFieldMask;
  selectedImages?: SelectedImages;
}

export interface AcceptEpisodeScrapeInput {
  episodeId: string;
  scrapeResultId: string;
  fieldMask?: AcceptFieldMask;
  selectedImages?: SelectedImages;
}

export interface AcceptSeriesScrapeInput {
  seriesId: string;
  scrapeResultId: string;
  fieldMask?: AcceptFieldMask;
  selectedImages?: SelectedImages;
  cascade?: CascadeAcceptSpec;
}

const FULL_MASK: Required<AcceptFieldMask> = {
  title: true,
  overview: true,
  tagline: true,
  releaseDate: true,
  airDate: true,
  runtime: true,
  genres: true,
  studio: true,
  cast: true,
  rating: true,
  contentRating: true,
  externalIds: true,
};

function applyMask(mask: AcceptFieldMask | undefined): Required<AcceptFieldMask> {
  return { ...FULL_MASK, ...mask };
}

async function downloadImageToCache(
  url: string | undefined | null,
  entityDir: string,
  filename: string,
): Promise<string | null> {
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(entityDir, { recursive: true });
    const ext = url.match(/\.(jpe?g|png|webp|avif)/i)?.[1] ?? "jpg";
    const outName = `${filename}.${ext}`;
    await writeFile(path.join(entityDir, outName), buf);
    return outName;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadSeriesImages(
  seriesId: string,
  result: NormalizedSeriesResult,
  selectedImages?: SelectedImages,
): Promise<Record<string, unknown>> {
  const dir = getGeneratedSeriesDir(seriesId);
  const patch: Record<string, unknown> = {};
  const posterUrl = selectedImages?.poster ?? result.posterCandidates[0]?.url ?? null;
  const backdropUrl =
    selectedImages?.backdrop ?? result.backdropCandidates[0]?.url ?? null;
  const logoUrl = selectedImages?.logo ?? result.logoCandidates[0]?.url ?? null;

  const [posterFile, backdropFile, logoFile] = await Promise.all([
    downloadImageToCache(posterUrl, dir, "poster"),
    downloadImageToCache(backdropUrl, dir, "backdrop"),
    downloadImageToCache(logoUrl, dir, "logo"),
  ]);

  if (posterFile) patch.posterPath = `/assets/video-series/${seriesId}/cover`;
  if (backdropFile) patch.backdropPath = `/assets/video-series/${seriesId}/backdrop`;
  if (logoFile) patch.logoPath = `/assets/video-series/${seriesId}/logo`;
  return patch;
}

async function downloadSeasonPoster(
  seasonId: string,
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null;
  const dir = path.join(getCacheRootDir(), "seasons", seasonId);
  const file = await downloadImageToCache(url, dir, "poster");
  return file ? `/assets/seasons/${seasonId}/poster` : null;
}

async function upsertPerformerByName(
  db: AppDb,
  name: string,
  profileUrl?: string | null,
): Promise<string> {
  const trimmed = name.trim();
  const [existing] = await db
    .select({ id: performers.id, imagePath: performers.imagePath })
    .from(performers)
    .where(sql`lower(${performers.name}) = lower(${trimmed})`)
    .limit(1);

  const id = existing
    ? existing.id
    : (
        await db
          .insert(performers)
          .values({ name: trimmed })
          .returning({ id: performers.id })
      )[0].id;

  if (profileUrl && (!existing || !existing.imagePath)) {
    const dir = getGeneratedPerformerDir(id);
    const file = await downloadImageToCache(profileUrl, dir, "profile");
    if (file) {
      await db
        .update(performers)
        .set({
          imagePath: `/assets/performers/${id}/image`,
          imageUrl: profileUrl,
          updatedAt: new Date(),
        })
        .where(eq(performers.id, id));
    }
  }

  return id;
}

async function upsertTagByName(db: AppDb, name: string): Promise<string> {
  const [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.name, name))
    .limit(1);
  if (existing) return existing.id;
  const [inserted] = await db
    .insert(tags)
    .values({ name })
    .returning({ id: tags.id });
  return inserted.id;
}

async function upsertStudioByName(db: AppDb, name: string): Promise<string> {
  const [existing] = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.name, name))
    .limit(1);
  if (existing) return existing.id;
  const [inserted] = await db
    .insert(studios)
    .values({ name })
    .returning({ id: studios.id });
  return inserted.id;
}

async function loadAcceptedMovieResult(
  db: AppDb,
  scrapeResultId: string,
): Promise<NormalizedMovieResult> {
  const [row] = await db
    .select({ proposedResult: scrapeResults.proposedResult })
    .from(scrapeResults)
    .where(eq(scrapeResults.id, scrapeResultId))
    .limit(1);
  if (!row) throw new NotFoundError("scrape result not found");
  if (!row.proposedResult || typeof row.proposedResult !== "object") {
    throw new ValidationError("scrape result has no proposed_result payload");
  }
  return row.proposedResult as unknown as NormalizedMovieResult;
}

async function loadAcceptedEpisodeResult(
  db: AppDb,
  scrapeResultId: string,
): Promise<NormalizedEpisodeResult> {
  const [row] = await db
    .select({ proposedResult: scrapeResults.proposedResult })
    .from(scrapeResults)
    .where(eq(scrapeResults.id, scrapeResultId))
    .limit(1);
  if (!row) throw new NotFoundError("scrape result not found");
  if (!row.proposedResult || typeof row.proposedResult !== "object") {
    throw new ValidationError("scrape result has no proposed_result payload");
  }
  return row.proposedResult as unknown as NormalizedEpisodeResult;
}

async function loadAcceptedSeriesResult(
  db: AppDb,
  scrapeResultId: string,
): Promise<NormalizedSeriesResult> {
  const [row] = await db
    .select({ proposedResult: scrapeResults.proposedResult })
    .from(scrapeResults)
    .where(eq(scrapeResults.id, scrapeResultId))
    .limit(1);
  if (!row) throw new NotFoundError("scrape result not found");
  if (!row.proposedResult || typeof row.proposedResult !== "object") {
    throw new ValidationError("scrape result has no proposed_result payload");
  }
  return row.proposedResult as unknown as NormalizedSeriesResult;
}

async function markScrapeAccepted(db: AppDb, scrapeResultId: string) {
  await db
    .update(scrapeResults)
    .set({ status: "accepted", appliedAt: new Date(), updatedAt: new Date() })
    .where(eq(scrapeResults.id, scrapeResultId));
}

export async function acceptMovieScrapeWrite(
  db: AppDb,
  input: AcceptMovieScrapeInput,
) {
  if (!input.scrapeResultId) {
    throw new ValidationError("scrapeResultId required");
  }
  const [movie] = await db
    .select({ id: videoMovies.id })
    .from(videoMovies)
    .where(eq(videoMovies.id, input.movieId))
    .limit(1);
  if (!movie) throw new NotFoundError("Video not found");

  const result = await loadAcceptedMovieResult(db, input.scrapeResultId);
  const mask = applyMask(input.fieldMask);
  const patch: Record<string, unknown> = {};

  if (mask.title) patch.title = result.title;
  if (mask.overview) patch.overview = result.overview;
  if (mask.tagline) patch.tagline = result.tagline;
  if (mask.releaseDate) patch.releaseDate = result.releaseDate;
  if (mask.runtime) patch.runtime = result.runtime;
  if (mask.rating && result.rating != null) patch.rating = Math.round(result.rating);
  if (mask.contentRating) patch.contentRating = result.contentRating;
  if (mask.externalIds) patch.externalIds = result.externalIds;
  if (mask.studio && result.studioName) {
    patch.studioId = await upsertStudioByName(db, result.studioName);
  }
  patch.organized = true;
  patch.updatedAt = new Date();

  if (Object.keys(patch).length > 0) {
    await db.update(videoMovies).set(patch).where(eq(videoMovies.id, input.movieId));
  }

  if (mask.genres && result.genres.length > 0) {
    for (const genre of result.genres) {
      const tagId = await upsertTagByName(db, genre);
      await db
        .insert(videoMovieTags)
        .values({ movieId: input.movieId, tagId })
        .onConflictDoNothing();
    }
  }

  if (mask.cast && result.cast && result.cast.length > 0) {
    for (const member of result.cast) {
      const performerId = await upsertPerformerByName(db, member.name, member.profileUrl);
      await db
        .insert(videoMoviePerformers)
        .values({
          movieId: input.movieId,
          performerId,
          character: member.character ?? null,
          order: member.order ?? null,
        })
        .onConflictDoNothing();
    }
  }

  await markScrapeAccepted(db, input.scrapeResultId);
  return { ok: true as const };
}

export async function acceptEpisodeScrapeWrite(
  db: AppDb,
  input: AcceptEpisodeScrapeInput,
) {
  if (!input.scrapeResultId) {
    throw new ValidationError("scrapeResultId required");
  }
  const [episode] = await db
    .select({ id: videoEpisodes.id })
    .from(videoEpisodes)
    .where(eq(videoEpisodes.id, input.episodeId))
    .limit(1);
  if (!episode) throw new NotFoundError("Video not found");

  const result = await loadAcceptedEpisodeResult(db, input.scrapeResultId);
  const mask = applyMask(input.fieldMask);
  const patch: Record<string, unknown> = {};

  if (mask.title) patch.title = result.title;
  if (mask.overview) patch.overview = result.overview;
  if (mask.airDate) patch.airDate = result.airDate;
  if (mask.runtime) patch.runtime = result.runtime;
  if (mask.externalIds) patch.externalIds = result.externalIds;
  if (result.seasonNumber != null) patch.seasonNumber = result.seasonNumber;
  if (result.episodeNumber != null) patch.episodeNumber = result.episodeNumber;
  if (result.absoluteEpisodeNumber != null) {
    patch.absoluteEpisodeNumber = result.absoluteEpisodeNumber;
  }
  patch.organized = true;
  patch.updatedAt = new Date();

  if (Object.keys(patch).length > 0) {
    await db
      .update(videoEpisodes)
      .set(patch)
      .where(eq(videoEpisodes.id, input.episodeId));
  }

  if (mask.cast && result.guestStars && result.guestStars.length > 0) {
    for (const star of result.guestStars) {
      const performerId = await upsertPerformerByName(db, star.name, star.profileUrl);
      await db
        .insert(videoEpisodePerformers)
        .values({
          episodeId: input.episodeId,
          performerId,
          character: star.character ?? null,
          order: star.order ?? null,
        })
        .onConflictDoNothing();
    }
  }

  await markScrapeAccepted(db, input.scrapeResultId);
  return { ok: true as const };
}

export async function acceptSeriesScrapeWrite(
  db: AppDb,
  input: AcceptSeriesScrapeInput,
) {
  if (!input.scrapeResultId) {
    throw new ValidationError("scrapeResultId required");
  }
  const [series] = await db
    .select({ id: videoSeries.id })
    .from(videoSeries)
    .where(eq(videoSeries.id, input.seriesId))
    .limit(1);
  if (!series) throw new NotFoundError("Video not found");

  const result = await loadAcceptedSeriesResult(db, input.scrapeResultId);
  const mask = applyMask(input.fieldMask);
  const patch: Record<string, unknown> = {};

  if (mask.title) patch.title = result.title;
  if (mask.overview) patch.overview = result.overview;
  if (mask.tagline) patch.tagline = result.tagline;
  if (mask.releaseDate) patch.firstAirDate = result.firstAirDate;
  if (mask.externalIds) patch.externalIds = result.externalIds;
  if (mask.studio && result.studioName) {
    patch.studioId = await upsertStudioByName(db, result.studioName);
  }
  patch.organized = true;
  patch.updatedAt = new Date();
  Object.assign(patch, await downloadSeriesImages(input.seriesId, result, input.selectedImages));

  if (Object.keys(patch).length > 0) {
    await db.update(videoSeries).set(patch).where(eq(videoSeries.id, input.seriesId));
  }

  if (mask.genres && result.genres.length > 0) {
    for (const genre of result.genres) {
      const tagId = await upsertTagByName(db, genre);
      await db
        .insert(videoSeriesTags)
        .values({ seriesId: input.seriesId, tagId })
        .onConflictDoNothing();
    }
  }

  if (mask.cast && result.cast && result.cast.length > 0) {
    for (const member of result.cast) {
      const performerId = await upsertPerformerByName(db, member.name, member.profileUrl);
      await db
        .insert(videoSeriesPerformers)
        .values({
          seriesId: input.seriesId,
          performerId,
          character: member.character ?? null,
          order: member.order ?? null,
        })
        .onConflictDoNothing();
    }
  }

  let seasonsUpdated = 0;
  let episodesUpdated = 0;

  if (input.cascade && result.seasons.length > 0) {
    const existingSeasons = await db
      .select({ id: videoSeasons.id, seasonNumber: videoSeasons.seasonNumber })
      .from(videoSeasons)
      .where(eq(videoSeasons.seriesId, input.seriesId));

    for (const proposedSeason of result.seasons) {
      const override = input.cascade.seasonOverrides?.[proposedSeason.seasonNumber];
      const acceptThisSeason =
        input.cascade.acceptAllSeasons ||
        (override?.accepted ?? input.cascade.acceptAllSeasons ?? true);
      if (!acceptThisSeason) continue;

      const existingSeason = existingSeasons.find(
        (row) => row.seasonNumber === proposedSeason.seasonNumber,
      );
      if (!existingSeason) continue;

      const seasonPatch: Record<string, unknown> = {};
      const seasonMask = applyMask(override?.fieldMask);
      if (seasonMask.title) seasonPatch.title = proposedSeason.title;
      if (seasonMask.overview) seasonPatch.overview = proposedSeason.overview;
      if (seasonMask.airDate) seasonPatch.airDate = proposedSeason.airDate;
      if (seasonMask.externalIds) seasonPatch.externalIds = proposedSeason.externalIds;

      const seasonPosterUrl =
        override?.selectedImages?.poster ?? proposedSeason.posterCandidates[0]?.url ?? null;
      const localSeasonPoster = await downloadSeasonPoster(existingSeason.id, seasonPosterUrl);
      if (localSeasonPoster) seasonPatch.posterPath = localSeasonPoster;
      seasonPatch.updatedAt = new Date();

      await db
        .update(videoSeasons)
        .set(seasonPatch)
        .where(eq(videoSeasons.id, existingSeason.id));
      seasonsUpdated += 1;

      if (proposedSeason.episodes.length === 0) continue;
      const existingEpisodes = await db
        .select({ id: videoEpisodes.id, episodeNumber: videoEpisodes.episodeNumber })
        .from(videoEpisodes)
        .where(eq(videoEpisodes.seasonId, existingSeason.id));

      for (const proposedEpisode of proposedSeason.episodes) {
        const episodeOverride = override?.episodes?.[proposedEpisode.episodeNumber];
        const acceptThisEpisode = episodeOverride?.accepted ?? true;
        if (!acceptThisEpisode) continue;

        const existingEpisode = existingEpisodes.find(
          (row) => row.episodeNumber === proposedEpisode.episodeNumber,
        );
        if (!existingEpisode) continue;

        const episodePatch: Record<string, unknown> = {};
        const episodeMask = applyMask(episodeOverride?.fieldMask);
        if (episodeMask.title) episodePatch.title = proposedEpisode.title;
        if (episodeMask.overview) episodePatch.overview = proposedEpisode.overview;
        if (episodeMask.airDate) episodePatch.airDate = proposedEpisode.airDate;
        if (episodeMask.runtime) episodePatch.runtime = proposedEpisode.runtime;
        if (episodeMask.externalIds) {
          episodePatch.externalIds = proposedEpisode.externalIds;
        }
        episodePatch.organized = true;
        episodePatch.updatedAt = new Date();

        await db
          .update(videoEpisodes)
          .set(episodePatch)
          .where(eq(videoEpisodes.id, existingEpisode.id));

        if (
          episodeMask.cast &&
          proposedEpisode.guestStars &&
          proposedEpisode.guestStars.length > 0
        ) {
          for (const star of proposedEpisode.guestStars) {
            const performerId = await upsertPerformerByName(
              db,
              star.name,
              star.profileUrl,
            );
            await db
              .insert(videoEpisodePerformers)
              .values({
                episodeId: existingEpisode.id,
                performerId,
                character: star.character ?? null,
                order: star.order ?? null,
              })
              .onConflictDoNothing();
          }
        }
        episodesUpdated += 1;
      }
    }
  }

  await markScrapeAccepted(db, input.scrapeResultId);
  return { ok: true as const, seasonsUpdated, episodesUpdated };
}
