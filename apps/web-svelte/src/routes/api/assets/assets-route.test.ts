import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getWebDb, createDbAssetDeps, resolveAssetRequest, mapAppCoreErrorToJson } = vi.hoisted(
  () => ({
    db: { name: "web-db" },
    getWebDb: vi.fn(),
    createDbAssetDeps: vi.fn(),
    resolveAssetRequest: vi.fn(),
    mapAppCoreErrorToJson: vi.fn(),
  }),
);

vi.mock("$lib/server/db", () => ({
  getWebDb,
}));

vi.mock("$lib/server/assets/database-deps", () => ({
  createDbAssetDeps,
}));

vi.mock("$lib/server/assets/resolve-asset-request", () => ({
  resolveAssetRequest,
}));

vi.mock("$lib/server/error-mapper", () => ({
  mapAppCoreErrorToJson,
}));

describe("/api/assets/[...asset] route", () => {
  beforeEach(() => {
    getWebDb.mockReset();
    createDbAssetDeps.mockReset();
    resolveAssetRequest.mockReset();
    mapAppCoreErrorToJson.mockReset();

    getWebDb.mockResolvedValue(db);
    createDbAssetDeps.mockReturnValue({ assetDeps: true });
    resolveAssetRequest.mockResolvedValue(
      new Response("card-bytes", {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
  });

  it("owns video card asset requests instead of falling through to the proxy", async () => {
    const { GET } = await import("./[...asset]/+server");

    const response = await GET({
      params: { asset: "videos/video-1/card" },
    } as never);

    expect(getWebDb).toHaveBeenCalledOnce();
    expect(createDbAssetDeps).toHaveBeenCalledWith(db);
    expect(resolveAssetRequest).toHaveBeenCalledWith(
      { assetDeps: true },
      "videos/video-1/card",
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("card-bytes");
  });
});
