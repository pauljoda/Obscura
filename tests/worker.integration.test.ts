import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "../packages/db/src/schema.ts";
import { buildWorkerRuntime } from "../apps/worker/src/runtime.js";
import { processLibraryScan } from "../apps/worker/src/processors/library-scan.js";
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

const { libraryRoots, scenes, jobRuns, librarySettings } = schema;

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

  it("scans a library root, inserts scenes, and queues follow-up jobs", async () => {
    await createSampleVideoFile(mediaDir, "scan-target.mp4");
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

    const scannedScenes = await database.db.select().from(scenes);
    expect(scannedScenes).toHaveLength(1);
    expect(scannedScenes[0]?.title).toBe("scan target");

    const queuedJobs = await database.db.select().from(jobRuns);
    expect(queuedJobs.some((row) => row.queueName === "media-probe")).toBe(true);
    expect(queuedJobs.some((row) => row.queueName === "fingerprint")).toBe(true);
    expect(queuedJobs.some((row) => row.queueName === "preview")).toBe(true);
  });

  it("prunes stale scenes that no longer exist on disk", async () => {
    const stalePath = `${mediaDir}/missing.mp4`;
    const [root] = await database.db.select().from(libraryRoots).limit(1);
    const [scene] = await database.db
      .insert(scenes)
      .values({
        title: "Missing",
        filePath: stalePath,
      })
      .returning({ id: scenes.id });

    await processLibraryScan({
      id: "scan-2",
      data: { libraryRootId: root!.id },
    });

    const remaining = await database.db
      .select()
      .from(scenes)
      .where(eq(scenes.id, scene.id));
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
