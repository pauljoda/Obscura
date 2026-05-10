import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ChildGalleryGrid from "./ChildGalleryGrid.svelte";

vi.mock("$lib/nsfw/store.svelte", () => ({
  useNsfw: () => ({ mode: "show" }),
}));

const children = [
  {
    id: "gallery-child-1",
    title: "Chapter One",
    coverImagePath: null,
    previewImagePaths: [],
    imageCount: 12,
    childCount: 0,
    isNsfw: false,
    isComic: true,
    coverAspectRatio: null,
  },
  {
    id: "gallery-child-2",
    title: "Chapter Two",
    coverImagePath: null,
    previewImagePaths: [],
    imageCount: 8,
    childCount: 1,
    isNsfw: false,
    isComic: true,
    coverAspectRatio: null,
  },
];

describe("ChildGalleryGrid", () => {
  it("exposes a thumbnail size slider and applies the selected column count", async () => {
    const onColsChange = vi.fn();
    const { container } = render(ChildGalleryGrid, {
      props: {
        galleries: children,
        cols: 4,
        onColsChange,
      },
    });

    const grid = container.querySelector(".sub-gallery-grid") as HTMLElement | null;
    expect(grid?.style.getPropertyValue("--sub-gallery-cols")).toBe("4");
    expect(screen.getByText("Chapter One")).toBeInTheDocument();

    await fireEvent.input(screen.getByLabelText("Sub-gallery size"), {
      target: { value: "6" },
    });

    expect(onColsChange).toHaveBeenCalledWith(6);
  });
});
