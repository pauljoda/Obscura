import type { EntityCapability, EntityCard } from "$lib/api/generated/model";

/** Standard thumbnail shapes used by global entity cards before route-specific layout chooses a size. */
export type EntityThumbnailAspectRatio =
  | "square"
  | "video"
  | "poster"
  | "portrait"
  | "wide"
  | {
      width: number;
      height: number;
    };

/** Renderable image asset for covers, trickplay frames, and gallery/book preview frames. */
export interface EntityThumbnailAsset {
  src: string;
  alt: string;
  role?: string;
}

/** Hover preview behavior supported by the shared thumbnail surface. */
export type EntityThumbnailHoverPreview =
  | {
      kind: "none";
    }
  | {
      kind: "trickplay" | "image-sequence";
      assets: EntityThumbnailAsset[];
    };

/** Icon vocabulary for compact thumbnail metadata chips. */
export type EntityThumbnailMetaIcon =
  | "audio"
  | "book"
  | "calendar"
  | "chapter"
  | "collection"
  | "count"
  | "duration"
  | "gallery"
  | "image"
  | "person"
  | "studio"
  | "tag"
  | "video";

/** Small count, duration, position, or classification item shown under a thumbnail. */
export interface EntityThumbnailMetaItem {
  icon: EntityThumbnailMetaIcon;
  label: string;
}

/** Entity-specific thumbnail overlay content owned by route/entity mappers. */
export interface EntityThumbnailCustomOverlay {
  bottomLeft?: {
    label: string;
    title?: string;
  };
}

/** Entity payload consumed by the shared thumbnail surface. */
export interface EntityThumbnailEntity extends EntityCard {
  capabilities: EntityCapability[];
}

/** Complete view model for one global entity thumbnail. */
export interface EntityThumbnailCard {
  entity: EntityThumbnailEntity;
  aspectRatio: EntityThumbnailAspectRatio;
  cover: EntityThumbnailAsset | null;
  custom?: EntityThumbnailCustomOverlay;
  fit?: "contain" | "cover";
  hover: EntityThumbnailHoverPreview;
  href?: string;
  meta?: EntityThumbnailMetaItem[];
}

/** Converts a named or numeric entity aspect ratio into a CSS aspect-ratio value. */
export function toAspectRatioValue(ratio: EntityThumbnailAspectRatio): string {
  if (typeof ratio === "string") {
    switch (ratio) {
      case "poster":
        return "2 / 3";
      case "portrait":
        return "3 / 4";
      case "square":
        return "1 / 1";
      case "wide":
        return "21 / 9";
      case "video":
      default:
        return "16 / 9";
    }
  }

  if (!Number.isFinite(ratio.width) || !Number.isFinite(ratio.height) || ratio.width <= 0 || ratio.height <= 0) {
    return "16 / 9";
  }

  return `${ratio.width} / ${ratio.height}`;
}

/** Returns whether a card has enough preview assets to respond to hover or focus. */
export function hasHoverPreview(card: EntityThumbnailCard): boolean {
  return card.hover.kind !== "none" && card.hover.assets.length > 0;
}

/** Selects the hover frame nearest the current pointer position across the thumbnail. */
export function pickHoverAsset(card: EntityThumbnailCard, pointerRatio: number): EntityThumbnailAsset | null {
  if (card.hover.kind === "none" || card.hover.assets.length === 0) return null;
  const boundedRatio = Math.min(Math.max(pointerRatio, 0), 1);
  const index = Math.min(card.hover.assets.length - 1, Math.floor(boundedRatio * card.hover.assets.length));
  return card.hover.assets[index] ?? null;
}

/** Resolves the currently visible asset, preferring hover previews when active. */
export function getThumbnailAsset(card: EntityThumbnailCard, pointerRatio: number | null): EntityThumbnailAsset | null {
  if (pointerRatio !== null) {
    const hoverAsset = pickHoverAsset(card, pointerRatio);
    if (hoverAsset) return hoverAsset;
  }

  return card.cover;
}
