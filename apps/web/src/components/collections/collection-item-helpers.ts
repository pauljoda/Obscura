import type { CollectionItemDto } from "@obscura/contracts";
import { buildHrefWithFrom } from "../../lib/back-navigation";

export function getEntityHref(item: CollectionItemDto, from?: string): string {
  let base: string;
  switch (item.entityType) {
    case "video":
      base = `/videos/${item.entityId}`;
      break;
    case "gallery":
      base = `/galleries/${item.entityId}`;
      break;
    case "image":
      base = `/images/${item.entityId}`;
      break;
    case "audio-track":
      base = `/audio/tracks/${item.entityId}`;
      break;
    default:
      return "#";
  }
  return from ? buildHrefWithFrom(base, from) : base;
}

export function getEntityTitle(item: CollectionItemDto): string {
  const entity = item.entity;
  if (!entity) return "Unknown";
  return (entity.title as string) ?? "Untitled";
}

export function getEntityThumbnail(item: CollectionItemDto): string | null {
  const entity = item.entity;
  if (!entity) return null;

  switch (item.entityType) {
    case "video":
      return (entity.cardThumbnailPath ?? entity.thumbnailPath) as
        | string
        | null;
    case "gallery":
      return entity.coverImagePath as string | null;
    case "image":
      return entity.thumbnailPath as string | null;
    case "audio-track":
      return null;
    default:
      return null;
  }
}

export function getEntityMeta(item: CollectionItemDto): string | null {
  const entity = item.entity;
  if (!entity) return null;

  switch (item.entityType) {
    case "video": {
      const duration = entity.durationFormatted as string | null;
      const resolution = entity.resolution as string | null;
      return [duration, resolution].filter(Boolean).join(" · ");
    }
    case "gallery": {
      const count = entity.imageCount as number | null;
      return count ? `${count} images` : null;
    }
    case "image": {
      const w = entity.width as number | null;
      const h = entity.height as number | null;
      return w && h ? `${w}×${h}` : null;
    }
    case "audio-track": {
      const d = entity.duration as number | null;
      if (!d) return null;
      const m = Math.floor(d / 60);
      const s = Math.floor(d % 60);
      return `${m}:${String(s).padStart(2, "0")}`;
    }
    default:
      return null;
  }
}
