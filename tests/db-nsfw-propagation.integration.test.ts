import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "../packages/db/src/schema.ts";
import {
  propagateEpisodeNsfw,
  propagateMovieNsfw,
} from "../packages/db/src/lib/nsfw-video-propagation.ts";
import { createPostgresTestContext } from "./support/postgres.ts";

const {
  libraryRoots,
  videoSeries,
  videoSeasons,
  videoEpisodes,
  videoMovies,
  videoEpisodeTags,
  videoEpisodePerformers,
  videoMovieTags,
  videoMoviePerformers,
  tags,
  performers,
  studios,
} = schema;

describe("nsfw-video-propagation", () => {
  let database: Awaited<ReturnType<typeof createPostgresTestContext>>;

  beforeAll(async () => {
    database = await createPostgresTestContext();
  });

  afterAll(async () => {
    await database.close();
  });

  async function seedEpisode(opts: {
    studioId?: string;
    seriesIsNsfw?: boolean;
  } = {}) {
    const [root] = await database.db
      .insert(libraryRoots)
      .values({ path: `/tmp/fixtures-${Math.random()}`, label: "Fixtures" })
      .returning();
    const [series] = await database.db
      .insert(videoSeries)
      .values({
        libraryRootId: root.id,
        folderPath: `/tmp/series-${Math.random()}`,
        relativePath: "Series",
        title: "Series",
        isNsfw: opts.seriesIsNsfw ?? false,
        studioId: opts.studioId ?? null,
      })
      .returning();
    const [season] = await database.db
      .insert(videoSeasons)
      .values({ seriesId: series.id, seasonNumber: 1 })
      .returning();
    const [episode] = await database.db
      .insert(videoEpisodes)
      .values({
        seriesId: series.id,
        seasonId: season.id,
        seasonNumber: 1,
        episodeNumber: 1,
        title: "E1",
        filePath: `/tmp/episode-${Math.random()}.mp4`,
      })
      .returning();
    return { root, series, season, episode };
  }

  async function seedMovie(opts: { studioId?: string } = {}) {
    const [root] = await database.db
      .insert(libraryRoots)
      .values({ path: `/tmp/movies-${Math.random()}`, label: "Movies" })
      .returning();
    const [movie] = await database.db
      .insert(videoMovies)
      .values({
        libraryRootId: root.id,
        title: "Movie",
        filePath: `/tmp/movie-${Math.random()}.mp4`,
        studioId: opts.studioId ?? null,
      })
      .returning();
    return { root, movie };
  }

  describe("propagateEpisodeNsfw", () => {
    it("forces NSFW when the library root is NSFW", async () => {
      const { episode } = await seedEpisode();

      await propagateEpisodeNsfw(database.db, episode.id, true);

      const [row] = await database.db
        .select({ isNsfw: videoEpisodes.isNsfw })
        .from(videoEpisodes)
        .where(eq(videoEpisodes.id, episode.id));
      expect(row.isNsfw).toBe(true);
    });

    it("marks NSFW when an attached tag is NSFW", async () => {
      const { episode } = await seedEpisode();
      const [tag] = await database.db
        .insert(tags)
        .values({ name: `adult-${Math.random()}`, isNsfw: true })
        .returning();
      await database.db
        .insert(videoEpisodeTags)
        .values({ episodeId: episode.id, tagId: tag.id });

      await propagateEpisodeNsfw(database.db, episode.id, false);

      const [row] = await database.db
        .select({ isNsfw: videoEpisodes.isNsfw })
        .from(videoEpisodes)
        .where(eq(videoEpisodes.id, episode.id));
      expect(row.isNsfw).toBe(true);
    });

    it("marks NSFW when an attached performer is NSFW", async () => {
      const { episode } = await seedEpisode();
      const [performer] = await database.db
        .insert(performers)
        .values({ name: `Adult Performer ${Math.random()}`, isNsfw: true })
        .returning();
      await database.db
        .insert(videoEpisodePerformers)
        .values({ episodeId: episode.id, performerId: performer.id });

      await propagateEpisodeNsfw(database.db, episode.id, false);

      const [row] = await database.db
        .select({ isNsfw: videoEpisodes.isNsfw })
        .from(videoEpisodes)
        .where(eq(videoEpisodes.id, episode.id));
      expect(row.isNsfw).toBe(true);
    });

    it("inherits NSFW through the parent series' studio", async () => {
      const [studio] = await database.db
        .insert(studios)
        .values({ name: `Studio ${Math.random()}`, isNsfw: true })
        .returning();
      const { episode } = await seedEpisode({ studioId: studio.id });

      await propagateEpisodeNsfw(database.db, episode.id, false);

      const [row] = await database.db
        .select({ isNsfw: videoEpisodes.isNsfw })
        .from(videoEpisodes)
        .where(eq(videoEpisodes.id, episode.id));
      expect(row.isNsfw).toBe(true);
    });

    it("clears NSFW when no signals remain", async () => {
      const { episode } = await seedEpisode();
      // start it NSFW
      await database.db
        .update(videoEpisodes)
        .set({ isNsfw: true })
        .where(eq(videoEpisodes.id, episode.id));

      await propagateEpisodeNsfw(database.db, episode.id, false);

      const [row] = await database.db
        .select({ isNsfw: videoEpisodes.isNsfw })
        .from(videoEpisodes)
        .where(eq(videoEpisodes.id, episode.id));
      expect(row.isNsfw).toBe(false);
    });
  });

  describe("propagateMovieNsfw", () => {
    it("forces NSFW when the library root is NSFW", async () => {
      const { movie } = await seedMovie();

      await propagateMovieNsfw(database.db, movie.id, true);

      const [row] = await database.db
        .select({ isNsfw: videoMovies.isNsfw })
        .from(videoMovies)
        .where(eq(videoMovies.id, movie.id));
      expect(row.isNsfw).toBe(true);
    });

    it("marks NSFW when an attached tag or performer is NSFW", async () => {
      const { movie: movie1 } = await seedMovie();
      const [tag] = await database.db
        .insert(tags)
        .values({ name: `adult-m-${Math.random()}`, isNsfw: true })
        .returning();
      await database.db
        .insert(videoMovieTags)
        .values({ movieId: movie1.id, tagId: tag.id });
      await propagateMovieNsfw(database.db, movie1.id, false);
      const [row1] = await database.db
        .select({ isNsfw: videoMovies.isNsfw })
        .from(videoMovies)
        .where(eq(videoMovies.id, movie1.id));
      expect(row1.isNsfw).toBe(true);

      const { movie: movie2 } = await seedMovie();
      const [performer] = await database.db
        .insert(performers)
        .values({ name: `Movie Perf ${Math.random()}`, isNsfw: true })
        .returning();
      await database.db
        .insert(videoMoviePerformers)
        .values({ movieId: movie2.id, performerId: performer.id });
      await propagateMovieNsfw(database.db, movie2.id, false);
      const [row2] = await database.db
        .select({ isNsfw: videoMovies.isNsfw })
        .from(videoMovies)
        .where(eq(videoMovies.id, movie2.id));
      expect(row2.isNsfw).toBe(true);
    });

    it("inherits NSFW from a directly-attached NSFW studio", async () => {
      const [studio] = await database.db
        .insert(studios)
        .values({ name: `Movie Studio ${Math.random()}`, isNsfw: true })
        .returning();
      const { movie } = await seedMovie({ studioId: studio.id });

      await propagateMovieNsfw(database.db, movie.id, false);

      const [row] = await database.db
        .select({ isNsfw: videoMovies.isNsfw })
        .from(videoMovies)
        .where(eq(videoMovies.id, movie.id));
      expect(row.isNsfw).toBe(true);
    });

    it("leaves movie SFW when nothing NSFW is attached", async () => {
      const { movie } = await seedMovie();
      await propagateMovieNsfw(database.db, movie.id, false);
      const [row] = await database.db
        .select({ isNsfw: videoMovies.isNsfw })
        .from(videoMovies)
        .where(eq(videoMovies.id, movie.id));
      expect(row.isNsfw).toBe(false);
    });
  });
});
