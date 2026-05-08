import { beforeEach, describe, expect, it, vi } from "vitest";
import { detailTabsFor } from "./detail-tabs";
import { fetchAudioLibraries, fetchGalleries, fetchImages } from "$lib/api/media";

vi.mock("$lib/api/videos", () => ({
  fetchVideoCards: vi.fn(),
  fetchSeries: vi.fn(),
}));

vi.mock("$lib/api/media", () => ({
  fetchAudioLibraries: vi.fn(),
  fetchAudioTracks: vi.fn(),
  fetchGalleries: vi.fn(),
  fetchImages: vi.fn(),
}));

vi.mock("$lib/api/entities", () => ({
  fetchPerformers: vi.fn(),
}));

describe("detailTabsFor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchGalleries).mockResolvedValue({ galleries: [], total: 0, limit: 60, offset: 0 });
    vi.mocked(fetchAudioLibraries).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(fetchImages).mockResolvedValue({ images: [], total: 0, limit: 60, offset: 0 });
  });

  it("omits tabs whose detail count is zero", () => {
    const tabs = detailTabsFor({
      entityKind: "performer",
      entityId: "actor-1",
      entityName: "Actor One",
      nsfwMode: "show",
      totals: {
        videos: 3,
        series: 0,
        galleries: 1,
        images: 0,
        "audio-libraries": 0,
        "audio-tracks": 2,
      },
    });

    expect(tabs.map((tab) => tab.id)).toEqual([
      "videos",
      "galleries",
      "audio-tracks",
    ]);
  });

  it("flattens scoped gallery tabs so nested actor galleries are returned", async () => {
    const tabs = detailTabsFor({
      entityKind: "performer",
      entityId: "actor-1",
      entityName: "Actor One",
      nsfwMode: "show",
      totals: { galleries: 1 },
    });
    const config = tabs.find((tab) => tab.id === "galleries")?.build();
    if (!config) throw new Error("Expected galleries tab");

    await config.fetcher({
      offset: 0,
      limit: 60,
      signal: new AbortController().signal,
      prefs: {
        viewMode: "grid",
        sortBy: "recent",
        sortDir: "desc" as const,
        search: "",
        activeFilters: [],
      },
    });

    expect(fetchGalleries).toHaveBeenCalledWith(
      expect.objectContaining({
        performer: ["Actor One"],
        root: "all",
      }),
      expect.any(Object),
    );
  });

  it("flattens scoped audio library tabs so nested performer libraries are returned", async () => {
    const tabs = detailTabsFor({
      entityKind: "performer",
      entityId: "actor-1",
      entityName: "Actor One",
      nsfwMode: "show",
      totals: { "audio-libraries": 1 },
    });
    const config = tabs.find((tab) => tab.id === "audio-libraries")?.build();
    if (!config) throw new Error("Expected audio libraries tab");

    await config.fetcher({
      offset: 0,
      limit: 60,
      signal: new AbortController().signal,
      prefs: {
        viewMode: "grid",
        sortBy: "recent",
        sortDir: "desc" as const,
        search: "",
        activeFilters: [],
      },
    });

    expect(fetchAudioLibraries).toHaveBeenCalledWith(
      expect.objectContaining({
        performer: ["Actor One"],
        root: "all",
      }),
      expect.any(Object),
    );
  });

  it("uses studio ids for gallery and image tabs because those endpoints filter by FK", async () => {
    const tabs = detailTabsFor({
      entityKind: "studio",
      entityId: "studio-1",
      entityName: "Studio One",
      nsfwMode: "show",
      totals: { galleries: 1, images: 1 },
    });
    const galleriesConfig = tabs.find((tab) => tab.id === "galleries")?.build();
    const imagesConfig = tabs.find((tab) => tab.id === "images")?.build();
    if (!galleriesConfig || !imagesConfig) throw new Error("Expected studio media tabs");
    const args = {
      offset: 0,
      limit: 60,
      signal: new AbortController().signal,
      prefs: {
        viewMode: "grid",
        sortBy: "recent",
        sortDir: "desc" as const,
        search: "",
        activeFilters: [],
      },
    };

    await galleriesConfig.fetcher(args);
    await imagesConfig.fetcher(args);

    expect(fetchGalleries).toHaveBeenCalledWith(
      expect.objectContaining({ studio: "studio-1" }),
      expect.any(Object),
    );
    expect(fetchImages).toHaveBeenCalledWith(
      expect.objectContaining({ studio: "studio-1" }),
      expect.any(Object),
    );
  });

  it("uses studio names for audio library tabs because audio resolves studios by name", async () => {
    const tabs = detailTabsFor({
      entityKind: "studio",
      entityId: "studio-1",
      entityName: "Studio One",
      nsfwMode: "show",
      totals: { "audio-libraries": 1 },
    });
    const config = tabs.find((tab) => tab.id === "audio-libraries")?.build();
    if (!config) throw new Error("Expected audio libraries tab");

    await config.fetcher({
      offset: 0,
      limit: 60,
      signal: new AbortController().signal,
      prefs: {
        viewMode: "grid",
        sortBy: "recent",
        sortDir: "desc" as const,
        search: "",
        activeFilters: [],
      },
    });

    expect(fetchAudioLibraries).toHaveBeenCalledWith(
      expect.objectContaining({
        studio: "Studio One",
        root: "all",
      }),
      expect.any(Object),
    );
  });

  it("keeps legacy visibility when no counts are supplied", () => {
    const tabs = detailTabsFor({
      entityKind: "studio",
      entityId: "studio-1",
      entityName: "Studio One",
      nsfwMode: "show",
    });

    expect(tabs.map((tab) => tab.id)).toEqual([
      "videos",
      "series",
      "galleries",
      "images",
      "audio-libraries",
      "audio-tracks",
    ]);
  });
});
