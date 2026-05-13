import { describe, expect, it } from "vitest";
import { audioSurfaceConfig } from "./audio-v1";
import { booksSurfaceConfig } from "./books-v1";
import { galleriesSurfaceConfig } from "./galleries-v1";
import { imagesSurfaceConfig } from "./images-v1";
import { performersSurfaceConfig } from "./performers-v1";
import { videosSurfaceConfig } from "./videos-v1";

const baseArgs = {
  initial: { items: [], total: 0 },
  pageSize: 60,
  page: 1,
  nsfwMode: "on",
};

describe("media surface NSFW filters", () => {
  it("adds an exclusive Is NSFW / Not NSFW flag filter to every filter-bearing media surface", () => {
    const configs = [
      videosSurfaceConfig(baseArgs),
      imagesSurfaceConfig(baseArgs),
      galleriesSurfaceConfig(baseArgs),
      booksSurfaceConfig(baseArgs),
      audioSurfaceConfig(baseArgs),
      performersSurfaceConfig(baseArgs),
    ];

    for (const config of configs) {
      const nsfwSection = config.filterSections?.find((section) => section.filterType === "isNsfw");
      expect(nsfwSection?.label).toBe("Library flags");
      expect(nsfwSection?.options).toEqual([
        { value: "true", label: "Is NSFW" },
        { value: "false", label: "Not NSFW" },
      ]);
      expect(config.exclusiveFilterTypes?.has("isNsfw")).toBe(true);
    }
  });
});
