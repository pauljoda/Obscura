import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VideoSeriesDetailDto } from "@obscura/contracts";

const {
  deleteSeriesBackdrop,
  deleteSeriesCover,
  updateSeries,
  uploadSeriesBackdrop,
  uploadSeriesCover,
} = vi.hoisted(() => ({
  deleteSeriesBackdrop: vi.fn(),
  deleteSeriesCover: vi.fn(),
  updateSeries: vi.fn(),
  uploadSeriesBackdrop: vi.fn(),
  uploadSeriesCover: vi.fn(),
}));

vi.mock("$lib/api/videos", () => ({
  deleteSeriesBackdrop,
  deleteSeriesCover,
  updateSeries,
  uploadSeriesBackdrop,
  uploadSeriesCover,
}));

vi.mock("$lib/api/entities", () => ({
  fetchPerformers: vi.fn(() => Promise.resolve({ performers: [], total: 0, limit: 100, offset: 0 })),
  fetchStudios: vi.fn(() => Promise.resolve({ studios: [] })),
  fetchTags: vi.fn(() => Promise.resolve({ tags: [] })),
}));

vi.mock("$lib/nsfw/store.svelte", () => ({
  useNsfw: () => ({ mode: "show" }),
}));

import VideoSeriesEdit from "./VideoSeriesEdit.svelte";

function buildSeries(overrides: Partial<VideoSeriesDetailDto> = {}): VideoSeriesDetailDto {
  return {
    id: "series-1",
    title: "Original Series",
    customName: null,
    displayTitle: "Original Series",
    folderPath: "/media/videos/Original Series",
    relativePath: "Original Series",
    parentId: null,
    depth: 0,
    organized: false,
    isNsfw: false,
    coverImagePath: "/assets/video-series/series-1/cover",
    backdropImagePath: "/assets/video-series/series-1/backdrop",
    studioId: null,
    studioName: null,
    rating: 60,
    date: "2026-05-01",
    directVideoCount: 3,
    totalVideoCount: 3,
    visibleSfwVideoCount: 3,
    containsNsfwDescendants: false,
    childSeasonCount: 0,
    previewThumbnailPaths: ["/thumb-1.jpg"],
    libraryRootId: "root-1",
    libraryRootLabel: "Videos",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    details: "Old details",
    urls: [],
    externalSeriesId: null,
    studio: null,
    performers: [],
    tags: [],
    breadcrumbs: [],
    children: [],
    seasons: [],
    renderingMode: "flat",
    ...overrides,
  };
}

describe("VideoSeriesEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSeries.mockResolvedValue({ ok: true, id: "series-1" });
    uploadSeriesCover.mockResolvedValue({ ok: true, coverImagePath: "/assets/video-series/series-1/cover" });
    deleteSeriesCover.mockResolvedValue({ ok: true });
    uploadSeriesBackdrop.mockResolvedValue({ ok: true, backdropImagePath: "/assets/video-series/series-1/backdrop" });
    deleteSeriesBackdrop.mockResolvedValue({ ok: true });
  });

  it("saves series metadata and exposes artwork controls", async () => {
    const onSaved = vi.fn();
    const onChanged = vi.fn();
    render(VideoSeriesEdit, {
      props: {
        series: buildSeries(),
        onSaved,
        onChanged,
      },
    });

    await fireEvent.input(screen.getByLabelText(/display title/i), {
      target: { value: "Custom Series" },
    });
    await fireEvent.input(screen.getByLabelText(/details/i), {
      target: { value: "New details" },
    });
    await fireEvent.click(screen.getByRole("button", { name: /rate series with 4 star rating/i }));
    await fireEvent.click(screen.getByRole("button", { name: /mark organized/i }));
    await fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(updateSeries).toHaveBeenCalledWith("series-1", {
        customName: "Custom Series",
        details: "New details",
        date: "2026-05-01",
        rating: 80,
        isNsfw: false,
        organized: true,
        studioName: null,
        performerNames: [],
        tagNames: [],
      }),
    );
    expect(onSaved).toHaveBeenCalled();

    expect(screen.getByRole("button", { name: /upload cover/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear cover/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload backdrop/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear backdrop/i })).toBeInTheDocument();

    const coverInput = screen.getByLabelText(/cover file/i) as HTMLInputElement;
    await fireEvent.change(coverInput, {
      target: { files: [new File(["cover"], "cover.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(uploadSeriesCover).toHaveBeenCalled());

    await fireEvent.click(screen.getByRole("button", { name: /clear cover/i }));
    await waitFor(() => expect(deleteSeriesCover).toHaveBeenCalledWith("series-1"));

    const backdropInput = screen.getByLabelText(/backdrop file/i) as HTMLInputElement;
    await fireEvent.change(backdropInput, {
      target: { files: [new File(["backdrop"], "backdrop.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(uploadSeriesBackdrop).toHaveBeenCalled());

    await fireEvent.click(screen.getByRole("button", { name: /clear backdrop/i }));
    await waitFor(() => expect(deleteSeriesBackdrop).toHaveBeenCalledWith("series-1"));
    expect(onChanged).toHaveBeenCalled();
  });
});
