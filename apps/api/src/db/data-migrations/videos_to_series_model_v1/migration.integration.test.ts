import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import { videosToSeriesModelV1 } from "./index";
import type { DataMigrationContext } from "../types";

const DATABASE_URL = process.env.DATABASE_URL;

const shouldRun = !!DATABASE_URL;
const maybeDescribe = shouldRun ? describe : describe.skip;

maybeDescribe("videos_to_series_model_v1 integration", () => {
  let client: ReturnType<typeof postgres>;
  let ctx: DataMigrationContext;

  beforeAll(async () => {
    client = postgres(DATABASE_URL!, { max: 1 });
    ctx = {
      client: client as unknown as DataMigrationContext["client"],
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      reportProgress: () => {},
    };
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    const scenesExists = await client<Array<{ exists: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scenes') AS exists
    `;
    if (!scenesExists[0]?.exists) {
      throw new Error(
        "scenes table is missing — re-run `pnpm --filter @obscura/api db:migrate` to restore the dev schema before running integration tests",
      );
    }
    await client`TRUNCATE video_episode_tags, video_episode_performers, video_episodes, video_seasons, video_series_tags, video_series_performers, video_series, video_movie_tags, video_movie_performers, video_movies RESTART IDENTITY CASCADE`;
    await client`DELETE FROM data_migrations WHERE name = ${videosToSeriesModelV1.name}`;
    await client`TRUNCATE scene_performers, scene_tags, scene_folder_performers, scene_folder_tags, scene_folders, scenes RESTART IDENTITY CASCADE`;
  });

  it("migrates a mixed movie + series library", async () => {
    await client`
      INSERT INTO library_roots (path, label)
      VALUES ('/media/test', 'test')
    `;

    await client`
      INSERT INTO scenes (title, file_path, rating, play_count, is_nsfw, organized)
      VALUES ('Heat', '/media/test/Heat (1995).mkv', 5, 3, false, true)
    `;
    await client`
      INSERT INTO scenes (title, file_path, play_count)
      VALUES ('Expanse S01E01', '/media/test/The Expanse/S01E01.mkv', 1)
    `;
    await client`
      INSERT INTO scenes (title, file_path, play_count)
      VALUES ('Expanse S01E02', '/media/test/The Expanse/S01E02.mkv', 0)
    `;
    await client`
      INSERT INTO scenes (title, file_path, play_count)
      VALUES ('BB S01E01', '/media/test/Breaking Bad/Season 1/S01E01.mkv', 2)
    `;
    await client`
      INSERT INTO scenes (title, file_path, play_count)
      VALUES ('BB S01E02', '/media/test/Breaking Bad/Season 1/S01E02.mkv', 0)
    `;

    const result = await videosToSeriesModelV1.stage(ctx);
    expect(result.warnings).toEqual([]);
    const metrics = result.metrics as Record<string, number>;
    expect(metrics.moviesCreated).toBe(1);
    expect(metrics.seriesCreated).toBe(2);
    expect(metrics.seasonsCreated).toBe(2);
    expect(metrics.episodesCreated).toBe(4);

    const series = await client<Array<{ title: string; folder_path: string }>>`
      SELECT title, folder_path FROM video_series ORDER BY title
    `;
    expect(series.map((s) => s.title)).toEqual(["Breaking Bad", "The Expanse"]);

    const episodes = await client<
      Array<{ title: string; play_count: number; season_number: number }>
    >`
      SELECT title, play_count, season_number FROM video_episodes ORDER BY title
    `;
    expect(episodes.length).toBe(4);
    const expanseEp01 = episodes.find((e) => e.title === "Expanse S01E01");
    expect(expanseEp01?.play_count).toBe(1);
    expect(expanseEp01?.season_number).toBe(0);
    const bbEp01 = episodes.find((e) => e.title === "BB S01E01");
    expect(bbEp01?.play_count).toBe(2);
    expect(bbEp01?.season_number).toBe(1);

    const movies = await client<
      Array<{ title: string; rating: number; play_count: number }>
    >`
      SELECT title, rating, play_count FROM video_movies
    `;
    expect(movies.length).toBe(1);
    expect(movies[0].title).toBe("Heat");
    expect(movies[0].rating).toBe(5);
    expect(movies[0].play_count).toBe(3);
  });

  it("drops legacy tables on finalize", async () => {
    await client`INSERT INTO library_roots (path, label) VALUES ('/media/test2', 'test2')`;
    await client`INSERT INTO scenes (title, file_path) VALUES ('One', '/media/test2/One.mkv')`;

    await videosToSeriesModelV1.stage(ctx);
    await videosToSeriesModelV1.finalize(ctx);

    const tables = await client<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('scenes', 'scene_folders')
    `;
    expect(tables).toEqual([]);

    const columns = await client<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'library_roots' AND column_name = 'scan_videos'
    `;
    expect(columns).toEqual([]);
  });
});
