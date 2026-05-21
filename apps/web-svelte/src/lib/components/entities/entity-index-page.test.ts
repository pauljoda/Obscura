import { beforeEach, describe, expect, it, vi } from "vitest";
import type { V2EntityCard } from "$lib/api/v2";
import { EntityIndexPageState } from "./entity-index-page.svelte";

const fetchV2Entities = vi.fn();

vi.mock("$lib/api/v2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("$lib/api/v2")>();
  return {
    ...actual,
    fetchV2Entities: (...args: unknown[]) => fetchV2Entities(...args),
  };
});

describe("EntityIndexPageState", () => {
  beforeEach(() => {
    fetchV2Entities.mockReset();
  });

  it("loads initial and cursor pages into thumbnail cards with browse links", async () => {
    fetchV2Entities
      .mockResolvedValueOnce({
        items: [entity("video-1", "video", "First Video")],
        nextCursor: "next-page",
      })
      .mockResolvedValueOnce({
        items: [entity("video-2", "video", "Second Video")],
        nextCursor: null,
      });

    const state = new EntityIndexPageState({
      getKind: () => "video",
      getHideNsfw: () => true,
    });

    await state.loadInitial();

    expect(fetchV2Entities).toHaveBeenCalledWith({ kind: "video", hideNsfw: true, limit: 250 });
    expect(state.loadState).toBe("ready");
    expect(state.cards.map((card) => card.href)).toEqual(["/videos/video-1"]);
    expect(state.nextCursor).toBe("next-page");

    await state.loadMore();

    expect(fetchV2Entities).toHaveBeenLastCalledWith({
      kind: "video",
      cursor: "next-page",
      hideNsfw: true,
      limit: 250,
    });
    expect(state.cards.map((card) => card.entity.title)).toEqual(["First Video", "Second Video"]);
    expect(state.nextCursor).toBeNull();
  });

  it("reloads the first server page when the grid page size changes", async () => {
    fetchV2Entities
      .mockResolvedValueOnce({
        items: [entity("video-1", "video", "First Video")],
        nextCursor: "next-page",
      })
      .mockResolvedValueOnce({
        items: [entity("video-2", "video", "Second Video")],
        nextCursor: null,
      });

    const state = new EntityIndexPageState({
      getKind: () => "video",
      getHideNsfw: () => false,
    });

    await state.loadInitial();
    state.setPageSize(500);
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchV2Entities).toHaveBeenCalledTimes(2);
    expect(fetchV2Entities).toHaveBeenLastCalledWith({ kind: "video", hideNsfw: false, limit: 500 });
    expect(state.cards.map((card) => card.entity.title)).toEqual(["Second Video"]);
  });
});

function entity(id: string, kind: string, title: string): V2EntityCard {
  return {
    id,
    kind,
    title,
    parentEntityId: null,
    sortOrder: null,
    coverUrl: null,
    hoverKind: "none",
    hoverUrl: null,
    meta: [],
    rating: null,
    isFavorite: false,
    isNsfw: false,
    isOrganized: false,
  };
}
