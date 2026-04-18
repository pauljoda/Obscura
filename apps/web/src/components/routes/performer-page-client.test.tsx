import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NsfwProvider } from "../nsfw/nsfw-context";
import { PerformerPageClient } from "./performer-page-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/performers/test-performer",
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("../../lib/api", () => ({
  deletePerformer: vi.fn(),
  fetchAudioLibraries: vi.fn(),
  fetchGalleries: vi.fn(),
  fetchPerformerDetail: vi.fn(),
  fetchSeries: vi.fn(),
  fetchVideos: vi.fn(),
  setPerformerRating: vi.fn(),
  togglePerformerFavorite: vi.fn(),
  toApiUrl: (value: string | null | undefined) => value ?? null,
}));

vi.mock("../video-grid", () => ({
  VideoGrid: () => <div>video-grid</div>,
}));

vi.mock("../gallery-grid", () => ({
  GalleryGrid: () => <div>gallery-grid</div>,
}));

vi.mock("../audio/audio-library-appearance-grid", () => ({
  AudioLibraryAppearanceGrid: () => <div>audio-grid</div>,
}));

vi.mock("../performer-edit", () => ({
  PerformerEdit: () => <div>performer-edit</div>,
}));

vi.mock("../series/series-card", () => ({
  SeriesCard: ({ series }: { series: { displayTitle: string } }) => (
    <div>{series.displayTitle}</div>
  ),
}));

vi.mock("../stash-id-chips", () => ({
  StashIdChips: () => <div>stash-ids</div>,
}));

vi.mock("../shared/back-link", () => ({
  BackLink: ({ label }: { label: string }) => <div>{label}</div>,
}));

describe("PerformerPageClient", () => {
  it("renders Known For role rows with source labels and episode context", () => {
    render(
      <NsfwProvider initialMode="show">
        <PerformerPageClient
          id="test-performer"
          initialPerformer={{
            id: "test-performer",
            name: "Rin North",
            disambiguation: null,
            aliases: null,
            gender: null,
            birthdate: null,
            country: null,
            ethnicity: null,
            eyeColor: null,
            hairColor: null,
            height: null,
            weight: null,
            measurements: null,
            tattoos: null,
            piercings: null,
            careerStart: null,
            careerEnd: null,
            details: null,
            imageUrl: null,
            imagePath: null,
            favorite: false,
            rating: null,
            isNsfw: false,
            videoCount: 2,
            knownFor: [
              {
                sourceType: "series",
                sourceId: "series-1",
                sourceTitle: "Signal Station",
                character: "Commander Sol",
                seriesId: "series-1",
                seriesTitle: "Signal Station",
                seasonNumber: null,
                episodeNumber: null,
              },
              {
                sourceType: "episode",
                sourceId: "episode-7",
                sourceTitle: "The Double",
                character: "Shade Copy",
                seriesId: "series-1",
                seriesTitle: "Signal Station",
                seasonNumber: 1,
                episodeNumber: 7,
              },
            ],
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          initialVideos={[]}
          initialTotalVideos={0}
          initialSeries={[]}
          initialTotalSeries={0}
          initialGalleries={[]}
          initialTotalGalleries={0}
          initialAudioLibraries={[]}
          initialTotalAudioLibraries={0}
        />
      </NsfwProvider>,
    );

    expect(screen.getByText("Known For")).toBeInTheDocument();
    expect(screen.getByText("Commander Sol")).toBeInTheDocument();
    expect(screen.getByText("Signal Station")).toBeInTheDocument();
    expect(screen.getByText("Shade Copy")).toBeInTheDocument();
    expect(screen.getByText("Signal Station · S01E07")).toBeInTheDocument();
    expect(screen.getByText("The Double")).toBeInTheDocument();
    expect(screen.getByText("Episode")).toBeInTheDocument();
  });
});
