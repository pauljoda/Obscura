import type { CollectionItemDto } from "@obscura/contracts";

export function getEntityHref(item: CollectionItemDto): string {
  switch (item.entityType) {
    case "scene":
      return `/scenes/${item.entityId}`;
    case "gallery":
      return `/galleries/${item.entityId}`;
    case "image":
      return `/images/${item.entityId}`;
    case "audio-track":
      return `/audio/${item.entityId}`;
    default:
      return "#";
  }
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
    case "scene":
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
    case "scene": {
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
