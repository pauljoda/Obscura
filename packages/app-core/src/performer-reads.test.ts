import { describe, expect, it } from "vitest";
import {
  buildPerformerKnownForEntries,
  type PerformerKnownForEpisodeRow,
  type PerformerKnownForMovieRow,
  type PerformerKnownForSeriesRow,
} from "./performer-reads";

const baseSeriesRows: PerformerKnownForSeriesRow[] = [];
const baseMovieRows: PerformerKnownForMovieRow[] = [];

function episodeRow(
  overrides: Partial<PerformerKnownForEpisodeRow>,
): PerformerKnownForEpisodeRow {
  return {
    sourceId: "episode-1",
    title: "Pilot",
    thumbnailPath: "/episodes/episode-1/thumb.jpg",
    cardThumbnailPath: "/episodes/episode-1/card.jpg",
    character: "Brenda",
    seasonNumber: 1,
    episodeNumber: 1,
    isNsfw: false,
    seriesId: "series-1",
    seriesTitle: "The Chair Company",
    seriesCustomName: null,
    seriesThumbnailPath: "/series/series-1/poster.jpg",
    seriesIsNsfw: false,
    seriesCharacter: null,
    ...overrides,
  };
}

describe("buildPerformerKnownForEntries", () => {
  it("collapses repeated episode-only roles into one series card", () => {
    const entries = buildPerformerKnownForEntries({
      seriesRows: baseSeriesRows,
      movieRows: baseMovieRows,
      episodeRows: [
        episodeRow({ sourceId: "episode-1", title: "I won. Zoom in." }),
        episodeRow({
          sourceId: "episode-2",
          title: "Minnie Mouse coming back was...",
          episodeNumber: 2,
        }),
      ],
      sfwOnly: false,
    });

    expect(entries).toEqual([
      {
        sourceType: "series",
        sourceId: "series-1",
        sourceTitle: "The Chair Company",
        character: "Brenda",
        thumbnailPath: "/series/series-1/poster.jpg",
        cardThumbnailPath: null,
        seriesId: "series-1",
        seriesTitle: "The Chair Company",
        seasonNumber: null,
        episodeNumber: null,
      },
    ]);
  });

  it("keeps one-off episode roles as episode cards", () => {
    const entries = buildPerformerKnownForEntries({
      seriesRows: baseSeriesRows,
      movieRows: baseMovieRows,
      episodeRows: [
        episodeRow({ sourceId: "episode-1", character: "Brenda" }),
        episodeRow({
          sourceId: "episode-2",
          character: "Guest Host",
          episodeNumber: 2,
        }),
      ],
      sfwOnly: false,
    });

    expect(entries).toEqual([
      {
        sourceType: "episode",
        sourceId: "episode-1",
        sourceTitle: "Pilot",
        character: "Brenda",
        thumbnailPath: "/episodes/episode-1/thumb.jpg",
        cardThumbnailPath: "/episodes/episode-1/card.jpg",
        seriesId: "series-1",
        seriesTitle: "The Chair Company",
        seasonNumber: 1,
        episodeNumber: 1,
      },
      {
        sourceType: "episode",
        sourceId: "episode-2",
        sourceTitle: "Pilot",
        character: "Guest Host",
        thumbnailPath: "/episodes/episode-1/thumb.jpg",
        cardThumbnailPath: "/episodes/episode-1/card.jpg",
        seriesId: "series-1",
        seriesTitle: "The Chair Company",
        seasonNumber: 1,
        episodeNumber: 2,
      },
    ]);
  });

  it("lets explicit series roles cover matching episode roles", () => {
    const entries = buildPerformerKnownForEntries({
      seriesRows: [
        {
          sourceId: "series-1",
          title: "The Chair Company",
          customName: null,
          thumbnailPath: "/series/series-1/poster.jpg",
          character: "Brenda",
          isNsfw: false,
        },
      ],
      movieRows: baseMovieRows,
      episodeRows: [
        episodeRow({
          sourceId: "episode-1",
          character: "Brenda",
          seriesCharacter: "Brenda",
        }),
        episodeRow({
          sourceId: "episode-2",
          character: "Brenda",
          episodeNumber: 2,
          seriesCharacter: "Brenda",
        }),
      ],
      sfwOnly: false,
    });

    expect(entries).toEqual([
      {
        sourceType: "series",
        sourceId: "series-1",
        sourceTitle: "The Chair Company",
        character: "Brenda",
        thumbnailPath: "/series/series-1/poster.jpg",
        cardThumbnailPath: null,
        seriesId: "series-1",
        seriesTitle: "The Chair Company",
        seasonNumber: null,
        episodeNumber: null,
      },
    ]);
  });
});
