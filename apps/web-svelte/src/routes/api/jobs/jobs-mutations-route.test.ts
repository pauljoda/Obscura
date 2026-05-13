import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "@obscura/app-core";

const {
  db,
  getWebDb,
  runQueueWrite,
  cancelQueueWrite,
  cancelAllJobsWrite,
  cancelJobRunWrite,
  backfillPhashesWrite,
  rebuildPreviewsWrite,
  migrateVideoAssetStorageWrite,
  acknowledgeFailedJobsWrite,
  clearMetadataWrite,
} = vi.hoisted(() => ({
  db: { name: "web-db" },
  getWebDb: vi.fn(),
  runQueueWrite: vi.fn(),
  cancelQueueWrite: vi.fn(),
  cancelAllJobsWrite: vi.fn(),
  cancelJobRunWrite: vi.fn(),
  backfillPhashesWrite: vi.fn(),
  rebuildPreviewsWrite: vi.fn(),
  migrateVideoAssetStorageWrite: vi.fn(),
  acknowledgeFailedJobsWrite: vi.fn(),
  clearMetadataWrite: vi.fn(),
}));

vi.mock("$lib/v1/server/db-v1", () => ({
  getWebDb,
}));

vi.mock("@obscura/app-core", async () => {
  const actual = await vi.importActual<typeof import("@obscura/app-core")>(
    "@obscura/app-core",
  );
  return {
    ...actual,
    runQueueWrite,
    cancelQueueWrite,
    cancelAllJobsWrite,
    cancelJobRunWrite,
    backfillPhashesWrite,
    rebuildPreviewsWrite,
    migrateVideoAssetStorageWrite,
    acknowledgeFailedJobsWrite,
    clearMetadataWrite,
  };
});

describe("/api/jobs mutation routes", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    runQueueWrite.mockReset();
    cancelQueueWrite.mockReset();
    cancelAllJobsWrite.mockReset();
    cancelJobRunWrite.mockReset();
    backfillPhashesWrite.mockReset();
    rebuildPreviewsWrite.mockReset();
    migrateVideoAssetStorageWrite.mockReset();
    acknowledgeFailedJobsWrite.mockReset();
    clearMetadataWrite.mockReset();
  });

  it("passes queue run requests through with the SFW flag", async () => {
    runQueueWrite.mockResolvedValue({
      ok: true,
      queueName: "preview",
      enqueued: 2,
      skipped: 1,
      jobIds: ["job-1", "job-2"],
    });

    const { POST } = await import("./queues/[queueName]/run/+server");
    const response = await POST({
      params: { queueName: "preview" },
      request: new Request("http://test/api/jobs/queues/preview/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-obscura-nsfw-mode": "off",
        },
        body: JSON.stringify({}),
      }),
    } as never);

    expect(runQueueWrite).toHaveBeenCalledWith(db, {
      queueName: "preview",
      sfwOnly: true,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      queueName: "preview",
      enqueued: 2,
      skipped: 1,
      jobIds: ["job-1", "job-2"],
    });
  });

  it("maps shared queue-run not-found errors to the standard error JSON body", async () => {
    runQueueWrite.mockRejectedValue(new NotFoundError("Unknown queue"));

    const { POST } = await import("./queues/[queueName]/run/+server");
    const response = await POST({
      params: { queueName: "missing" },
      request: new Request("http://test/api/jobs/queues/missing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    } as never);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Unknown queue" });
  });

  it("passes queue cancel requests through", async () => {
    cancelQueueWrite.mockResolvedValue({
      ok: true,
      queueName: "preview",
      waitingRemoved: 3,
      activeRemoved: 1,
    });

    const { POST } = await import("./queues/[queueName]/cancel/+server");
    const response = await POST({
      params: { queueName: "preview" },
    } as never);

    expect(cancelQueueWrite).toHaveBeenCalledWith(db, {
      queueName: "preview",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      queueName: "preview",
      waitingRemoved: 3,
      activeRemoved: 1,
    });
  });

  it("passes cancel-all requests through", async () => {
    cancelAllJobsWrite.mockResolvedValue({
      ok: true,
      waitingRemoved: 4,
      activeRemoved: 2,
      byQueue: {
        preview: { waitingRemoved: 4, activeRemoved: 2 },
      },
    });

    const { POST } = await import("./cancel-all/+server");
    const response = await POST({} as never);

    expect(cancelAllJobsWrite).toHaveBeenCalledWith(db);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      waitingRemoved: 4,
      activeRemoved: 2,
      byQueue: {
        preview: { waitingRemoved: 4, activeRemoved: 2 },
      },
    });
  });

  it("passes job-run cancel requests through", async () => {
    cancelJobRunWrite.mockResolvedValue({
      ok: true,
      jobRunId: "job-run-1",
      queueName: "preview",
      queueState: "waiting",
    });

    const { POST } = await import("./[jobRunId]/cancel/+server");
    const response = await POST({
      params: { jobRunId: "job-run-1" },
    } as never);

    expect(cancelJobRunWrite).toHaveBeenCalledWith(db, {
      jobRunId: "job-run-1",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      jobRunId: "job-run-1",
      queueName: "preview",
      queueState: "waiting",
    });
  });

  it("passes pHash backfill requests through with the SFW flag", async () => {
    backfillPhashesWrite.mockResolvedValue({
      ok: true,
      enqueued: 3,
      skipped: 0,
      jobIds: ["job-1", "job-2", "job-3"],
    });

    const { POST } = await import("./phash-backfill/+server");
    const response = await POST({
      request: new Request("http://test/api/jobs/phash-backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nsfw: "off" }),
      }),
    } as never);

    expect(backfillPhashesWrite).toHaveBeenCalledWith(db, {
      sfwOnly: true,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      enqueued: 3,
      skipped: 0,
      jobIds: ["job-1", "job-2", "job-3"],
    });
  });

  it("passes rebuild-previews requests through with the SFW flag", async () => {
    rebuildPreviewsWrite.mockResolvedValue({
      ok: true,
      enqueued: 2,
      skipped: 1,
      jobIds: ["job-1", "job-2"],
    });

    const { POST } = await import("./rebuild-previews/+server");
    const response = await POST({
      request: new Request("http://test/api/jobs/rebuild-previews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nsfw: "off" }),
      }),
    } as never);

    expect(rebuildPreviewsWrite).toHaveBeenCalledWith(db, {
      sfwOnly: true,
    });
    expect(response.status).toBe(200);
  });

  it("passes migrate-video-asset-storage requests through", async () => {
    migrateVideoAssetStorageWrite.mockResolvedValue({
      ok: true,
      jobId: "job-1",
    });

    const { POST } = await import("./migrate-video-asset-storage/+server");
    const response = await POST({
      request: new Request("http://test/api/jobs/migrate-video-asset-storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDedicated: true, nsfw: "off" }),
      }),
    } as never);

    expect(migrateVideoAssetStorageWrite).toHaveBeenCalledWith(db, {
      targetDedicated: true,
      sfwOnly: true,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, jobId: "job-1" });
  });

  it("passes acknowledge-failed requests through", async () => {
    acknowledgeFailedJobsWrite.mockResolvedValue({
      ok: true,
      queueName: "preview",
      runsUpdated: 2,
      externalRemovedByQueue: { preview: 2 },
    });

    const { POST } = await import("./acknowledge-failed/+server");
    const response = await POST({
      request: new Request("http://test/api/jobs/acknowledge-failed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueName: "preview" }),
      }),
    } as never);

    expect(acknowledgeFailedJobsWrite).toHaveBeenCalledWith(db, {
      queueName: "preview",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      queueName: "preview",
      runsUpdated: 2,
      externalRemovedByQueue: { preview: 2 },
    });
  });

  it("passes clear-metadata requests through", async () => {
    clearMetadataWrite.mockResolvedValue({
      ok: true,
      episodesCleared: 1,
      moviesCleared: 2,
      seriesCleared: 3,
      librariesQueued: 4,
      librariesSkipped: 5,
    });

    const { POST } = await import("./clear-metadata/+server");
    const response = await POST({} as never);

    expect(clearMetadataWrite).toHaveBeenCalledWith(db);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      episodesCleared: 1,
      moviesCleared: 2,
      seriesCleared: 3,
      librariesQueued: 4,
      librariesSkipped: 5,
    });
  });

  it("maps migrate validation errors to the standard error JSON body", async () => {
    migrateVideoAssetStorageWrite.mockRejectedValue(
      new ValidationError("targetDedicated (boolean) is required"),
    );

    const { POST } = await import("./migrate-video-asset-storage/+server");
    const response = await POST({
      request: new Request("http://test/api/jobs/migrate-video-asset-storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    } as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "targetDedicated (boolean) is required",
    });
  });
});
