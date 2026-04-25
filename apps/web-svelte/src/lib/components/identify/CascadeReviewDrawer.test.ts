import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  NormalizedSeriesCandidate,
  NormalizedSeriesResult,
} from "@obscura/contracts";
import type { ScrapeResult } from "$lib/api/types";
import CascadeReviewDrawer from "./CascadeReviewDrawer.svelte";

const {
  acceptVideoSeriesScrape,
  executePlugin,
  fetchAllPerformers,
  fetchScrapeResult,
  fetchTags,
  fetchVideoSeriesLibraryDetail,
} = vi.hoisted(() => ({
  acceptVideoSeriesScrape: vi.fn(),
  executePlugin: vi.fn(),
  fetchAllPerformers: vi.fn(),
  fetchScrapeResult: vi.fn(),
  fetchTags: vi.fn(),
  fetchVideoSeriesLibraryDetail: vi.fn(),
}));

vi.mock("$lib/api/scrapers", () => ({
  acceptVideoSeriesScrape,
  executePlugin,
  fetchScrapeResult,
}));

vi.mock("$lib/api/entities", () => ({
  fetchAllPerformers,
  fetchTags,
}));

vi.mock("$lib/api/videos", () => ({
  fetchVideoSeriesLibraryDetail,
}));

function seriesResult(
  title: string,
  candidates: NormalizedSeriesResult["candidates"] = [],
): NormalizedSeriesResult {
  return {
    title,
    genres: [],
    posterCandidates: [],
    backdropCandidates: [],
    logoCandidates: [],
    externalIds: {},
    seasons: [],
    candidates,
  };
}

function scrapeResult(
  id: string,
  title: string,
  candidates: NormalizedSeriesCandidate[] = [],
): ScrapeResult {
  return {
    id,
    entityType: "video_series",
    entityId: "series-1",
    scraperPackageId: null,
    stashBoxEndpointId: null,
    pluginPackageId: "plugin-1",
    action: "folderByName",
    matchType: null,
    status: "pending",
    rawResult: null,
    proposedTitle: title,
    proposedDate: null,
    proposedDetails: null,
    proposedUrl: null,
    proposedUrls: null,
    proposedStudioName: null,
    proposedPerformerNames: null,
    proposedTagNames: null,
    proposedImageUrl: null,
    proposedEpisodeNumber: null,
    proposedSeriesResult: null,
    proposedAudioResult: null,
    proposedResult: {
      kind: "series",
      series: seriesResult(title, candidates),
    },
    cascadeParentId: null,
    appliedAt: null,
    createdAt: "2026-04-25T00:00:00.000Z",
    updatedAt: "2026-04-25T00:00:00.000Z",
  };
}

describe("CascadeReviewDrawer", () => {
  beforeEach(() => {
    acceptVideoSeriesScrape.mockReset();
    executePlugin.mockReset();
    fetchAllPerformers.mockReset();
    fetchScrapeResult.mockReset();
    fetchTags.mockReset();
    fetchVideoSeriesLibraryDetail.mockReset();

    acceptVideoSeriesScrape.mockResolvedValue({
      ok: true,
      seasonsUpdated: 0,
      episodesUpdated: 0,
    });
    fetchAllPerformers.mockResolvedValue({ performers: [] });
    fetchTags.mockResolvedValue({ tags: [] });
    fetchVideoSeriesLibraryDetail.mockResolvedValue({ seasons: [] });
  });

  it("drops a picked candidate override when the drawer advances to another scrape result", async () => {
    const scrapeRows = new Map<string, ScrapeResult>([
      [
        "sr-first",
        scrapeResult("sr-first", "Ambiguous Series", [
          { externalIds: { tmdb: "101" }, title: "Picked Candidate", year: 2024 },
        ]),
      ],
      ["sr-picked", scrapeResult("sr-picked", "Picked Candidate")],
      ["sr-second", scrapeResult("sr-second", "Second Series")],
    ]);

    fetchScrapeResult.mockImplementation(async (id: string) => scrapeRows.get(id));
    executePlugin.mockResolvedValue({
      ok: true,
      result: { id: "sr-picked" },
      pluginId: "plugin-1",
      action: "folderByName",
    });

    const view = render(CascadeReviewDrawer, {
      props: {
        scrapeResultId: "sr-first",
        entityKind: "video_series",
        entityId: "series-1",
        label: "First Local Series",
        onAccepted: vi.fn(),
        onClose: vi.fn(),
      },
    });

    await screen.findByRole("heading", { name: "Ambiguous Series" });
    await fireEvent.click(screen.getByRole("button", { name: /picked candidate/i }));
    await screen.findByRole("heading", { name: "Picked Candidate" });

    await view.rerender({
      scrapeResultId: "sr-second",
      entityKind: "video_series",
      entityId: "series-2",
      label: "Second Local Series",
      onAccepted: vi.fn(),
      onClose: vi.fn(),
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Second Series" })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("heading", { name: "Picked Candidate" }),
    ).not.toBeInTheDocument();
  });
});
