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

vi.mock("$lib/v1/server/db-v1", () => ({
  getWebDb,
}));

vi.mock("$lib/v1/server/assets/database-deps-v1", () => ({
  createDbAssetDeps,
}));

vi.mock("$lib/v1/server/assets/resolve-asset-request-v1", () => ({
  resolveAssetRequest,
}));

vi.mock("$lib/v1/server/error-mapper-v1", () => ({
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
      request: new Request("http://localhost/api/assets/videos/video-1/card"),
    } as never);

    expect(getWebDb).toHaveBeenCalledOnce();
    expect(createDbAssetDeps).toHaveBeenCalledWith(db);
    expect(resolveAssetRequest).toHaveBeenCalledWith(
      { assetDeps: true },
      "videos/video-1/card",
      null,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("card-bytes");
  });

  it("forwards the Range header to resolveAssetRequest", async () => {
    const { GET } = await import("./[...asset]/+server");

    await GET({
      params: { asset: "images/image-1/preview" },
      request: new Request("http://localhost/api/assets/images/image-1/preview", {
        headers: { Range: "bytes=0-1023" },
      }),
    } as never);

    expect(resolveAssetRequest).toHaveBeenCalledWith(
      { assetDeps: true },
      "images/image-1/preview",
      "bytes=0-1023",
    );
  });
});
