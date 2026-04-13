import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchApi, toApiUrl } from "./core";

describe("fetchApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds JSON content type when sending a body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchApi<{ ok: boolean }>("/status", {
        method: "POST",
        body: JSON.stringify({ ok: true }),
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/status",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
      }),
    );

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("surfaces response text for API failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("broken", { status: 500 })),
    );

    await expect(fetchApi("/status")).rejects.toThrow("broken");
  });
});

describe("toApiUrl", () => {
  it("returns undefined for empty assets and preserves absolute URLs", () => {
    expect(toApiUrl(undefined)).toBeUndefined();
    expect(toApiUrl("https://example.com/image.jpg", "abc")).toBe(
      "https://example.com/image.jpg?v=abc",
    );
  });

  it("prefixes relative API paths and applies cache busting", () => {
    expect(toApiUrl("/assets/scenes/1/thumb")).toBe(
      "http://localhost:4000/assets/scenes/1/thumb",
    );
    expect(toApiUrl("/assets/scenes/1/thumb", "etag")).toBe(
      "http://localhost:4000/assets/scenes/1/thumb?v=etag",
    );
  });
});
