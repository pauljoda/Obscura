import type { VideoCardData } from "$lib/video-card-data";

export type EntityThumbnailKind =
  | "video"
  | "video-series"
  | "gallery"
  | "book"
  | "image"
  | "performer"
  | "studio"
  | "tag"
  | "collection"
  | "audio-library"
  | "audio-track";

export type EntityThumbnailSize = "grid" | "list" | "compact" | "hero";

export interface EntityThumbnailCommon {
  size?: EntityThumbnailSize;
  aspectClass?: string;
  aspectRatio?: number | null;
  loading?: "eager" | "lazy";
  class?: string;
  showChips?: boolean;
  showCount?: boolean;
  showPlayOverlay?: boolean;
  fit?: "cover" | "contain";
  gradientFallback?: string;
  gradientIndex?: number;
  compact?: boolean;
  showLabel?: boolean;
  muted?: boolean;
  cacheBust?: string | null;
}

export type EntityThumbnailProps =
  | ({
      kind: "video";
      video: VideoCardData;
      imageLoading?: "eager" | "lazy";
    } & EntityThumbnailCommon)
  | ({
      kind: "video-series";
      title: string;
      coverImagePath?: string | null;
      previewThumbnailPaths?: string[] | null;
      updatedAt?: string | null;
      isNsfw?: boolean | null;
      videoCount?: number | null;
    } & EntityThumbnailCommon)
  | ({
      kind: "gallery";
      title: string;
      coverImagePath?: string | null;
      previewImagePaths?: string[] | null;
      imageCount?: number | null;
      isNsfw?: boolean | null;
      isComic?: boolean | null;
      updatedAt?: string | null;
      stacked?: boolean;
    } & EntityThumbnailCommon)
  | ({
      kind: "book";
      title: string;
      coverImagePath?: string | null;
      pageCount?: number | null;
      isNsfw?: boolean | null;
      updatedAt?: string | null;
    } & EntityThumbnailCommon)
  | ({
      kind: "image";
      title?: string;
      thumbnailPath?: string | null;
      previewPath?: string | null;
      isNsfw?: boolean | null;
      isVideo?: boolean | null;
      width?: number | null;
      height?: number | null;
      updatedAt?: string | null;
    } & EntityThumbnailCommon)
  | ({
      kind: "performer";
      performer: {
        name: string;
        imagePath?: string | null;
        favorite?: boolean | null;
        isNsfw?: boolean | null;
        videoCount?: number | null;
        seriesCount?: number | null;
        galleryCount?: number | null;
        imageCount?: number | null;
        imageAppearanceCount?: number | null;
        audioLibraryCount?: number | null;
        audioTrackCount?: number | null;
      };
    } & EntityThumbnailCommon)
  | ({
      kind: "studio";
      studio: {
        name: string;
        imagePath?: string | null;
        imageUrl?: string | null;
        favorite?: boolean | null;
        isNsfw?: boolean | null;
        videoCount?: number | null;
        imageAppearanceCount?: number | null;
        audioLibraryCount?: number | null;
      };
    } & EntityThumbnailCommon)
  | ({
      kind: "tag";
      tag: {
        name: string;
        imagePath?: string | null;
        favorite?: boolean | null;
        isNsfw?: boolean | null;
        videoCount?: number | null;
        imageCount?: number | null;
        galleryCount?: number | null;
        audioTrackCount?: number | null;
      };
    } & EntityThumbnailCommon)
  | ({
      kind: "collection";
      collection: {
        name: string;
        coverImagePath?: string | null;
        updatedAt?: string | null;
        itemCount?: number | null;
        isNsfw?: boolean | null;
      };
    } & EntityThumbnailCommon)
  | ({
      kind: "audio-library";
      library: {
        id?: string | null;
        title: string;
        coverImagePath?: string | null;
        iconPath?: string | null;
        isNsfw?: boolean | null;
        trackCount?: number | null;
      };
    } & EntityThumbnailCommon)
  | ({
      kind: "audio-track";
      track: {
        id?: string | null;
        title: string;
        coverImagePath?: string | null;
        libraryCoverImagePath?: string | null;
        trackNumber?: number | null;
        isNsfw?: boolean | null;
      };
    } & EntityThumbnailCommon);
