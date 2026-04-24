import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import Page from "./+page.svelte";
import type { PerformerDetailDto } from "@obscura/contracts";

vi.mock("$lib/stores/nsfw.svelte", () => ({
  useNsfw: () => ({ mode: "show" }),
}));

function makePerformer(): PerformerDetailDto {
  return {
    id: "performer-1",
    name: "Alice Actor",
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
        sourceType: "movie",
        sourceId: "movie-1",
        sourceTitle: "Midnight Feature",
        character: "Lead",
        seriesId: null,
        seriesTitle: null,
        seasonNumber: null,
        episodeNumber: null,
      },
      {
        sourceType: "series",
        sourceId: "series-1",
        sourceTitle: "Late Show",
        character: "Host",
        seriesId: "series-1",
        seriesTitle: "Late Show",
        seasonNumber: null,
        episodeNumber: null,
      },
      {
        sourceType: "episode",
        sourceId: "episode-1",
        sourceTitle: "Pilot",
        character: "Guest",
        thumbnailPath: "/assets/videos/episode-1/thumb",
        seriesId: "series-1",
        seriesTitle: "Late Show",
        seasonNumber: 1,
        episodeNumber: 1,
      },
    ],
    tags: [],
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
}

describe("performer detail page", () => {
  it("links known-for appearances with stable DTO keys", () => {
    render(Page, {
      props: {
        data: {
          initialCollapsed: false,
          initialNsfwMode: "show",
          lanAutoEnable: false,
          awaitingBreakingConsent: false,
          performer: makePerformer() as unknown as Record<string, unknown> & {
            id: string;
            name: string;
          },
          videos: [],
          totalVideos: 0,
          series: [],
          totalSeries: 0,
          galleries: [],
          totalGalleries: 0,
          images: [
            {
              id: "image-1",
              title: "Still Frame",
              thumbnailPath: "/assets/images/image-1/thumb",
              previewPath: null,
              isNsfw: false,
              width: 1200,
              height: 800,
              format: "jpg",
            },
          ],
          totalImages: 1,
          audioLibraries: [],
          totalAudioLibraries: 0,
          audioTracks: [
            {
              id: "track-1",
              title: "Theme Song",
              duration: 184,
              libraryId: "library-1",
              isNsfw: false,
            },
          ],
          totalAudioTracks: 1,
        },
      },
    });

    expect(screen.getByText("Midnight Feature").closest("a")).toHaveAttribute(
      "href",
      "/videos/movie-1",
    );
    expect(screen.getByText("Late Show").closest("a")).toHaveAttribute(
      "href",
      "/series?series=series-1",
    );
    const episodeLink = screen.getByText("Pilot").closest("a");
    expect(episodeLink).toHaveAttribute("href", "/videos/episode-1");
    expect(episodeLink?.querySelector("img")).toHaveAttribute(
      "src",
      "/api/assets/videos/episode-1/thumb",
    );
    expect(screen.getByText("Still Frame").closest("a")).toHaveAttribute(
      "href",
      "/images/image-1",
    );
    expect(screen.getByText("Theme Song").closest("a")).toHaveAttribute(
      "href",
      "/audio/tracks/track-1",
    );
  });
});
