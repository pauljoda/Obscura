import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDb } from "@obscura/db";

const {
  setBookChapterCoverFromUrlWrite,
  setBookCoverFromUrlWrite,
  setBookVolumeCoverFromUrlWrite,
  setGalleryCoverFromUrlWrite,
  setVideoSeriesCoverFromUrlWrite,
  updateAudioLibraryWrite,
  updateAudioTrackWrite,
  updateBookWrite,
  updateGalleryWrite,
  updateImageWrite,
  updateVideoSeriesWrite,
} = vi.hoisted(() => ({
  setBookChapterCoverFromUrlWrite: vi.fn(),
  setBookCoverFromUrlWrite: vi.fn(),
  setBookVolumeCoverFromUrlWrite: vi.fn(),
  setGalleryCoverFromUrlWrite: vi.fn(),
  setVideoSeriesCoverFromUrlWrite: vi.fn(),
  updateAudioLibraryWrite: vi.fn(),
  updateAudioTrackWrite: vi.fn(),
  updateBookWrite: vi.fn(),
  updateGalleryWrite: vi.fn(),
  updateImageWrite: vi.fn(),
  updateVideoSeriesWrite: vi.fn(),
}));

vi.mock("./audio-libraries", () => ({
  updateAudioLibraryWrite,
}));

vi.mock("./audio-tracks", () => ({
  updateAudioTrackWrite,
}));

vi.mock("./books", () => ({
  setBookChapterCoverFromUrlWrite,
  setBookCoverFromUrlWrite,
  setBookVolumeCoverFromUrlWrite,
  updateBookWrite,
}));

vi.mock("./gallery-media", () => ({
  setGalleryCoverFromUrlWrite,
  updateGalleryWrite,
  updateImageWrite,
}));

vi.mock("./video-series", () => ({
  setVideoSeriesCoverFromUrlWrite,
  updateVideoSeriesWrite,
}));

function createAcceptDb(result: Record<string, unknown>) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [result]),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  } as unknown as AppDb;
}

function scrapeResult(entityType: string, entityId = `${entityType}-1`) {
  return {
    id: "result-1",
    entityType,
    entityId,
    appliedAt: null,
    rawResult: {},
    proposedResult: null,
    proposedTitle: null,
    proposedDate: null,
    proposedDetails: null,
    proposedUrls: null,
    proposedStudioName: null,
    proposedPerformerNames: null,
    proposedTagNames: null,
    proposedImageUrl: null,
  };
}

describe("acceptPluginResultWrite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks accepted video-series plugin results organized even when no metadata fields change", async () => {
    const { acceptPluginResultWrite } = await import("./plugin-execution");
    const db = createAcceptDb(scrapeResult("video_series", "series-1"));

    await acceptPluginResultWrite(db, {
      scrapeResultId: "result-1",
      fields: ["image"],
    });

    expect(updateVideoSeriesWrite).toHaveBeenCalledWith(
      db,
      "series-1",
      expect.objectContaining({ organized: true }),
    );
  });

  it.each([
    ["audio_library", updateAudioLibraryWrite],
    ["audio_track", updateAudioTrackWrite],
    ["gallery", updateGalleryWrite],
    ["book", updateBookWrite],
    ["image", updateImageWrite],
  ])(
    "marks accepted %s plugin results organized even when no metadata fields change",
    async (entityType, updateFn) => {
      const { acceptPluginResultWrite } = await import("./plugin-execution");
      const db = createAcceptDb(scrapeResult(entityType));

      await acceptPluginResultWrite(db, {
        scrapeResultId: "result-1",
        fields: ["image"],
      });

      expect(updateFn).toHaveBeenCalledWith(
        db,
        `${entityType}-1`,
        expect.objectContaining({ organized: true }),
      );
    },
  );
});
