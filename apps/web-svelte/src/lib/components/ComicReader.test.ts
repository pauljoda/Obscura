import { fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ComicReader from "./ComicReader.svelte";
import type { ImageListItemDto } from "@obscura/contracts";

vi.mock("$lib/nsfw/store.svelte", () => ({
  useNsfw: () => ({ mode: "show" }),
}));

function makeImages(count: number): ImageListItemDto[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `image-${index + 1}`,
    title: `Page ${index + 1}`,
    date: null,
    rating: null,
    organized: false,
    isNsfw: false,
    width: 800,
    height: 1200,
    format: "jpg",
    isVideo: false,
    fileSize: 100,
    thumbnailPath: `/assets/images/image-${index + 1}/thumb`,
    previewPath: null,
    fullPath: `/assets/images/image-${index + 1}/full`,
    galleryId: "gallery-1",
    sortOrder: index,
    studioId: null,
    performers: [],
    tags: [],
    createdAt: "2026-05-08T00:00:00.000Z",
  }));
}

const images = makeImages(3);

describe("ComicReader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.head
      .querySelectorAll('link[rel="preload"][as="image"]')
      .forEach((link) => link.remove());
  });

  it("keeps controls hidden while navigating with side taps", async () => {
    const { container } = render(ComicReader, {
      props: {
        images,
        initialIndex: 0,
        title: "Comic",
        onClose: vi.fn(),
      },
    });

    const topLayer = container.querySelector(".reader-top-layer");
    const stage = container.querySelector(".reader-stage");
    expect(topLayer).not.toBeNull();
    expect(stage).not.toBeNull();

    await tick();
    vi.advanceTimersByTime(2_800);
    await tick();
    expect(topLayer?.classList.contains("reader-layer-hidden")).toBe(true);

    vi.spyOn(stage!, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 300,
    } as DOMRect);

    await fireEvent(
      stage!,
      new MouseEvent("pointerup", {
        bubbles: true,
        clientX: 290,
      }),
    );

    expect(topLayer?.classList.contains("reader-layer-hidden")).toBe(true);
  });

  it("shows hidden controls when clicking the center with a mouse", async () => {
    const { container } = render(ComicReader, {
      props: {
        images,
        initialIndex: 0,
        title: "Comic",
        onClose: vi.fn(),
      },
    });

    const topLayer = container.querySelector(".reader-top-layer");
    const stage = container.querySelector(".reader-stage");
    expect(topLayer).not.toBeNull();
    expect(stage).not.toBeNull();

    await tick();
    vi.advanceTimersByTime(2_800);
    await tick();
    expect(topLayer?.classList.contains("reader-layer-hidden")).toBe(true);

    vi.spyOn(stage!, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 300,
    } as DOMRect);

    const event = new MouseEvent("pointerup", {
      bubbles: true,
      clientX: 150,
    });
    Object.defineProperty(event, "pointerType", { value: "mouse" });
    await fireEvent(stage!, event);

    expect(topLayer?.classList.contains("reader-layer-visible")).toBe(true);
  });

  it("shows hidden controls when hovering over the top or bottom control edges", async () => {
    const { container } = render(ComicReader, {
      props: {
        images,
        initialIndex: 0,
        title: "Comic",
        onClose: vi.fn(),
      },
    });

    const topLayer = container.querySelector(".reader-top-layer");
    const topHoverZone = container.querySelector('[data-reader-hover-zone="top"]');
    const bottomHoverZone = container.querySelector('[data-reader-hover-zone="bottom"]');
    expect(topLayer).not.toBeNull();
    expect(topHoverZone).not.toBeNull();
    expect(bottomHoverZone).not.toBeNull();

    await tick();
    vi.advanceTimersByTime(2_800);
    await tick();
    expect(topLayer?.classList.contains("reader-layer-hidden")).toBe(true);

    await fireEvent.pointerEnter(topHoverZone!);
    expect(topLayer?.classList.contains("reader-layer-visible")).toBe(true);

    vi.advanceTimersByTime(2_800);
    await tick();
    expect(topLayer?.classList.contains("reader-layer-hidden")).toBe(true);

    await fireEvent.pointerEnter(bottomHoverZone!);
    expect(topLayer?.classList.contains("reader-layer-visible")).toBe(true);
  });

  it("reports page changes so callers can persist reading progress", async () => {
    const onIndexChange = vi.fn();
    const { getByLabelText } = render(ComicReader, {
      props: {
        images,
        initialIndex: 0,
        title: "Comic",
        onClose: vi.fn(),
        onIndexChange: onIndexChange as never,
      },
    });

    await fireEvent.click(getByLabelText("Next page"));

    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it("preloads nearby paged images in the document head", async () => {
    render(ComicReader, {
      props: {
        images: makeImages(6),
        initialIndex: 2,
        title: "Comic",
        onClose: vi.fn(),
      },
    });

    await tick();

    const hrefs = Array.from(
      document.head.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"]'),
    ).map((link) => link.getAttribute("href"));

    expect(hrefs).toEqual([
      "/api/assets/images/image-1/full",
      "/api/assets/images/image-2/full",
      "/api/assets/images/image-4/full",
      "/api/assets/images/image-5/full",
    ]);
  });

  it("reports the nearest page while scrolling in webtoon mode", async () => {
    const onIndexChange = vi.fn();
    const { container, getByLabelText } = render(ComicReader, {
      props: {
        images,
        initialIndex: 0,
        title: "Comic",
        onClose: vi.fn(),
        onIndexChange: onIndexChange as never,
      },
    });

    await fireEvent.click(getByLabelText("Webtoon reader"));
    const stage = container.querySelector(".reader-stage") as HTMLElement;
    const pages = Array.from(container.querySelectorAll("[data-comic-page-index]")) as HTMLElement[];
    expect(pages).toHaveLength(3);
    Object.defineProperty(stage, "scrollTop", { value: 1_300, configurable: true });
    Object.defineProperty(stage, "clientHeight", { value: 800, configurable: true });
    pages.forEach((page, index) => {
      Object.defineProperty(page, "offsetTop", { value: index * 1_200, configurable: true });
    });

    await fireEvent.scroll(stage);

    expect(onIndexChange).toHaveBeenCalledWith(1);
  });
});
