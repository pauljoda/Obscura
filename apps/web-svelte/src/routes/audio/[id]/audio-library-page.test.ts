import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./+page.svelte";
import type { AudioLibraryDetailDto } from "@obscura/contracts";

const { updateAudioLibrary, updateAudioTrack, deleteAudioTrack } = vi.hoisted(() => ({
  updateAudioLibrary: vi.fn(),
  updateAudioTrack: vi.fn(),
  deleteAudioTrack: vi.fn(),
}));

const { fetchTags, fetchPerformers, fetchStudios } = vi.hoisted(() => ({
  fetchTags: vi.fn(),
  fetchPerformers: vi.fn(),
  fetchStudios: vi.fn(),
}));

vi.mock("$lib/api/media", async () => {
  const actual = await vi.importActual<typeof import("$lib/api/media")>("$lib/api/media");
  return {
    ...actual,
    updateAudioLibrary,
    updateAudioTrack,
    deleteAudioTrack,
  };
});

vi.mock("$lib/api/entities", async () => {
  const actual = await vi.importActual<typeof import("$lib/api/entities")>("$lib/api/entities");
  return {
    ...actual,
    fetchTags,
    fetchPerformers,
    fetchStudios,
  };
});

vi.mock("$lib/stores/nsfw.svelte", () => ({
  useNsfw: () => ({ mode: "show" }),
}));

vi.mock("$lib/stores/app-chrome.svelte", () => ({
  useAppChrome: () => ({ sidebarCollapsed: false }),
}));

function makeLibrary(): AudioLibraryDetailDto {
  return {
    id: "library-1",
    title: "Classical Covers",
    details: "A quiet practice set.",
    date: "2026-04-23",
    rating: 60,
    organized: true,
    isNsfw: false,
    folderPath: "/media/audio/classical-covers",
    parentId: null,
    coverImagePath: "/assets/audio-libraries/library-1/cover",
    iconPath: null,
    trackCount: 2,
    totalDuration: 318,
    studio: { id: "studio-1", name: "Night Studio", url: null },
    performers: [{ id: "performer-1", name: "Alice", gender: "female", imagePath: null }],
    tags: [{ id: "tag-1", name: "Piano", isNsfw: false }],
    tracks: [
      {
        id: "track-1",
        title: "Waltz in E Flat",
        date: "2026-04-23",
        rating: 40,
        organized: true,
        isNsfw: false,
        duration: 143,
        bitRate: 320000,
        sampleRate: 44100,
        channels: 2,
        codec: "mp3",
        fileSize: 1234,
        embeddedArtist: "Alice",
        embeddedAlbum: "Classical Covers",
        trackNumber: 1,
        waveformPath: null,
        libraryId: "library-1",
        sortOrder: 0,
        studioId: "studio-1",
        performers: [{ id: "performer-1", name: "Alice" }],
        tags: [{ id: "tag-1", name: "Piano", isNsfw: false }],
        playCount: 0,
        lastPlayedAt: null,
        createdAt: "2026-04-23T00:00:00.000Z",
      },
      {
        id: "track-2",
        title: "Wiosna",
        date: "2026-04-23",
        rating: null,
        organized: false,
        isNsfw: false,
        duration: 175,
        bitRate: 320000,
        sampleRate: 44100,
        channels: 2,
        codec: "mp3",
        fileSize: 1234,
        embeddedArtist: "Alice",
        embeddedAlbum: "Classical Covers",
        trackNumber: 2,
        waveformPath: null,
        libraryId: "library-1",
        sortOrder: 1,
        studioId: "studio-1",
        performers: [{ id: "performer-1", name: "Alice" }],
        tags: [{ id: "tag-1", name: "Piano", isNsfw: false }],
        playCount: 0,
        lastPlayedAt: null,
        createdAt: "2026-04-23T00:00:00.000Z",
      },
    ],
    trackTotal: 2,
    trackLimit: 100,
    trackOffset: 0,
    children: [],
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
}

describe("audio library detail page", () => {
  beforeEach(() => {
    updateAudioLibrary.mockReset();
    updateAudioTrack.mockReset();
    deleteAudioTrack.mockReset();
    fetchTags.mockReset();
    fetchPerformers.mockReset();
    fetchStudios.mockReset();

    updateAudioLibrary.mockResolvedValue({ ok: true });
    updateAudioTrack.mockResolvedValue({ ok: true });
    deleteAudioTrack.mockResolvedValue({ ok: true });
    fetchTags.mockResolvedValue({ tags: [{ id: "tag-1", name: "Piano", isNsfw: false }] });
    fetchPerformers.mockResolvedValue({
      performers: [{ id: "performer-1", name: "Alice", videoCount: 1 }],
      total: 1,
      limit: 500,
      offset: 0,
    });
    fetchStudios.mockResolvedValue({
      studios: [{ id: "studio-1", name: "Night Studio", videoCount: 1 }],
    });
  });

  it("shows labeled track headers and lets you edit library metadata", async () => {
    render(Page, {
      props: {
        data: {
          initialCollapsed: false,
          initialNsfwMode: "show",
          lanAutoEnable: false,
          awaitingBreakingConsent: false,
          library: makeLibrary(),
        },
      },
    });

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Rating")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /edit library/i }));

    const titleInput = await screen.findByDisplayValue("Classical Covers");
    await fireEvent.input(titleInput, {
      target: { value: "Classical Covers Deluxe" },
    });

    await fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateAudioLibrary).toHaveBeenCalledWith(
        "library-1",
        expect.objectContaining({
          title: "Classical Covers Deluxe",
          performerNames: ["Alice"],
          tagNames: ["Piano"],
        }),
      );
    });
  });

  it("updates per-track ratings and confirms track deletion", async () => {
    render(Page, {
      props: {
        data: {
          initialCollapsed: false,
          initialNsfwMode: "show",
          lanAutoEnable: false,
          awaitingBreakingConsent: false,
          library: makeLibrary(),
        },
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: /set 3 star rating/i }));

    await waitFor(() => {
      expect(updateAudioTrack).toHaveBeenCalledWith("track-1", { rating: 60 });
    });

    await fireEvent.click(screen.getByRole("button", { name: /delete waltz in e flat/i }));
    expect(screen.getByRole("dialog", { name: /delete track/i })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /remove from library/i }));

    await waitFor(() => {
      expect(deleteAudioTrack).toHaveBeenCalledWith("track-1", false);
    });
  });
});
