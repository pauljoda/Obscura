import { eq } from "drizzle-orm";
import {
  scrapeResults,
  videoMovies,
  videoEpisodes,
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
} from "@obscura/contracts";
import { db } from "../db";

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

async function upsertPerformerByName(name: string): Promise<string> {
  const [existing] = await db
    .select({ id: performers.id })
    .from(performers)
    .where(eq(performers.name, name))
    .limit(1);
  if (existing) return existing.id;
  const [inserted] = await db
    .insert(performers)
    .values({ name })
    .returning({ id: performers.id });
  return inserted.id;
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
      const performerId = await upsertPerformerByName(member.name);
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
      const performerId = await upsertPerformerByName(star.name);
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
