import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as navigation from "$app/navigation";
import AddToCollectionModal from "./AddToCollectionModal.svelte";

const { fetchCollections, addCollectionItems, createCollection } = vi.hoisted(
  () => ({
    fetchCollections: vi.fn(),
    addCollectionItems: vi.fn(),
    createCollection: vi.fn(),
  }),
);

vi.mock("$lib/api/media", () => ({
  fetchCollections,
  addCollectionItems,
  createCollection,
}));

describe("AddToCollectionModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.spyOn(navigation, "invalidate").mockResolvedValue(undefined);
    fetchCollections.mockReset();
    addCollectionItems.mockReset();
    createCollection.mockReset();
  });

  it("adds the selected entity to existing collections and invalidates collection data", async () => {
    const onClose = vi.fn();

    fetchCollections.mockResolvedValue({
      items: [
        {
          id: "collection-1",
          name: "Favorites",
          mode: "manual",
          itemCount: 12,
          typeCounts: { video: 12, gallery: 0, image: 0, "audio-track": 0 },
        },
      ],
    });
    addCollectionItems.mockResolvedValue({ added: 1 });

    render(AddToCollectionModal, {
      props: {
        open: true,
        onClose,
        entityType: "video",
        entityId: "video-1",
        entityTitle: "Test Video",
      },
    });

    expect(await screen.findByText("Favorites")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /favorites/i }));
    await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(addCollectionItems).toHaveBeenCalledWith("collection-1", {
        items: [{ entityType: "video", entityId: "video-1" }],
      });
    });

    expect(navigation.invalidate).toHaveBeenCalledWith("collections");
    expect(navigation.invalidate).toHaveBeenCalledWith("collections:collection-1");

    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
