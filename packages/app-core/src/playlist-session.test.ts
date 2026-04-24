import { describe, expect, it } from "vitest";
import { normalizePlaylistSessionWrite } from "./playlist-session";

const baseItem = {
  id: "item-1",
  collectionId: "collection-1",
  entityType: "video" as const,
  entityId: "video-1",
  source: "manual" as const,
  sortOrder: 0,
  addedAt: "2026-04-24T00:00:00.000Z",
  entity: { id: "video-1", title: "First" },
};

describe("normalizePlaylistSessionWrite", () => {
  it("clamps invalid order data while preserving playback settings", () => {
    const session = normalizePlaylistSessionWrite({
      collectionId: "collection-1",
      collectionName: "Weekend set",
      items: [baseItem, { ...baseItem, id: "item-2", entityId: "video-2" }],
      playOrder: [3, 1, -1, 1],
      orderPosition: 50,
      shuffle: true,
      loop: true,
      slideshowDurationSeconds: 9,
    });

    if (!session) throw new Error("Expected a normalized playlist session");
    expect(session.playOrder).toEqual([1]);
    expect(session.orderPosition).toBe(0);
    expect(session.shuffle).toBe(true);
    expect(session.loop).toBe(true);
    expect(session.slideshowDurationSeconds).toBe(9);
  });

  it("builds a sequential order and disables empty sessions when no items remain", () => {
    expect(
      normalizePlaylistSessionWrite({
        collectionId: null,
        collectionName: "Empty",
        items: [],
        playOrder: [0],
        orderPosition: 0,
        shuffle: false,
        loop: false,
        slideshowDurationSeconds: -1,
      }),
    ).toEqual(null);

    const session = normalizePlaylistSessionWrite({
      collectionId: "collection-1",
      collectionName: "Sequential",
      items: [baseItem, { ...baseItem, id: "item-2", entityId: "video-2" }],
      playOrder: [],
      orderPosition: -4,
      shuffle: false,
      loop: false,
      slideshowDurationSeconds: -1,
    });

    expect(session?.playOrder).toEqual([0, 1]);
    expect(session?.orderPosition).toBe(0);
    expect(session?.slideshowDurationSeconds).toBe(0);
  });
});
