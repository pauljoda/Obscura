import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./+page.svelte";
import type { AudioTrackDetailDto } from "@obscura/contracts";

const { updateAudioTrack } = vi.hoisted(() => ({
  updateAudioTrack: vi.fn(),
}));

const { fetchTags, fetchPerformers } = vi.hoisted(() => ({
  fetchTags: vi.fn(),
  fetchPerformers: vi.fn(),
}));

vi.mock("$lib/v1/api/media-v1", async () => {
  const actual = await vi.importActual<typeof import("$lib/v1/api/media-v1")>("$lib/v1/api/media-v1");
  return {
    ...actual,
    updateAudioTrack,
  };
});

vi.mock("$lib/v1/api/entities-v1", async () => {
  const actual = await vi.importActual<typeof import("$lib/v1/api/entities-v1")>("$lib/v1/api/entities-v1");
  return {
    ...actual,
    fetchTags,
    fetchPerformers,
  };
});

vi.mock("$lib/nsfw/store.svelte", () => ({
  useNsfw: () => ({ mode: "show" }),
}));

vi.mock("$lib/stores/playlist.svelte", () => ({
  usePlaylist: () => ({
    isActive: false,
    isPlaylistItem: () => false,
    reportContentEnded: vi.fn(),
  }),
}));

vi.mock("$lib/stores/app-chrome.svelte", () => ({
  useAppChrome: () => ({
    sidebarCollapsed: false,
    setBottomDockInset: vi.fn(),
    clearBottomDockInset: vi.fn(),
  }),
}));

function makeTrack(): AudioTrackDetailDto {
  return {
    id: "track-1",
    title: "Waltz in E Flat",
    date: "2026-04-23",
    rating: 40,
    organized: false,
    isNsfw: false,
    duration: 143,
    bitRate: 320000,
    sampleRate: 44100,
    channels: 2,
    codec: "mp3",
    fileSize: 5_242_880,
    embeddedArtist: "Alice",
    embeddedAlbum: "Classical Covers",
    trackNumber: 1,
    waveformPath: null,
    libraryId: "library-1",
    sortOrder: 0,
    studioId: "studio-1",
    performers: [{ id: "performer-1", name: "Alice" }],
    tags: [{ id: "tag-1", name: "Piano", isNsfw: false }],
    playCount: 2,
    lastPlayedAt: "2026-04-22T00:00:00.000Z",
    createdAt: "2026-04-23T00:00:00.000Z",
    details: "Detailed notes",
    checksumMd5: null,
    oshash: null,
    filePath: "/media/audio/classical-covers/waltz.mp3",
    container: "mp3",
    resumeTime: 0,
    playDuration: 0,
    studio: { id: "studio-1", name: "Night Studio" },
    markers: [],
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
}

describe("audio track detail page", () => {
  beforeEach(() => {
    updateAudioTrack.mockReset();
    fetchTags.mockReset();
    fetchPerformers.mockReset();

    updateAudioTrack.mockResolvedValue({ ok: true });
    fetchTags.mockResolvedValue({ tags: [{ id: "tag-1", name: "Piano", isNsfw: false }] });
    fetchPerformers.mockResolvedValue({
      performers: [{ id: "performer-1", name: "Alice", videoCount: 1 }],
      total: 1,
      limit: 500,
      offset: 0,
    });
  });

  it("updates the track rating immediately from the detail page", async () => {
    render(Page, {
      props: {
        data: {
          track: makeTrack(),
          libraryCoverImagePath: null,
        },
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: /set 5 star rating/i }));

    await waitFor(() => {
      expect(updateAudioTrack).toHaveBeenCalledWith("track-1", { rating: 100 });
    });
  });

  it("enters edit mode and saves organized/tag/performer changes", async () => {
    render(Page, {
      props: {
        data: {
          track: makeTrack(),
          libraryCoverImagePath: null,
        },
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: /edit track/i }));
    await screen.findByRole("button", { name: /save track changes/i });

    await fireEvent.click(screen.getByRole("button", { name: /mark as organized/i }));
    await fireEvent.click(screen.getByRole("button", { name: /save track changes/i }));

    await waitFor(() => {
      expect(updateAudioTrack).toHaveBeenCalledWith(
        "track-1",
        expect.objectContaining({
          organized: true,
          performerNames: ["Alice"],
          tagNames: ["Piano"],
        }),
      );
    });
  });
});
