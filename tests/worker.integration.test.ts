import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "../packages/db/src/schema.ts";
import { buildWorkerRuntime } from "../apps/worker/src/runtime.js";
import { processLibraryScan } from "../apps/worker/src/processors/library-scan-video.js";
import {
  closeDatabase as closeWorkerDatabase,
  configureDatabase as configureWorkerDatabase,
} from "../apps/worker/src/lib/db.js";
import { configureQueueAdapter } from "../apps/worker/src/lib/queues.js";
import { createPostgresTestContext } from "./support/postgres.ts";
import { FakeQueueAdapter } from "./support/queues.ts";
import {
  cleanupTempDir,
  createSampleVideoFile,
  createTempDir,
} from "./support/files.ts";

const { libraryRoots, videoMovies, jobRuns, librarySettings } = schema;

describe("worker integration", () => {
  let database: Awaited<ReturnType<typeof createPostgresTestContext>>;
  let mediaDir: string;
  let queue: FakeQueueAdapter;

  beforeAll(async () => {
    database = await createPostgresTestContext();
    mediaDir = await createTempDir("obscura-worker-media-");
    process.env.OBSCURA_CACHE_DIR = await createTempDir("obscura-worker-cache-");
    queue = new FakeQueueAdapter();
    await configureWorkerDatabase({ connectionString: database.connectionString });
    configureQueueAdapter(queue);
  });

  afterAll(async () => {
    await closeWorkerDatabase();
    await database.close();
    await cleanupTempDir(mediaDir);
    await cleanupTempDir(process.env.OBSCURA_CACHE_DIR!);
    delete process.env.OBSCURA_CACHE_DIR;
  });

  it("scans a library root, inserts video movies, and queues follow-up jobs", async () => {
    await createSampleVideoFile(mediaDir, "ScanTarget.mp4");
    const [root] = await database.db
      .insert(libraryRoots)
      .values({
        path: mediaDir,
        label: "Fixture Root",
        recursive: true,
      })
      .returning();
    await database.db.insert(librarySettings).values({});

    await processLibraryScan({
      id: "scan-1",
      data: { libraryRootId: root.id },
    });

    const movies = await database.db.select().from(videoMovies);
    expect(movies).toHaveLength(1);
    expect(movies[0]?.title).toBeTruthy();
    expect(movies[0]?.filePath).toContain("ScanTarget.mp4");

    const queuedJobs = await database.db.select().from(jobRuns);
    expect(queuedJobs.some((row) => row.queueName === "media-probe")).toBe(true);
    expect(queuedJobs.some((row) => row.queueName === "fingerprint")).toBe(true);
    expect(queuedJobs.some((row) => row.queueName === "preview")).toBe(true);
  });

  it("prunes stale movies that no longer exist on disk", async () => {
    const stalePath = `${mediaDir}/missing.mp4`;
    const [root] = await database.db.select().from(libraryRoots).limit(1);
    const [movie] = await database.db
      .insert(videoMovies)
      .values({
        libraryRootId: root!.id,
        title: "Missing",
        filePath: stalePath,
      })
      .returning({ id: videoMovies.id });

    await processLibraryScan({
      id: "scan-2",
      data: { libraryRootId: root!.id },
    });

    const remaining = await database.db
      .select()
      .from(videoMovies)
      .where(eq(videoMovies.id, movie.id));
    expect(remaining).toHaveLength(0);
  });

  it("builds the runtime without implicit timers and registers workers through the adapter", async () => {
    const runtime = buildWorkerRuntime({
      databaseUrl: database.connectionString,
      queueAdapter: queue,
      runMigrations: false,
      startTimers: false,
      logger: { log: () => {} },
    });

    await runtime.start();
    expect(runtime.registeredWorkers.length).toBeGreaterThan(0);
    expect(queue.workers.length).toBe(runtime.registeredWorkers.length);

    await runtime.stop();
    expect(queue.workers).toHaveLength(0);
  });
});
