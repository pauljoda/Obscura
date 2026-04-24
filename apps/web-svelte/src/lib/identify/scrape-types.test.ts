import { describe, expect, it } from "vitest";

import {
  tabEntityLabel,
  tabSupportsStashBoxProvider,
  type Tab,
} from "./scrape-types";

describe("tabSupportsStashBoxProvider", () => {
  it("allows StashBox on videos, images, actors, studios, and tags only", () => {
    const visibleTabs: Tab[] = ["videos", "images", "performers", "studios", "tags"];
    const hiddenTabs: Tab[] = [
      "video-series",
      "galleries",
      "audio-libraries",
      "audio-tracks",
      "phashes",
    ];

    for (const tab of visibleTabs) {
      expect(tabSupportsStashBoxProvider(tab), tab).toBe(true);
    }

    for (const tab of hiddenTabs) {
      expect(tabSupportsStashBoxProvider(tab), tab).toBe(false);
    }
  });
});

describe("tabEntityLabel", () => {
  it("names every identify tab for empty-provider messages", () => {
    expect(tabEntityLabel("videos")).toBe("videos");
    expect(tabEntityLabel("video-series")).toBe("series");
    expect(tabEntityLabel("galleries")).toBe("galleries");
    expect(tabEntityLabel("images")).toBe("images");
    expect(tabEntityLabel("audio-libraries")).toBe("albums");
    expect(tabEntityLabel("audio-tracks")).toBe("tracks");
    expect(tabEntityLabel("performers")).toBe("actors");
    expect(tabEntityLabel("studios")).toBe("studios");
    expect(tabEntityLabel("tags")).toBe("tags");
    expect(tabEntityLabel("phashes")).toBe("pHashes");
  });
});
