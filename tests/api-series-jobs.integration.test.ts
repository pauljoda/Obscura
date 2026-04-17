import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "../packages/db/src/schema.ts";
import { createApiTestContext, injectJson } from "./support/api.ts";
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
  jobRuns,
  studios,
  librarySettings,
} = schema;

describe("API integration — video-series + jobs", () => {
  let context: Awaited<ReturnType<typeof createApiTestContext>>;
  let mediaDir: string;

  beforeAll(async () => {
    mediaDir = await createTempDir("obscura-series-media-");
    process.env.OBSCURA_CACHE_DIR = await createTempDir("obscura-series-cache-");
    process.env.CHANGELOG_PATH = "CHANGELOG.md";
    context = await createApiTestContext();
    await context.db.insert(librarySettings).values({});
  });

  afterAll(async () => {
    await context.close();
    await cleanupTempDir(mediaDir);
    await cleanupTempDir(process.env.OBSCURA_CACHE_DIR!);
    delete process.env.OBSCURA_CACHE_DIR;
    delete process.env.CHANGELOG_PATH;
  });

  describe("video-series routes", () => {
    it("lists, gets, and updates a series (including auto-created studio)", async () => {
      const [root] = await context.db
        .insert(libraryRoots)
        .values({ path: mediaDir, label: "Series Root", recursive: true })
        .returning();

      const seriesFolder = `${mediaDir}/My Show`;
      const [series] = await context.db
        .insert(videoSeries)
        .values({
          libraryRootId: root.id,
          folderPath: seriesFolder,
          relativePath: "My Show",
          title: "My Show",
        })
        .returning();
      const [season] = await context.db
        .insert(videoSeasons)
        .values({
          seriesId: series.id,
          seasonNumber: 1,
        })
        .returning();
      // Insert an episode so the series isn't filtered out as empty
      await context.db.insert(videoEpisodes).values({
        seriesId: series.id,
        seasonId: season.id,
        seasonNumber: 1,
        episodeNumber: 1,
        title: "Pilot",
        filePath: `${seriesFolder}/S01E01.mp4`,
      });

      const list = await context.app.inject({
        method: "GET",
        url: "/video-series",
      });
      expect(list.statusCode).toBe(200);
      const listBody = list.json() as {
        items: Array<{ id: string; title: string }>;
        total: number;
      };
      expect(listBody.items.some((s) => s.id === series.id)).toBe(true);

      const detail = await context.app.inject({
        method: "GET",
        url: `/video-series/${series.id}`,
      });
      expect(detail.statusCode).toBe(200);
      const detailBody = detail.json() as {
        id: string;
        title: string;
        customName: string | null;
      };
      expect(detailBody.title).toBe("My Show");

      const patch = await injectJson<unknown>(context.app, {
        method: "PATCH",
        url: `/video-series/${series.id}`,
        payload: {
          customName: "My Show (2024)",
          details: "Great show",
          rating: 5,
          studioName: "Auto-Created Studio",
        },
      });
      expect(patch.response.statusCode).toBe(200);

      const [updated] = await context.db
        .select()
        .from(videoSeries)
        .where(eq(videoSeries.id, series.id));
      expect(updated.customName).toBe("My Show (2024)");
      expect(updated.overview).toBe("Great show");
      expect(updated.rating).toBe(5);
      expect(updated.studioId).toBeTruthy();

      const studio = await context.db
        .select()
        .from(studios)
        .where(eq(studios.id, updated.studioId!));
      expect(studio[0]?.name).toBe("Auto-Created Studio");

      // Re-patch with studioName: null → clears studioId
      const clear = await injectJson<unknown>(context.app, {
        method: "PATCH",
        url: `/video-series/${series.id}`,
        payload: { studioName: null },
      });
      expect(clear.response.statusCode).toBe(200);
      const [cleared] = await context.db
        .select()
        .from(videoSeries)
        .where(eq(videoSeries.id, series.id));
      expect(cleared.studioId).toBeNull();
    });

    it("returns 404 for an unknown series id", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: "/video-series/00000000-0000-0000-0000-000000000000",
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe("jobs routes", () => {
    it("enqueues missing-job work for a queue and records a job_runs row", async () => {
      // Ensure we have a movie with no preview path so preview/run finds work
      const [root] = await context.db.select().from(libraryRoots).limit(1);
      const videoPath = await createSampleVideoFile(mediaDir, "preview-target.mp4");
      const [movie] = await context.db
        .insert(videoMovies)
        .values({
          libraryRootId: root!.id,
          title: "Preview Target",
          filePath: videoPath,
        })
        .returning({ id: videoMovies.id });

      context.queue.jobs = [];

      const response = await context.app.inject({
        method: "POST",
        url: "/jobs/queues/preview/run",
      });
      expect(response.statusCode).toBe(200);
      const body = response.json() as {
        ok: true;
        queueName: string;
        enqueued: number;
      };
      expect(body.queueName).toBe("preview");
      expect(body.enqueued).toBeGreaterThanOrEqual(1);
      expect(context.queue.jobs.some((job) => job.queueName === "preview")).toBe(
        true,
      );

      const runs = await context.db
        .select()
        .from(jobRuns)
        .where(eq(jobRuns.targetId, movie.id));
      expect(runs.some((r) => r.queueName === "preview")).toBe(true);
    });

    it("rejects unknown queue names with 404", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/jobs/queues/not-a-real-queue/run",
      });
      expect(response.statusCode).toBe(404);
    });

    it("returns a jobs dashboard snapshot", async () => {
      const response = await context.app.inject({ method: "GET", url: "/jobs" });
      expect(response.statusCode).toBe(200);
      const body = response.json() as {
        queues: Array<{ name: string }>;
      };
      expect(Array.isArray(body.queues)).toBe(true);
      expect(body.queues.length).toBeGreaterThan(0);
      expect(body.queues.some((q) => q.name === "preview")).toBe(true);
    });

    it("cancel-all succeeds even with no active jobs", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/jobs/cancel-all",
      });
      expect(response.statusCode).toBe(200);
      const body = response.json() as {
        ok: true;
        waitingRemoved: number;
        activeRemoved: number;
      };
      expect(body.ok).toBe(true);
      expect(typeof body.waitingRemoved).toBe("number");
    });
  });
});
