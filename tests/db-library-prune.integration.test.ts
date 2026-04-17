import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "../packages/db/src/schema.ts";
import { pruneUntrackedLibraryReferences } from "../packages/db/src/lib/library-prune.ts";
import { createPostgresTestContext } from "./support/postgres.ts";
import {
  cleanupTempDir,
  createSampleVideoFile,
  createTempDir,
} from "./support/files.ts";

const {
  libraryRoots,
  videoSeries,
  videoSeasons,
  videoEpisodes,
  videoMovies,
} = schema;

describe("pruneUntrackedLibraryReferences", () => {
  let database: Awaited<ReturnType<typeof createPostgresTestContext>>;

  beforeAll(async () => {
    process.env.OBSCURA_CACHE_DIR = await createTempDir("obscura-prune-cache-");
    database = await createPostgresTestContext();
  });

  afterAll(async () => {
    await database.close();
    await cleanupTempDir(process.env.OBSCURA_CACHE_DIR!);
    delete process.env.OBSCURA_CACHE_DIR;
  });

  // Wipe video + root state between tests so each one starts clean
  beforeEach(async () => {
    await database.db.delete(videoEpisodes);
    await database.db.delete(videoSeasons);
    await database.db.delete(videoSeries);
    await database.db.delete(videoMovies);
    await database.db.delete(libraryRoots);
  });

  it("deletes movies whose file is missing on disk", async () => {
    const mediaDir = await createTempDir("obscura-prune-missing-");
    try {
      const [root] = await database.db
        .insert(libraryRoots)
        .values({ path: mediaDir, label: "prune root" })
        .returning();

      const present = await createSampleVideoFile(mediaDir, "present.mp4");
      const [kept] = await database.db
        .insert(videoMovies)
        .values({
          libraryRootId: root.id,
          title: "Present",
          filePath: present,
        })
        .returning({ id: videoMovies.id });

      const [missing] = await database.db
        .insert(videoMovies)
        .values({
          libraryRootId: root.id,
          title: "Missing",
          filePath: `${mediaDir}/does-not-exist.mp4`,
        })
        .returning({ id: videoMovies.id });

      await pruneUntrackedLibraryReferences(database.db);

      const remaining = await database.db.select().from(videoMovies);
      const remainingIds = remaining.map((m) => m.id);
      expect(remainingIds).toContain(kept.id);
      expect(remainingIds).not.toContain(missing.id);
    } finally {
      await cleanupTempDir(mediaDir);
    }
  });

  it("cleans up seasons + series when all their episodes are pruned", async () => {
    const mediaDir = await createTempDir("obscura-prune-series-");
    try {
      const [root] = await database.db
        .insert(libraryRoots)
        .values({ path: mediaDir, label: "series root" })
        .returning();
      const [series] = await database.db
        .insert(videoSeries)
        .values({
          libraryRootId: root.id,
          folderPath: `${mediaDir}/Ghost Series`,
          relativePath: "Ghost Series",
          title: "Ghost Series",
        })
        .returning();
      const [season] = await database.db
        .insert(videoSeasons)
        .values({ seriesId: series.id, seasonNumber: 1 })
        .returning();
      await database.db.insert(videoEpisodes).values({
        seriesId: series.id,
        seasonId: season.id,
        seasonNumber: 1,
        episodeNumber: 1,
        title: "Lost",
        filePath: `${mediaDir}/ghost-episode.mp4`, // does not exist on disk
      });

      await pruneUntrackedLibraryReferences(database.db);

      const episodes = await database.db
        .select()
        .from(videoEpisodes)
        .where(eq(videoEpisodes.seriesId, series.id));
      expect(episodes).toHaveLength(0);

      const seasons = await database.db
        .select()
        .from(videoSeasons)
        .where(eq(videoSeasons.seriesId, series.id));
      expect(seasons).toHaveLength(0);

      const seriesRows = await database.db
        .select()
        .from(videoSeries)
        .where(eq(videoSeries.id, series.id));
      expect(seriesRows).toHaveLength(0);
    } finally {
      await cleanupTempDir(mediaDir);
    }
  });

  it("does NOT prune orphans-by-root when no video-enabled roots exist (safety rail)", async () => {
    const mediaDir = await createTempDir("obscura-prune-safety-");
    const outsideDir = await createTempDir("obscura-prune-safety-outside-");
    try {
      // Root exists but has scan_movies = false, scan_series = false, so the
      // function treats videoRootPaths as empty and skips orphan-by-root.
      const [root] = await database.db
        .insert(libraryRoots)
        .values({
          path: mediaDir,
          label: "non-video root",
          scanMovies: false,
          scanSeries: false,
        })
        .returning();

      const filePath = await createSampleVideoFile(outsideDir, "outside.mp4");
      const [movie] = await database.db
        .insert(videoMovies)
        .values({
          libraryRootId: root.id,
          title: "Outside the video roots, but present on disk",
          filePath,
        })
        .returning({ id: videoMovies.id });

      await pruneUntrackedLibraryReferences(database.db);

      const rows = await database.db
        .select()
        .from(videoMovies)
        .where(eq(videoMovies.id, movie.id));
      expect(rows).toHaveLength(1);
    } finally {
      await cleanupTempDir(mediaDir);
      await cleanupTempDir(outsideDir);
    }
  });

  it("prunes orphans that live outside any enabled video root when roots exist", async () => {
    const insideDir = await createTempDir("obscura-prune-inside-");
    const outsideDir = await createTempDir("obscura-prune-outside-");
    try {
      const insidePath = await createSampleVideoFile(insideDir, "inside.mp4");
      const outsidePath = await createSampleVideoFile(outsideDir, "outside.mp4");

      const [root] = await database.db
        .insert(libraryRoots)
        .values({ path: insideDir, label: "scoped-root" })
        .returning();

      const [insideMovie] = await database.db
        .insert(videoMovies)
        .values({
          libraryRootId: root.id,
          title: "Inside",
          filePath: insidePath,
        })
        .returning({ id: videoMovies.id });
      const [outsideMovie] = await database.db
        .insert(videoMovies)
        .values({
          libraryRootId: root.id,
          title: "Outside",
          filePath: outsidePath,
        })
        .returning({ id: videoMovies.id });

      await pruneUntrackedLibraryReferences(database.db);

      const remaining = await database.db.select().from(videoMovies);
      const remainingIds = remaining.map((m) => m.id);
      expect(remainingIds).toContain(insideMovie.id);
      expect(remainingIds).not.toContain(outsideMovie.id);
    } finally {
      await cleanupTempDir(insideDir);
      await cleanupTempDir(outsideDir);
    }
  });
});
