import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "@obscura/app-core";

const {
  db,
  getWebDb,
  fetchCommunityScraperIndexRead,
  installScraperPackageWrite,
  deleteScraperPackageWrite,
  updateScraperPackageWrite,
  scrapeVideoWrite,
  scrapePerformerWrite,
  listScrapeResultsRead,
  getScrapeResultRead,
  acceptScrapeResultWrite,
  rejectScrapeResultWrite,
} = vi.hoisted(() => ({
  db: { name: "web-db" },
  getWebDb: vi.fn(),
  fetchCommunityScraperIndexRead: vi.fn(),
  installScraperPackageWrite: vi.fn(),
  deleteScraperPackageWrite: vi.fn(),
  updateScraperPackageWrite: vi.fn(),
  scrapeVideoWrite: vi.fn(),
  scrapePerformerWrite: vi.fn(),
  listScrapeResultsRead: vi.fn(),
  getScrapeResultRead: vi.fn(),
  acceptScrapeResultWrite: vi.fn(),
  rejectScrapeResultWrite: vi.fn(),
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
    fetchCommunityScraperIndexRead,
    installScraperPackageWrite,
    deleteScraperPackageWrite,
    updateScraperPackageWrite,
    scrapeVideoWrite,
    scrapePerformerWrite,
    listScrapeResultsRead,
    getScrapeResultRead,
    acceptScrapeResultWrite,
    rejectScrapeResultWrite,
  };
});

vi.mock("@obscura/app-core/scraper-runtime", () => ({
  fetchCommunityScraperIndexRead,
  installScraperPackageWrite,
  deleteScraperPackageWrite,
  updateScraperPackageWrite,
  scrapeVideoWrite,
  scrapePerformerWrite,
  listScrapeResultsRead,
  getScrapeResultRead,
  acceptScrapeResultWrite,
  rejectScrapeResultWrite,
}));

describe("/api/scrapers routes", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    fetchCommunityScraperIndexRead.mockReset();
    installScraperPackageWrite.mockReset();
    deleteScraperPackageWrite.mockReset();
    updateScraperPackageWrite.mockReset();
    scrapeVideoWrite.mockReset();
    scrapePerformerWrite.mockReset();
    listScrapeResultsRead.mockReset();
    getScrapeResultRead.mockReset();
    acceptScrapeResultWrite.mockReset();
    rejectScrapeResultWrite.mockReset();
  });

  it("passes community index reads through with the force query", async () => {
    fetchCommunityScraperIndexRead.mockResolvedValue({
      entries: [{ id: "pkg-1", name: "Example", version: "1.0.0" }],
    });

    const { GET } = await import("./index/+server");
    const response = await GET({
      url: new URL("http://test/api/scrapers/index?force=true"),
    } as never);

    expect(fetchCommunityScraperIndexRead).toHaveBeenCalledWith(db, {
      force: true,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      entries: [{ id: "pkg-1", name: "Example", version: "1.0.0" }],
    });
  });

  it("passes package install bodies through", async () => {
    installScraperPackageWrite.mockResolvedValue({ id: "pkg-db-1" });

    const { POST } = await import("./packages/+server");
    const response = await POST({
      request: new Request("http://test/api/scrapers/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: "pkg-1" }),
      }),
    } as never);

    expect(installScraperPackageWrite).toHaveBeenCalledWith(db, {
      packageId: "pkg-1",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "pkg-db-1" });
  });

  it("passes package deletes through", async () => {
    deleteScraperPackageWrite.mockResolvedValue({ ok: true });

    const { DELETE } = await import("./packages/[id]/+server");
    const response = await DELETE({
      params: { id: "pkg-db-1" },
    } as never);

    expect(deleteScraperPackageWrite).toHaveBeenCalledWith(db, {
      id: "pkg-db-1",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("passes package toggles through", async () => {
    updateScraperPackageWrite.mockResolvedValue({ id: "pkg-db-1", enabled: false });

    const { PATCH } = await import("./packages/[id]/+server");
    const response = await PATCH({
      params: { id: "pkg-db-1" },
      request: new Request("http://test/api/scrapers/packages/pkg-db-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }),
    } as never);

    expect(updateScraperPackageWrite).toHaveBeenCalledWith(db, {
      id: "pkg-db-1",
      enabled: false,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "pkg-db-1", enabled: false });
  });

  it("passes video scrape requests through", async () => {
    scrapeVideoWrite.mockResolvedValue({ triedActions: ["sceneByName"] });

    const { POST } = await import("./[id]/scrape/+server");
    const response = await POST({
      params: { id: "scraper-1" },
      request: new Request("http://test/api/scrapers/scraper-1/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: "video-1",
          action: "auto",
          url: "https://example.com/scene",
          query: "Example Scene",
        }),
      }),
    } as never);

    expect(scrapeVideoWrite).toHaveBeenCalledWith(db, {
      scraperId: "scraper-1",
      videoId: "video-1",
      action: "auto",
      url: "https://example.com/scene",
      query: "Example Scene",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ triedActions: ["sceneByName"] });
  });

  it("passes performer scrape requests through", async () => {
    scrapePerformerWrite.mockResolvedValue({ action: "performerByName" });

    const { POST } = await import("./[id]/scrape-performer/+server");
    const response = await POST({
      params: { id: "scraper-1" },
      request: new Request(
        "http://test/api/scrapers/scraper-1/scrape-performer",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            performerId: "performer-1",
            action: "auto",
            query: "Example Performer",
          }),
        },
      ),
    } as never);

    expect(scrapePerformerWrite).toHaveBeenCalledWith(db, {
      scraperId: "scraper-1",
      performerId: "performer-1",
      action: "auto",
      query: "Example Performer",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ action: "performerByName" });
  });

  it("passes scrape result list filters through", async () => {
    listScrapeResultsRead.mockResolvedValue({
      results: [],
      total: 0,
      limit: 50,
      offset: 10,
    });

    const { GET } = await import("./results/+server");
    const response = await GET({
      url: new URL(
        "http://test/api/scrapers/results?status=pending&videoId=video-1&limit=50&offset=10",
      ),
    } as never);

    expect(listScrapeResultsRead).toHaveBeenCalledWith(db, {
      status: "pending",
      videoId: "video-1",
      limit: "50",
      offset: "10",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      results: [],
      total: 0,
      limit: 50,
      offset: 10,
    });
  });

  it("passes scrape result detail reads through", async () => {
    getScrapeResultRead.mockResolvedValue({ id: "result-1" });

    const { GET } = await import("./results/[id]/+server");
    const response = await GET({
      params: { id: "result-1" },
    } as never);

    expect(getScrapeResultRead).toHaveBeenCalledWith(db, {
      id: "result-1",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "result-1" });
  });

  it("passes scrape result accepts through", async () => {
    acceptScrapeResultWrite.mockResolvedValue({ ok: true, videoId: "video-1" });

    const { POST } = await import("./results/[id]/accept/+server");
    const response = await POST({
      params: { id: "result-1" },
      request: new Request("http://test/api/scrapers/results/result-1/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: ["title", "performers"],
          excludePerformers: ["Skip Me"],
          excludeTags: ["Skip Tag"],
        }),
      }),
    } as never);

    expect(acceptScrapeResultWrite).toHaveBeenCalledWith(db, {
      id: "result-1",
      fields: ["title", "performers"],
      excludePerformers: ["Skip Me"],
      excludeTags: ["Skip Tag"],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, videoId: "video-1" });
  });

  it("passes scrape result rejects through", async () => {
    rejectScrapeResultWrite.mockResolvedValue({ ok: true });

    const { POST } = await import("./results/[id]/reject/+server");
    const response = await POST({
      params: { id: "result-1" },
    } as never);

    expect(rejectScrapeResultWrite).toHaveBeenCalledWith(db, {
      id: "result-1",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("maps shared validation errors to the standard error JSON body", async () => {
    installScraperPackageWrite.mockRejectedValue(
      new ValidationError("packageId is required"),
    );

    const { POST } = await import("./packages/+server");
    const response = await POST({
      request: new Request("http://test/api/scrapers/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    } as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "packageId is required" });
  });
});
