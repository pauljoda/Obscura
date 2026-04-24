import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("video api helpers", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("loads subtitle source through the same-origin /api ingress", async () => {
    const { fetchVideoSubtitleSource } = await import("./videos");
    fetchMock.mockResolvedValue(
      new Response("WEBVTT", {
        status: 200,
        headers: { "Content-Type": "text/vtt; charset=utf-8" },
      }),
    );

    await fetchVideoSubtitleSource("video-1", "track-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/videos/video-1/subtitles/track-1/source",
    );
  });

  it("uploads subtitles through the same-origin /api ingress", async () => {
    const { uploadVideoSubtitle } = await import("./videos");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ track: { id: "track-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await uploadVideoSubtitle(
      "video-1",
      new File(["WEBVTT"], "captions.vtt"),
      "en",
      "English",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/videos/video-1/subtitles",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    );
  });
});
