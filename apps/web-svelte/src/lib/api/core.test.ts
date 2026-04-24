import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("api core", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("falls back to the same-origin /api base for JSON requests", async () => {
    const { fetchApi } = await import("./core");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await fetchApi("/videos");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/videos",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("falls back to the same-origin /api base for uploads", async () => {
    const { uploadFile } = await import("./core");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await uploadFile("/videos/upload", new File(["test"], "clip.mp4"));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/videos/upload",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    );
  });

  it("prefixes relative asset paths with the same-origin /api base", async () => {
    const { toApiUrl } = await import("./core");
    expect(toApiUrl("/assets/videos/abc/thumb")).toBe("/api/assets/videos/abc/thumb");
  });
});
