import { describe, expect, it } from "vitest";
import { audioSurfaceConfig } from "./audio";
import { booksSurfaceConfig } from "./books";
import { galleriesSurfaceConfig } from "./galleries";
import { imagesSurfaceConfig } from "./images";
import { performersSurfaceConfig } from "./performers";
import { videosSurfaceConfig } from "./videos";

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
