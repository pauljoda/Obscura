import { describe, expect, it } from "vitest";
import { detailTabsFor } from "./detail-tabs";

describe("detailTabsFor", () => {
  it("omits tabs whose detail count is zero", () => {
    const tabs = detailTabsFor({
      entityKind: "performer",
      entityId: "actor-1",
      entityName: "Actor One",
      nsfwMode: "show",
      totals: {
        videos: 3,
        series: 0,
        galleries: 1,
        images: 0,
        "audio-libraries": 0,
        "audio-tracks": 2,
      },
    });

    expect(tabs.map((tab) => tab.id)).toEqual([
      "videos",
      "galleries",
      "audio-tracks",
    ]);
  });

  it("keeps legacy visibility when no counts are supplied", () => {
    const tabs = detailTabsFor({
      entityKind: "studio",
      entityId: "studio-1",
      entityName: "Studio One",
      nsfwMode: "show",
    });

    expect(tabs.map((tab) => tab.id)).toEqual([
      "videos",
      "series",
      "galleries",
      "images",
      "audio-libraries",
      "audio-tracks",
    ]);
  });
});
