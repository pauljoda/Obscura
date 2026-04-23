import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@obscura/app-core";

const { db, getWebDb, applyPerformerScrapeWrite } = vi.hoisted(() => ({
  db: { name: "web-db" },
  getWebDb: vi.fn(),
  applyPerformerScrapeWrite: vi.fn(),
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
    applyPerformerScrapeWrite,
  };
});

describe("/api/performers/[id]/apply-scrape route", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    applyPerformerScrapeWrite.mockReset();
  });

  it("passes performer scrape apply bodies through", async () => {
    applyPerformerScrapeWrite.mockResolvedValue({ ok: true, id: "performer-1" });

    const { POST } = await import("./[id]/apply-scrape/+server");
    const response = await POST({
      params: { id: "performer-1" },
      request: new Request("http://test/api/performers/performer-1/apply-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: { name: "Updated Name", imageUrl: "https://example.com/image.jpg" },
          selectedFields: ["name", "imageUrl"],
        }),
      }),
    } as never);

    expect(applyPerformerScrapeWrite).toHaveBeenCalledWith(db, {
      performerId: "performer-1",
      fields: { name: "Updated Name", imageUrl: "https://example.com/image.jpg" },
      selectedFields: ["name", "imageUrl"],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, id: "performer-1" });
  });

  it("maps shared not-found errors to Fastify-shaped JSON", async () => {
    applyPerformerScrapeWrite.mockRejectedValue(new NotFoundError("Actor not found"));

    const { POST } = await import("./[id]/apply-scrape/+server");
    const response = await POST({
      params: { id: "missing" },
      request: new Request("http://test/api/performers/missing/apply-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {}, selectedFields: [] }),
      }),
    } as never);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Actor not found" });
  });
});
