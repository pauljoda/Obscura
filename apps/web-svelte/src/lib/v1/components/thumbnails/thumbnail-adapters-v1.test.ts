import { describe, expect, it } from "vitest";
import type { CollectionItemDto, SearchResultItem } from "@obscura/contracts";
import {
  collectionItemToThumbnailProps,
  searchResultToThumbnailProps,
} from "./thumbnail-adapters-v1";

describe("thumbnail adapters", () => {
  it("maps comic gallery search results to gallery thumbnail props", () => {
    const item: SearchResultItem = {
      id: "gallery-1",
      kind: "gallery",
      title: "Comic Chapter 01",
      subtitle: "24 images",
      imagePath: "/assets/galleries/gallery-1/cover",
      href: "/galleries/gallery-1",
      rating: 80,
      score: 90,
      meta: {
        imageCount: 24,
        isNsfw: true,
        isComic: true,
        coverAspectRatio: 0.67,
        previewImagePaths: [
          "/assets/images/page-1/thumb",
          "/assets/images/page-2/thumb",
        ],
      },
    };

    expect(searchResultToThumbnailProps(item, 3)).toMatchObject({
      kind: "gallery",
      title: "Comic Chapter 01",
      coverImagePath: "/assets/galleries/gallery-1/cover",
      previewImagePaths: ["/assets/images/page-1/thumb", "/assets/images/page-2/thumb"],
      imageCount: 24,
      isNsfw: true,
      isComic: true,
      aspectRatio: null,
      fit: "contain",
      gradientIndex: 3,
      rating: 80,
    });
  });

  it("maps rated search result entities to thumbnail rating props", () => {
    const item: SearchResultItem = {
      id: "book-1",
      kind: "book",
      title: "Rated Book",
      subtitle: "20 pages",
      imagePath: "/assets/books/book-1/cover",
      href: "/books/book-1",
      rating: 60,
      score: 90,
      meta: {
        pageCount: 20,
        isNsfw: false,
        previewImagePaths: ["/assets/book-pages/page-1/thumb"],
      },
    };

    expect(searchResultToThumbnailProps(item)).toMatchObject({
      kind: "book",
      title: "Rated Book",
      coverImagePath: "/assets/books/book-1/cover",
      rating: 60,
    });
  });

  it("maps video collection items through video thumbnail data", () => {
    const item: CollectionItemDto = {
      id: "item-1",
      collectionId: "collection-1",
      entityType: "video",
      entityId: "video-1",
      source: "manual",
      sortOrder: 0,
      addedAt: "2026-05-10T00:00:00.000Z",
      entity: {
        id: "video-1",
        title: "Episode One",
        thumbnailPath: "/assets/videos/video-1/thumb",
        cardThumbnailPath: "/assets/videos/video-1/card",
        durationFormatted: "21:00",
        isNsfw: false,
      },
    };

    const props = collectionItemToThumbnailProps(item, "Episode One");

    expect(props.kind).toBe("video");
    if (props.kind !== "video") throw new Error("expected video props");
    expect(props.video).toMatchObject({
      id: "video-1",
      title: "Episode One",
      thumbnail: "/api/assets/videos/video-1/thumb",
      cardThumbnail: "/api/assets/videos/video-1/card",
      duration: "21:00",
      isNsfw: false,
    });
  });

  it("maps parent comic gallery collection items with central gallery behavior", () => {
    const item: CollectionItemDto = {
      id: "item-2",
      collectionId: "collection-1",
      entityType: "gallery",
      entityId: "gallery-2",
      source: "dynamic",
      sortOrder: 1,
      addedAt: "2026-05-10T00:00:00.000Z",
      entity: {
        id: "gallery-2",
        title: "Comic Series",
        coverImagePath: "/assets/galleries/gallery-2/cover",
        previewImagePaths: ["/assets/images/page-3/thumb"],
        imageCount: 0,
        isNsfw: false,
        isComic: true,
        coverAspectRatio: 0.67,
      },
    };

    expect(collectionItemToThumbnailProps(item, "Comic Series")).toMatchObject({
      kind: "gallery",
      title: "Comic Series",
      isComic: true,
      fit: "contain",
      showCount: false,
    });
  });
});
