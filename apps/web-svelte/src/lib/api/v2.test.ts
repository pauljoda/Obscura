import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("v2 api client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("fetches entities with encoded query parameters", async () => {
    const { fetchV2Entities } = await import("./v2");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await fetchV2Entities({ kind: "video", query: "space movie", cursor: "abc+123" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8010/api/entities?kind=video&query=space+movie&cursor=abc%2B123",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  it("updates shared ratings through the global entity route", async () => {
    const { updateV2EntityRating } = await import("./v2");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await updateV2EntityRating("11111111-1111-1111-1111-111111111111", 4);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8010/api/entities/11111111-1111-1111-1111-111111111111/rating",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ value: 4 }),
      }),
    );
  });
});
