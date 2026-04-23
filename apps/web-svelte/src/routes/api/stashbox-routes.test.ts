import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@obscura/app-core";

const {
  db,
  getWebDb,
  createStashBoxEndpointWrite,
  updateStashBoxEndpointWrite,
  deleteStashBoxEndpointWrite,
  testStashBoxEndpointWrite,
  identifyVideoViaStashBoxWrite,
  identifyPerformerViaStashBoxWrite,
  lookupStudioViaStashBoxWrite,
  lookupTagViaStashBoxWrite,
  lookupPerformerViaStashBoxWrite,
  listMetadataProvidersRead,
  listStashIdsRead,
  createStashIdWrite,
  deleteStashIdWrite,
  submitFingerprintsToEndpointWrite,
  listPhashContributionsRead,
} = vi.hoisted(() => ({
  db: { name: "web-db" },
  getWebDb: vi.fn(),
  createStashBoxEndpointWrite: vi.fn(),
  updateStashBoxEndpointWrite: vi.fn(),
  deleteStashBoxEndpointWrite: vi.fn(),
  testStashBoxEndpointWrite: vi.fn(),
  identifyVideoViaStashBoxWrite: vi.fn(),
  identifyPerformerViaStashBoxWrite: vi.fn(),
  lookupStudioViaStashBoxWrite: vi.fn(),
  lookupTagViaStashBoxWrite: vi.fn(),
  lookupPerformerViaStashBoxWrite: vi.fn(),
  listMetadataProvidersRead: vi.fn(),
  listStashIdsRead: vi.fn(),
  createStashIdWrite: vi.fn(),
  deleteStashIdWrite: vi.fn(),
  submitFingerprintsToEndpointWrite: vi.fn(),
  listPhashContributionsRead: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  getWebDb,
}));

vi.mock("@obscura/app-core", async () => {
  const actual = await vi.importActual<typeof import("@obscura/app-core")>(
    "@obscura/app-core",
  );
  return {
    ...actual,
    createStashBoxEndpointWrite,
    updateStashBoxEndpointWrite,
    deleteStashBoxEndpointWrite,
    testStashBoxEndpointWrite,
    identifyVideoViaStashBoxWrite,
    identifyPerformerViaStashBoxWrite,
    lookupStudioViaStashBoxWrite,
    lookupTagViaStashBoxWrite,
    lookupPerformerViaStashBoxWrite,
    listMetadataProvidersRead,
    listStashIdsRead,
    createStashIdWrite,
    deleteStashIdWrite,
    submitFingerprintsToEndpointWrite,
    listPhashContributionsRead,
  };
});

describe("/api/stashbox* routes", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    createStashBoxEndpointWrite.mockReset();
    updateStashBoxEndpointWrite.mockReset();
    deleteStashBoxEndpointWrite.mockReset();
    testStashBoxEndpointWrite.mockReset();
    identifyVideoViaStashBoxWrite.mockReset();
    identifyPerformerViaStashBoxWrite.mockReset();
    lookupStudioViaStashBoxWrite.mockReset();
    lookupTagViaStashBoxWrite.mockReset();
    lookupPerformerViaStashBoxWrite.mockReset();
    listMetadataProvidersRead.mockReset();
    listStashIdsRead.mockReset();
    createStashIdWrite.mockReset();
    deleteStashIdWrite.mockReset();
    submitFingerprintsToEndpointWrite.mockReset();
    listPhashContributionsRead.mockReset();
  });

  it("passes stashbox endpoint creates through", async () => {
    createStashBoxEndpointWrite.mockResolvedValue({ id: "ep-1" });

    const { POST } = await import("./stashbox-endpoints/+server");
    const response = await POST({
      request: new Request("http://test/api/stashbox-endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "FansDB",
          endpoint: "https://fansdb.cc",
          apiKey: "secret",
        }),
      }),
    } as never);

    expect(createStashBoxEndpointWrite).toHaveBeenCalledWith(db, {
      name: "FansDB",
      endpoint: "https://fansdb.cc",
      apiKey: "secret",
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "ep-1" });
  });

  it("passes stashbox endpoint updates through", async () => {
    updateStashBoxEndpointWrite.mockResolvedValue({ id: "ep-1", enabled: false });

    const { PATCH } = await import("./stashbox-endpoints/[id]/+server");
    const response = await PATCH({
      params: { id: "ep-1" },
      request: new Request("http://test/api/stashbox-endpoints/ep-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }),
    } as never);

    expect(updateStashBoxEndpointWrite).toHaveBeenCalledWith(db, {
      id: "ep-1",
      enabled: false,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "ep-1", enabled: false });
  });

  it("passes stashbox endpoint deletes through", async () => {
    deleteStashBoxEndpointWrite.mockResolvedValue({ ok: true });

    const { DELETE } = await import("./stashbox-endpoints/[id]/+server");
    const response = await DELETE({
      params: { id: "ep-1" },
    } as never);

    expect(deleteStashBoxEndpointWrite).toHaveBeenCalledWith(db, {
      id: "ep-1",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("passes stashbox endpoint test requests through", async () => {
    testStashBoxEndpointWrite.mockResolvedValue({ valid: true });

    const { POST } = await import("./stashbox-endpoints/[id]/test/+server");
    const response = await POST({
      params: { id: "ep-1" },
    } as never);

    expect(testStashBoxEndpointWrite).toHaveBeenCalledWith(db, {
      id: "ep-1",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ valid: true });
  });

  it("passes identify requests through", async () => {
    identifyVideoViaStashBoxWrite.mockResolvedValue({ matchType: "fingerprint" });

    const { POST } = await import("./stashbox-endpoints/[id]/identify/+server");
    const response = await POST({
      params: { id: "ep-1" },
      request: new Request("http://test/api/stashbox-endpoints/ep-1/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: "video-1" }),
      }),
    } as never);

    expect(identifyVideoViaStashBoxWrite).toHaveBeenCalledWith(db, {
      endpointId: "ep-1",
      videoId: "video-1",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ matchType: "fingerprint" });
  });

  it("passes identify-performer requests through", async () => {
    identifyPerformerViaStashBoxWrite.mockResolvedValue({
      results: [{ name: "Example Performer" }],
    });

    const { POST } = await import(
      "./stashbox-endpoints/[id]/identify-performer/+server"
    );
    const response = await POST({
      params: { id: "ep-1" },
      request: new Request(
        "http://test/api/stashbox-endpoints/ep-1/identify-performer",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ performerId: "performer-1" }),
        },
      ),
    } as never);

    expect(identifyPerformerViaStashBoxWrite).toHaveBeenCalledWith(db, {
      endpointId: "ep-1",
      performerId: "performer-1",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      results: [{ name: "Example Performer" }],
    });
  });

  it("passes lookup requests through", async () => {
    lookupStudioViaStashBoxWrite.mockResolvedValue({ studio: { id: "studio-1" } });
    lookupTagViaStashBoxWrite.mockResolvedValue({ tags: [{ id: "tag-1" }] });
    lookupPerformerViaStashBoxWrite.mockResolvedValue({
      performers: [{ name: "Example Performer" }],
      rawPerformers: [{ id: "perf-1" }],
    });

    const studioRoute = await import("./stashbox-endpoints/[id]/lookup/studio/+server");
    const tagRoute = await import("./stashbox-endpoints/[id]/lookup/tag/+server");
    const performerRoute = await import(
      "./stashbox-endpoints/[id]/lookup/performer/+server"
    );

    const studioResponse = await studioRoute.POST({
      params: { id: "ep-1" },
      request: new Request("http://test/api/stashbox-endpoints/ep-1/lookup/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "Studio Query" }),
      }),
    } as never);
    const tagResponse = await tagRoute.POST({
      params: { id: "ep-1" },
      request: new Request("http://test/api/stashbox-endpoints/ep-1/lookup/tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "Tag Query" }),
      }),
    } as never);
    const performerResponse = await performerRoute.POST({
      params: { id: "ep-1" },
      request: new Request(
        "http://test/api/stashbox-endpoints/ep-1/lookup/performer",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "Performer Query" }),
        },
      ),
    } as never);

    expect(lookupStudioViaStashBoxWrite).toHaveBeenCalledWith(db, {
      endpointId: "ep-1",
      query: "Studio Query",
    });
    expect(lookupTagViaStashBoxWrite).toHaveBeenCalledWith(db, {
      endpointId: "ep-1",
      query: "Tag Query",
    });
    expect(lookupPerformerViaStashBoxWrite).toHaveBeenCalledWith(db, {
      endpointId: "ep-1",
      query: "Performer Query",
    });
    expect(studioResponse.status).toBe(200);
    expect(tagResponse.status).toBe(200);
    expect(performerResponse.status).toBe(200);
  });

  it("passes metadata provider reads through", async () => {
    listMetadataProvidersRead.mockResolvedValue({
      providers: [{ id: "ep-1", type: "stashbox" }],
    });

    const { GET } = await import("./metadata-providers/+server");
    const response = await GET({} as never);

    expect(listMetadataProvidersRead).toHaveBeenCalledWith(db);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      providers: [{ id: "ep-1", type: "stashbox" }],
    });
  });

  it("passes stash-id reads and writes through", async () => {
    listStashIdsRead.mockResolvedValue({
      stashIds: [{ id: "link-1", stashId: "remote-1" }],
    });
    createStashIdWrite.mockResolvedValue({ id: "link-1" });
    deleteStashIdWrite.mockResolvedValue({ ok: true });

    const stashIdsRoute = await import("./stash-ids/+server");
    const stashIdDetailRoute = await import("./stash-ids/[id]/+server");

    const listResponse = await stashIdsRoute.GET({
      url: new URL("http://test/api/stash-ids?entityType=performer&entityId=perf-1"),
    } as never);
    const createResponse = await stashIdsRoute.POST({
      request: new Request("http://test/api/stash-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "performer",
          entityId: "perf-1",
          stashBoxEndpointId: "ep-1",
          stashId: "remote-1",
        }),
      }),
    } as never);
    const deleteResponse = await stashIdDetailRoute.DELETE({
      params: { id: "link-1" },
    } as never);

    expect(listStashIdsRead).toHaveBeenCalledWith(db, {
      entityType: "performer",
      entityId: "perf-1",
    });
    expect(createStashIdWrite).toHaveBeenCalledWith(db, {
      entityType: "performer",
      entityId: "perf-1",
      stashBoxEndpointId: "ep-1",
      stashId: "remote-1",
    });
    expect(deleteStashIdWrite).toHaveBeenCalledWith(db, {
      id: "link-1",
    });
    expect(listResponse.status).toBe(200);
    expect(createResponse.status).toBe(201);
    expect(deleteResponse.status).toBe(200);
  });

  it("passes phash contribution reads and submit-fingerprint writes through", async () => {
    listPhashContributionsRead.mockResolvedValue({
      total: 1,
      page: 2,
      pageSize: 5,
      items: [],
    });
    submitFingerprintsToEndpointWrite.mockResolvedValue({
      submissions: [{ algorithm: "PHASH", hash: "abc", status: "success" }],
    });

    const phashRoute = await import("./phash-contributions/+server");
    const submitRoute = await import(
      "./stashbox-endpoints/[id]/submit-fingerprints/+server"
    );

    const listResponse = await phashRoute.GET({
      url: new URL("http://test/api/phash-contributions?page=2&pageSize=5"),
    } as never);
    const submitResponse = await submitRoute.POST({
      params: { id: "ep-1" },
      request: new Request(
        "http://test/api/stashbox-endpoints/ep-1/submit-fingerprints",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: "video-1", algorithms: ["PHASH"] }),
        },
      ),
    } as never);

    expect(listPhashContributionsRead).toHaveBeenCalledWith(db, {
      page: "2",
      pageSize: "5",
    });
    expect(submitFingerprintsToEndpointWrite).toHaveBeenCalledWith(db, {
      endpointId: "ep-1",
      videoId: "video-1",
      algorithms: ["PHASH"],
    });
    expect(listResponse.status).toBe(200);
    expect(submitResponse.status).toBe(200);
  });

  it("maps shared not-found errors to the standard error JSON body", async () => {
    testStashBoxEndpointWrite.mockRejectedValue(
      new NotFoundError("StashBox endpoint not found"),
    );

    const { POST } = await import("./stashbox-endpoints/[id]/test/+server");
    const response = await POST({
      params: { id: "missing" },
    } as never);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "StashBox endpoint not found",
    });
  });
});
