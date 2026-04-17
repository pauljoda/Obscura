import { eq, sql } from "drizzle-orm";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import {
  scrapeResults,
  videoMovies,
  videoEpisodes,
  videoSeries,
  videoSeasons,
  videoSeriesPerformers,
  videoSeriesTags,
  performers,
  tags,
  studios,
  videoMoviePerformers,
  videoMovieTags,
  videoEpisodePerformers,
  videoEpisodeTags,
} from "@obscura/db/src/schema";
import type {
  NormalizedMovieResult,
  NormalizedEpisodeResult,
  NormalizedSeriesResult,
} from "@obscura/contracts";
import { getGeneratedSeriesDir, getGeneratedPerformerDir, getCacheRootDir } from "@obscura/media-core";
import { db } from "../db";

// ─── Image download helper ──────────────────────────────────────────
//
// Downloads a remote image URL (TMDB, etc.) to a local cache path and
// returns the asset URL to write into the DB. Failures are non-fatal —
// a null return means "skip this slot, don't block the accept."

// Upper bound on a single image fetch. Prevents one slow/hung TMDB
// response from holding the accept open past nginx's proxy_read_timeout.
const IMAGE_FETCH_TIMEOUT_MS = 20_000;

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

/**
 * Download the selected (or default-first) image for each slot
 * on a series accept and write the local asset URLs into the
 * series row. Returns the patch fields to merge.
 */
async function downloadSeriesImages(
  seriesId: string,
  result: NormalizedSeriesResult,
  selectedImages?: SelectedImages,
): Promise<Record<string, unknown>> {
  const dir = getGeneratedSeriesDir(seriesId);
  const patch: Record<string, unknown> = {};
  const posterUrl =
    selectedImages?.poster ??
    result.posterCandidates[0]?.url ??
    null;
  const backdropUrl =
    selectedImages?.backdrop ??
    result.backdropCandidates[0]?.url ??
    null;
  const logoUrl =
    selectedImages?.logo ??
    result.logoCandidates[0]?.url ??
    null;
  // Run the three slot downloads concurrently so a slow TMDB response
  // for (say) the logo doesn't serialize the other two.
  const [posterFile, backdropFile] = await Promise.all([
    downloadImageToCache(posterUrl, dir, "poster"),
    downloadImageToCache(backdropUrl, dir, "backdrop"),
    downloadImageToCache(logoUrl, dir, "logo"),
  ]);
  if (posterFile) {
    patch.posterPath = `/assets/video-folders/${seriesId}/cover`;
  }
  if (backdropFile) {
    patch.backdropPath = `/assets/video-folders/${seriesId}/backdrop`;
  }
  return patch;
}

/**
 * Download a season poster to a cache subdir keyed on the season
 * DB id so `toApiUrl(posterPath)` resolves correctly.
 */
async function downloadSeasonPoster(
  seasonId: string,
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null;
  const dir = path.join(getCacheRootDir(), "seasons", seasonId);
  const file = await downloadImageToCache(url, dir, "poster");
  return file ? `/assets/seasons/${seasonId}/poster` : null;
}

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

async function upsertPerformerByName(
  name: string,
  profileUrl?: string | null,
): Promise<string> {
  // Match case-insensitively so "Tom Hanks" and "tom hanks" collapse
  // to the same row. Plugin results (TMDB especially) often disagree
  // with user-entered casing and aliases, and duplicating performers
  // per casing variant is worse than the very rare collision between
  // two real performers who happen to spell their names identically.
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

  // Download headshot if the performer row doesn't already have a
  // local image (we don't overwrite user-uploaded photos).
  if (profileUrl && (!existing || !existing.imagePath)) {
    const dir = getGeneratedPerformerDir(id);
    const file = await downloadImageToCache(profileUrl, dir, "profile");
    if (file) {
      const assetUrl = `/assets/performers/${id}/image`;
      await db
        .update(performers)
        .set({ imagePath: assetUrl, imageUrl: profileUrl, updatedAt: new Date() })
        .where(eq(performers.id, id));
    }
  }

  return id;
}

async function upsertTagByName(name: string): Promise<string> {
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

async function upsertStudioByName(name: string): Promise<string> {
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

export interface AcceptMovieInput {
  scrapeResultId: string;
  movieId: string;
  result: NormalizedMovieResult;
  fieldMask?: AcceptFieldMask;
}

export async function acceptMovieScrape(
  input: AcceptMovieInput,
): Promise<void> {
  const mask = applyMask(input.fieldMask);
  const patch: Record<string, unknown> = {};
  if (mask.title) patch.title = input.result.title;
  if (mask.overview) patch.overview = input.result.overview;
  if (mask.tagline) patch.tagline = input.result.tagline;
  if (mask.releaseDate) patch.releaseDate = input.result.releaseDate;
  if (mask.runtime) patch.runtime = input.result.runtime;
  if (mask.rating && input.result.rating !== null && input.result.rating !== undefined) {
    patch.rating = Math.round(input.result.rating);
  }
  if (mask.contentRating) patch.contentRating = input.result.contentRating;
  if (mask.externalIds) patch.externalIds = input.result.externalIds;

  if (mask.studio && input.result.studioName) {
    const studioId = await upsertStudioByName(input.result.studioName);
    patch.studioId = studioId;
  }

  patch.organized = true;
  patch.updatedAt = new Date();

  if (Object.keys(patch).length > 0) {
    await db.update(videoMovies).set(patch).where(eq(videoMovies.id, input.movieId));
  }

  if (mask.genres && input.result.genres.length > 0) {
    for (const genre of input.result.genres) {
      const tagId = await upsertTagByName(genre);
      await db
        .insert(videoMovieTags)
        .values({ movieId: input.movieId, tagId })
        .onConflictDoNothing();
    }
  }

  if (mask.cast && input.result.cast && input.result.cast.length > 0) {
    for (const member of input.result.cast) {
      const performerId = await upsertPerformerByName(member.name, member.profileUrl);
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

  await db
    .update(scrapeResults)
    .set({ status: "accepted", appliedAt: new Date(), updatedAt: new Date() })
    .where(eq(scrapeResults.id, input.scrapeResultId));
}

export interface AcceptEpisodeInput {
  scrapeResultId: string;
  episodeId: string;
  result: NormalizedEpisodeResult;
  fieldMask?: AcceptFieldMask;
}

export async function acceptEpisodeScrape(
  input: AcceptEpisodeInput,
): Promise<void> {
  const mask = applyMask(input.fieldMask);
  const patch: Record<string, unknown> = {};
  if (mask.title) patch.title = input.result.title;
  if (mask.overview) patch.overview = input.result.overview;
  if (mask.airDate) patch.airDate = input.result.airDate;
  if (mask.runtime) patch.runtime = input.result.runtime;
  if (mask.externalIds) patch.externalIds = input.result.externalIds;
  // Episode placement fields
  if (input.result.seasonNumber !== undefined && input.result.seasonNumber !== null) {
    patch.seasonNumber = input.result.seasonNumber;
  }
  if (input.result.episodeNumber !== undefined && input.result.episodeNumber !== null) {
    patch.episodeNumber = input.result.episodeNumber;
  }
  if (
    input.result.absoluteEpisodeNumber !== undefined &&
    input.result.absoluteEpisodeNumber !== null
  ) {
    patch.absoluteEpisodeNumber = input.result.absoluteEpisodeNumber;
  }

  patch.organized = true;
  patch.updatedAt = new Date();

  if (Object.keys(patch).length > 0) {
    await db
      .update(videoEpisodes)
      .set(patch)
      .where(eq(videoEpisodes.id, input.episodeId));
  }

  if (mask.cast && input.result.guestStars && input.result.guestStars.length > 0) {
    for (const star of input.result.guestStars) {
      const performerId = await upsertPerformerByName(star.name, star.profileUrl);
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

  await db
    .update(scrapeResults)
    .set({ status: "accepted", appliedAt: new Date(), updatedAt: new Date() })
    .where(eq(scrapeResults.id, input.scrapeResultId));
}

// ---------------------------------------------------------------------------
// Series cascade accept
// ---------------------------------------------------------------------------

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

export interface AcceptSeriesInput {
  scrapeResultId: string;
  seriesId: string;
  result: NormalizedSeriesResult;
  fieldMask?: AcceptFieldMask;
  cascade?: CascadeAcceptSpec;
}

export async function acceptSeriesScrape(
  input: AcceptSeriesInput,
): Promise<{ episodesUpdated: number; seasonsUpdated: number }> {
  const mask = applyMask(input.fieldMask);
  const patch: Record<string, unknown> = {};
  if (mask.title) patch.title = input.result.title;
  if (mask.overview) patch.overview = input.result.overview;
  if (mask.tagline) patch.tagline = input.result.tagline;
  if (mask.releaseDate) patch.firstAirDate = input.result.firstAirDate;
  if (mask.externalIds) patch.externalIds = input.result.externalIds;
  if (mask.studio && input.result.studioName) {
    patch.studioId = await upsertStudioByName(input.result.studioName);
  }
  patch.organized = true;
  patch.updatedAt = new Date();

  // Download poster / backdrop / logo to local disk so the library
  // is fully offline-capable. Uses the same cache dir layout as the
  // manual cover-upload flow so the asset GET routes serve them.
  const imagePatch = await downloadSeriesImages(
    input.seriesId,
    input.result,
    // The route handler can optionally forward selectedImages from
    // the cascade drawer; fall back to the first candidate per slot.
  );
  Object.assign(patch, imagePatch);

  if (Object.keys(patch).length > 0) {
    await db
      .update(videoSeries)
      .set(patch)
      .where(eq(videoSeries.id, input.seriesId));
  }

  if (mask.genres && input.result.genres.length > 0) {
    for (const genre of input.result.genres) {
      const tagId = await upsertTagByName(genre);
      await db
        .insert(videoSeriesTags)
        .values({ seriesId: input.seriesId, tagId })
        .onConflictDoNothing();
    }
  }

  if (mask.cast && input.result.cast && input.result.cast.length > 0) {
    for (const member of input.result.cast) {
      const performerId = await upsertPerformerByName(member.name, member.profileUrl);
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

  if (input.cascade && input.result.seasons.length > 0) {
    const existingSeasons = await db
      .select({
        id: videoSeasons.id,
        seasonNumber: videoSeasons.seasonNumber,
      })
      .from(videoSeasons)
      .where(eq(videoSeasons.seriesId, input.seriesId));

    for (const proposedSeason of input.result.seasons) {
      const override =
        input.cascade.seasonOverrides?.[proposedSeason.seasonNumber];
      const acceptThisSeason =
        input.cascade.acceptAllSeasons ||
        (override?.accepted ?? input.cascade.acceptAllSeasons ?? true);
      if (!acceptThisSeason) continue;

      const existingSeason = existingSeasons.find(
        (s) => s.seasonNumber === proposedSeason.seasonNumber,
      );
      if (!existingSeason) continue;

      const seasonPatch: Record<string, unknown> = {};
      const seasonMask = applyMask(override?.fieldMask);
      if (seasonMask.title) seasonPatch.title = proposedSeason.title;
      if (seasonMask.overview) seasonPatch.overview = proposedSeason.overview;
      if (seasonMask.airDate) seasonPatch.airDate = proposedSeason.airDate;
      if (seasonMask.externalIds)
        seasonPatch.externalIds = proposedSeason.externalIds;
      // Download the season poster to local disk for offline
      // availability. The user may have picked a specific candidate
      // in the drawer, or we fall back to the first.
      const seasonSelectedImages = override?.selectedImages;
      const seasonPosterUrl =
        seasonSelectedImages?.poster ??
        (proposedSeason.posterCandidates.length > 0
          ? proposedSeason.posterCandidates[0].url
          : null);
      const localSeasonPoster = await downloadSeasonPoster(
        existingSeason.id,
        seasonPosterUrl,
      );
      if (localSeasonPoster) {
        seasonPatch.posterPath = localSeasonPoster;
      }
      seasonPatch.updatedAt = new Date();

      await db
        .update(videoSeasons)
        .set(seasonPatch)
        .where(eq(videoSeasons.id, existingSeason.id));
      seasonsUpdated += 1;

      if (proposedSeason.episodes.length > 0) {
        const existingEpisodes = await db
          .select({
            id: videoEpisodes.id,
            episodeNumber: videoEpisodes.episodeNumber,
          })
          .from(videoEpisodes)
          .where(eq(videoEpisodes.seasonId, existingSeason.id));

        for (const proposedEp of proposedSeason.episodes) {
          const epOverride = override?.episodes?.[proposedEp.episodeNumber];
          const acceptThisEpisode = epOverride?.accepted ?? true;
          if (!acceptThisEpisode) continue;

          const existingEp = existingEpisodes.find(
            (e) => e.episodeNumber === proposedEp.episodeNumber,
          );
          if (!existingEp) continue;

          const epPatch: Record<string, unknown> = {};
          const epMask = applyMask(epOverride?.fieldMask);
          if (epMask.title) epPatch.title = proposedEp.title;
          if (epMask.overview) epPatch.overview = proposedEp.overview;
          if (epMask.airDate) epPatch.airDate = proposedEp.airDate;
          if (epMask.runtime) epPatch.runtime = proposedEp.runtime;
          if (epMask.externalIds)
            epPatch.externalIds = proposedEp.externalIds;
          epPatch.organized = true;
          epPatch.updatedAt = new Date();

          await db
            .update(videoEpisodes)
            .set(epPatch)
            .where(eq(videoEpisodes.id, existingEp.id));

          // Link guest stars as performers on the episode row.
          if (
            epMask.cast &&
            proposedEp.guestStars &&
            proposedEp.guestStars.length > 0
          ) {
            for (const star of proposedEp.guestStars) {
              const performerId = await upsertPerformerByName(star.name, star.profileUrl);
              await db
                .insert(videoEpisodePerformers)
                .values({
                  episodeId: existingEp.id,
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
  }

  await db
    .update(scrapeResults)
    .set({ status: "accepted", appliedAt: new Date(), updatedAt: new Date() })
    .where(eq(scrapeResults.id, input.scrapeResultId));

  return { seasonsUpdated, episodesUpdated };
}
