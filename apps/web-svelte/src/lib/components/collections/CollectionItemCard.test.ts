import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { CollectionItemDto } from "@obscura/contracts";
import CollectionItemCard from "./CollectionItemCard.svelte";

function buildItem(overrides: Partial<CollectionItemDto> = {}): CollectionItemDto {
  return {
    id: "collection-item-1",
    collectionId: "collection-1",
    entityType: "video",
    entityId: "video-1",
    source: "manual",
    sortOrder: 0,
    addedAt: "2026-04-24T00:00:00.000Z",
    entity: {
      id: "video-1",
      title: "Tagged Video",
      thumbnailPath: "/assets/videos/video-1/thumb.jpg",
      durationFormatted: "12:34",
    },
    ...overrides,
  };
}

describe("CollectionItemCard", () => {
  it("labels manual items as direct collection entries", () => {
    render(CollectionItemCard, {
      props: { item: buildItem() },
    });

    expect(screen.getByText("Direct")).toBeInTheDocument();
  });

  it("labels dynamic items as scoped collection entries", () => {
    render(CollectionItemCard, {
      props: {
        item: buildItem({
          id: "collection-item-2",
          source: "dynamic",
        }),
      },
    });

    expect(screen.getByText("Scoped")).toBeInTheDocument();
  });
});
