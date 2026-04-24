import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "@obscura/app-core";

const {
  db,
  getWebDb,
  installPluginPackageWrite,
  deletePluginPackageWrite,
  setPluginPackageEnabledWrite,
  getPluginAuthStatusesRead,
  setPluginAuthValueWrite,
  getUnifiedPluginIndexRead,
  getObscuraPluginIndexRead,
  getPluginUpdateStatusesRead,
  executePluginWrite,
  acceptPluginResultWrite,
  startPluginBatchJob,
  getPluginBatchJobStatus,
} = vi.hoisted(() => ({
  db: { name: "web-db" },
  getWebDb: vi.fn(),
  installPluginPackageWrite: vi.fn(),
  deletePluginPackageWrite: vi.fn(),
  setPluginPackageEnabledWrite: vi.fn(),
  getPluginAuthStatusesRead: vi.fn(),
  setPluginAuthValueWrite: vi.fn(),
  getUnifiedPluginIndexRead: vi.fn(),
  getObscuraPluginIndexRead: vi.fn(),
  getPluginUpdateStatusesRead: vi.fn(),
  executePluginWrite: vi.fn(),
  acceptPluginResultWrite: vi.fn(),
  startPluginBatchJob: vi.fn(),
  getPluginBatchJobStatus: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  getWebDb,
}));

vi.mock("$lib/server/plugin-batch", () => ({
  startPluginBatchJob,
  getPluginBatchJobStatus,
}));

vi.mock("@obscura/app-core", async () => {
  const actual = await vi.importActual<typeof import("@obscura/app-core")>(
    "@obscura/app-core",
  );
  return {
    ...actual,
    installPluginPackageWrite,
    deletePluginPackageWrite,
    setPluginPackageEnabledWrite,
    getPluginAuthStatusesRead,
    setPluginAuthValueWrite,
    getUnifiedPluginIndexRead,
    getObscuraPluginIndexRead,
    getPluginUpdateStatusesRead,
    executePluginWrite,
    acceptPluginResultWrite,
  };
});

describe("/api/plugins routes", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    installPluginPackageWrite.mockReset();
    deletePluginPackageWrite.mockReset();
    setPluginPackageEnabledWrite.mockReset();
    getPluginAuthStatusesRead.mockReset();
    setPluginAuthValueWrite.mockReset();
    getUnifiedPluginIndexRead.mockReset();
    getObscuraPluginIndexRead.mockReset();
    getPluginUpdateStatusesRead.mockReset();
    executePluginWrite.mockReset();
    acceptPluginResultWrite.mockReset();
    startPluginBatchJob.mockReset();
    getPluginBatchJobStatus.mockReset();
  });

  it("passes package install bodies through to app-core", async () => {
    installPluginPackageWrite.mockResolvedValue({ ok: true, pluginId: "tmdb" });

    const { POST } = await import("./packages/+server");
    const response = await POST({
      request: new Request("http://test/api/plugins/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pluginId: "tmdb",
          zipUrl: "https://example.test/tmdb.zip",
          sha256: "abc123",
        }),
      }),
    } as never);

    expect(installPluginPackageWrite).toHaveBeenCalledWith(db, {
      pluginId: "tmdb",
      zipUrl: "https://example.test/tmdb.zip",
      sha256: "abc123",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, pluginId: "tmdb" });
  });

  it("passes package toggle bodies through to app-core", async () => {
    setPluginPackageEnabledWrite.mockResolvedValue({ ok: true });

    const { PATCH } = await import("./packages/[id]/+server");
    const response = await PATCH({
      params: { id: "plugin-db-1" },
      request: new Request("http://test/api/plugins/packages/plugin-db-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }),
    } as never);

    expect(setPluginPackageEnabledWrite).toHaveBeenCalledWith(db, "plugin-db-1", false);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("passes package deletes through to app-core", async () => {
    deletePluginPackageWrite.mockResolvedValue({ ok: true });

    const { DELETE } = await import("./packages/[id]/+server");
    const response = await DELETE({
      params: { id: "plugin-db-1" },
    } as never);

    expect(deletePluginPackageWrite).toHaveBeenCalledWith(db, "plugin-db-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("lists plugin auth statuses through app-core", async () => {
    getPluginAuthStatusesRead.mockResolvedValue([
      {
        key: "apiKey",
        label: "API Key",
        required: true,
        url: "https://example.test/settings",
        configured: true,
      },
    ]);

    const { GET } = await import("./packages/[id]/auth/+server");
    const response = await GET({
      params: { id: "plugin-db-1" },
    } as never);

    expect(getPluginAuthStatusesRead).toHaveBeenCalledWith(db, "plugin-db-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        key: "apiKey",
        label: "API Key",
        required: true,
        url: "https://example.test/settings",
        configured: true,
      },
    ]);
  });

  it("passes auth value writes through to app-core", async () => {
    setPluginAuthValueWrite.mockResolvedValue({ ok: true });

    const { PUT } = await import("./packages/[id]/auth/[authKey]/+server");
    const response = await PUT({
      params: { id: "plugin-db-1", authKey: "apiKey" },
      request: new Request("http://test/api/plugins/packages/plugin-db-1/auth/apiKey", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "secret-token" }),
      }),
    } as never);

    expect(setPluginAuthValueWrite).toHaveBeenCalledWith(db, {
      pluginDbId: "plugin-db-1",
      authKey: "apiKey",
      value: "secret-token",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("passes unified plugin index filters through to app-core", async () => {
    getUnifiedPluginIndexRead.mockResolvedValue([{ id: "tmdb" }]);

    const { GET } = await import("./index/+server");
    const response = await GET({
      url: new URL("http://test/api/plugins/index?source=obscura-community&isNsfw=false"),
    } as never);

    expect(getUnifiedPluginIndexRead).toHaveBeenCalledWith(db, {
      source: "obscura-community",
      isNsfw: "false",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "tmdb" }]);
  });

  it("passes obscura index refresh through to app-core", async () => {
    getObscuraPluginIndexRead.mockResolvedValue([{ id: "tmdb", installed: true }]);

    const { GET } = await import("./obscura-index/+server");
    const response = await GET({
      url: new URL("http://test/api/plugins/obscura-index?refresh=1"),
    } as never);

    expect(getObscuraPluginIndexRead).toHaveBeenCalledWith(db, { refresh: "1" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "tmdb", installed: true }]);
  });

  it("passes check-updates refresh through to app-core", async () => {
    getPluginUpdateStatusesRead.mockResolvedValue([
      { pluginId: "tmdb", installedVersion: "1.0.0", availableVersion: "1.1.0", updateAvailable: true, zipUrl: "https://example.test/tmdb.zip", sha256: "abc123" },
    ]);

    const { GET } = await import("./check-updates/+server");
    const response = await GET({
      url: new URL("http://test/api/plugins/check-updates?refresh=true"),
    } as never);

    expect(getPluginUpdateStatusesRead).toHaveBeenCalledWith(db, { refresh: "true" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        pluginId: "tmdb",
        installedVersion: "1.0.0",
        availableVersion: "1.1.0",
        updateAvailable: true,
        zipUrl: "https://example.test/tmdb.zip",
        sha256: "abc123",
      },
    ]);
  });

  it("passes plugin execute bodies through to app-core", async () => {
    executePluginWrite.mockResolvedValue({
      ok: true,
      result: { id: "scrape-1" },
      pluginId: "tmdb",
      action: "movieByName",
    });

    const { POST } = await import("./[id]/execute/+server");
    const response = await POST({
      params: { id: "plugin-db-1" },
      request: new Request("http://test/api/plugins/plugin-db-1/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "movieByName",
          entityId: "movie-1",
          input: { title: "Movie Title" },
          saveResult: true,
        }),
      }),
    } as never);

    expect(executePluginWrite).toHaveBeenCalledWith(db, {
      pluginDbId: "plugin-db-1",
      action: "movieByName",
      entityId: "movie-1",
      input: { title: "Movie Title" },
      saveResult: true,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      result: { id: "scrape-1" },
      pluginId: "tmdb",
      action: "movieByName",
    });
  });

  it("passes plugin result accepts through to app-core", async () => {
    acceptPluginResultWrite.mockResolvedValue({
      ok: true,
      entityType: "audio_track",
      entityId: "track-1",
    });

    const { POST } = await import("./results/[id]/accept/+server");
    const response = await POST({
      params: { id: "result-1" },
      request: new Request("http://test/api/plugins/results/result-1/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: ["title", "tags"] }),
      }),
    } as never);

    expect(acceptPluginResultWrite).toHaveBeenCalledWith(db, {
      scrapeResultId: "result-1",
      fields: ["title", "tags"],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      entityType: "audio_track",
      entityId: "track-1",
    });
  });

  it("starts plugin batches through the shared batch helper", async () => {
    startPluginBatchJob.mockResolvedValue({
      jobId: "job-1",
      status: "completed",
    });

    const { POST } = await import("./batch/+server");
    const response = await POST({
      request: new Request("http://test/api/plugins/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pluginId: "plugin-db-1",
          action: "movieByName",
          entityType: "video_movie",
          entityIds: ["movie-1"],
          autoAccept: true,
        }),
      }),
    } as never);

    expect(startPluginBatchJob).toHaveBeenCalledWith(db, {
      pluginId: "plugin-db-1",
      action: "movieByName",
      entityType: "video_movie",
      entityIds: ["movie-1"],
      autoAccept: true,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      jobId: "job-1",
      status: "completed",
    });
  });

  it("returns stored plugin batch status payloads", async () => {
    getPluginBatchJobStatus.mockReturnValue({
      jobId: "job-1",
      status: "completed",
      total: 2,
      completed: 2,
      accepted: 1,
      found: 1,
      noResult: 0,
      failed: 0,
      items: [],
    });

    const { GET } = await import("./batch/[jobId]/+server");
    const response = await GET({
      params: { jobId: "job-1" },
    } as never);

    expect(getPluginBatchJobStatus).toHaveBeenCalledWith("job-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      jobId: "job-1",
      status: "completed",
      total: 2,
      accepted: 1,
      found: 1,
    });
  });

  it("passes folder cascade bodies through to app-core", async () => {
    executePluginWrite.mockResolvedValue({
      ok: true,
      result: { id: "scrape-2" },
      pluginId: "tmdb",
      action: "folderCascade",
    });

    const { POST } = await import("./[id]/folder-cascade/+server");
    const response = await POST({
      params: { id: "plugin-db-1" },
      request: new Request("http://test/api/plugins/plugin-db-1/folder-cascade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: "series-1",
          externalSeriesId: "tmdb:42",
          seasonNumber: 2,
        }),
      }),
    } as never);

    expect(executePluginWrite).toHaveBeenCalledWith(db, {
      pluginDbId: "plugin-db-1",
      action: "folderCascade",
      entityId: "series-1",
      input: {
        folderId: "series-1",
        externalId: "tmdb:42",
        externalSeriesId: "tmdb:42",
        seasonNumber: 2,
      },
      saveResult: true,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      result: { id: "scrape-2" },
      pluginId: "tmdb",
      action: "folderCascade",
    });
  });

  it("maps app-core validation errors to the standard error JSON body", async () => {
    installPluginPackageWrite.mockRejectedValue(
      new ValidationError("Either zipUrl or localPath is required"),
    );

    const { POST } = await import("./packages/+server");
    const response = await POST({
      request: new Request("http://test/api/plugins/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginId: "tmdb" }),
      }),
    } as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Either zipUrl or localPath is required",
    });
  });

  it("maps app-core not-found errors to the standard error JSON body", async () => {
    executePluginWrite.mockRejectedValue(new NotFoundError("Plugin not found"));

    const { POST } = await import("./[id]/execute/+server");
    const response = await POST({
      params: { id: "missing-plugin" },
      request: new Request("http://test/api/plugins/missing-plugin/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "movieByName" }),
      }),
    } as never);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Plugin not found" });
  });
});
