import { and, eq } from "drizzle-orm";
import type { AppDb } from "../types";
import * as schema from "../schema";

const {
  videoEpisodes,
  videoMovies,
  videoSeries,
  tags,
  performers,
  studios,
  videoEpisodeTags,
  videoEpisodePerformers,
  videoMovieTags,
  videoMoviePerformers,
} = schema;

/**
 * Computes whether a video episode should be marked NSFW based on its library
 * root flag plus any related entities (tags, performers, inherited studio).
 */
export async function propagateEpisodeNsfw(
  db: AppDb,
  episodeId: string,
  libraryRootIsNsfw: boolean,
) {
  if (libraryRootIsNsfw) {
    await db
      .update(videoEpisodes)
      .set({ isNsfw: true, updatedAt: new Date() })
      .where(eq(videoEpisodes.id, episodeId));
    return;
  }

  const nsfwTag = await db
    .select({ id: tags.id })
    .from(videoEpisodeTags)
    .innerJoin(tags, eq(videoEpisodeTags.tagId, tags.id))
    .where(and(eq(videoEpisodeTags.episodeId, episodeId), eq(tags.isNsfw, true)))
    .limit(1);

  if (nsfwTag.length > 0) {
    await db
      .update(videoEpisodes)
      .set({ isNsfw: true, updatedAt: new Date() })
      .where(eq(videoEpisodes.id, episodeId));
    return;
  }

  const nsfwPerformer = await db
    .select({ id: performers.id })
    .from(videoEpisodePerformers)
    .innerJoin(
      performers,
      eq(videoEpisodePerformers.performerId, performers.id),
    )
    .where(
      and(
        eq(videoEpisodePerformers.episodeId, episodeId),
        eq(performers.isNsfw, true),
      ),
    )
    .limit(1);

  if (nsfwPerformer.length > 0) {
    await db
      .update(videoEpisodes)
      .set({ isNsfw: true, updatedAt: new Date() })
      .where(eq(videoEpisodes.id, episodeId));
    return;
  }

  // Episodes inherit studio via their parent video_series row.
  const [parentRow] = await db
    .select({ studioId: videoSeries.studioId })
    .from(videoEpisodes)
    .innerJoin(videoSeries, eq(videoEpisodes.seriesId, videoSeries.id))
    .where(eq(videoEpisodes.id, episodeId))
    .limit(1);

  if (parentRow?.studioId) {
    const [studio] = await db
      .select({ isNsfw: studios.isNsfw })
      .from(studios)
      .where(eq(studios.id, parentRow.studioId))
      .limit(1);

    if (studio?.isNsfw) {
      await db
        .update(videoEpisodes)
        .set({ isNsfw: true, updatedAt: new Date() })
        .where(eq(videoEpisodes.id, episodeId));
      return;
    }
  }

  await db
    .update(videoEpisodes)
    .set({ isNsfw: false, updatedAt: new Date() })
    .where(eq(videoEpisodes.id, episodeId));
}

/**
 * Computes whether a video movie should be marked NSFW based on its library
 * root flag plus any related entities (tags, performers, studio).
 */
export async function propagateMovieNsfw(
  db: AppDb,
  movieId: string,
  libraryRootIsNsfw: boolean,
) {
  if (libraryRootIsNsfw) {
    await db
      .update(videoMovies)
      .set({ isNsfw: true, updatedAt: new Date() })
      .where(eq(videoMovies.id, movieId));
    return;
  }

  const nsfwTag = await db
    .select({ id: tags.id })
    .from(videoMovieTags)
    .innerJoin(tags, eq(videoMovieTags.tagId, tags.id))
    .where(and(eq(videoMovieTags.movieId, movieId), eq(tags.isNsfw, true)))
    .limit(1);

  if (nsfwTag.length > 0) {
    await db
      .update(videoMovies)
      .set({ isNsfw: true, updatedAt: new Date() })
      .where(eq(videoMovies.id, movieId));
    return;
  }

  const nsfwPerformer = await db
    .select({ id: performers.id })
    .from(videoMoviePerformers)
    .innerJoin(
      performers,
      eq(videoMoviePerformers.performerId, performers.id),
    )
    .where(
      and(
        eq(videoMoviePerformers.movieId, movieId),
        eq(performers.isNsfw, true),
      ),
    )
    .limit(1);

  if (nsfwPerformer.length > 0) {
    await db
      .update(videoMovies)
      .set({ isNsfw: true, updatedAt: new Date() })
      .where(eq(videoMovies.id, movieId));
    return;
  }

  const [row] = await db
    .select({ studioId: videoMovies.studioId })
    .from(videoMovies)
    .where(eq(videoMovies.id, movieId))
    .limit(1);

  if (row?.studioId) {
    const [studio] = await db
      .select({ isNsfw: studios.isNsfw })
      .from(studios)
      .where(eq(studios.id, row.studioId))
      .limit(1);

    if (studio?.isNsfw) {
      await db
        .update(videoMovies)
        .set({ isNsfw: true, updatedAt: new Date() })
        .where(eq(videoMovies.id, movieId));
      return;
    }
  }

  await db
    .update(videoMovies)
    .set({ isNsfw: false, updatedAt: new Date() })
    .where(eq(videoMovies.id, movieId));
}
