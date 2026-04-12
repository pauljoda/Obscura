"use client";

import Link from "next/link";
import { Film, Images, Layers, Music, Hand, Zap } from "lucide-react";
import type {
  CollectionItemDto,
  CollectionEntityType,
} from "@obscura/contracts";
import { toApiUrl } from "../../lib/api/core";

const typeIcons: Record<CollectionEntityType, typeof Film> = {
  scene: Film,
  gallery: Images,
  image: Layers,
  "audio-track": Music,
};

const typeColors: Record<CollectionEntityType, string> = {
  scene: "bg-blue-500/20 text-blue-300",
  gallery: "bg-green-500/20 text-green-300",
  image: "bg-purple-500/20 text-purple-300",
  "audio-track": "bg-amber-500/20 text-amber-300",
};

function getEntityHref(item: CollectionItemDto): string {
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

function getEntityTitle(item: CollectionItemDto): string {
  const entity = item.entity;
  if (!entity) return "Unknown";
  return (entity.title as string) ?? "Untitled";
}

function getEntityThumbnail(item: CollectionItemDto): string | null {
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
      return null; // Audio tracks don't have thumbnails in the same way
    default:
      return null;
  }
}

function getEntityMeta(item: CollectionItemDto): string | null {
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

interface CollectionItemCardProps {
  item: CollectionItemDto;
  showSource?: boolean;
}

export function CollectionItemCard({
  item,
  showSource = false,
}: CollectionItemCardProps) {
  const Icon = typeIcons[item.entityType];
  const colorClass = typeColors[item.entityType];
  const title = getEntityTitle(item);
  const thumbnailPath = getEntityThumbnail(item);
  const meta = getEntityMeta(item);
  const href = getEntityHref(item);
  const thumbnailUrl = toApiUrl(thumbnailPath);

  return (
    <Link href={href} className="block h-full">
      <div className="surface-card media-card-shell group relative h-full overflow-hidden">
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden bg-surface-2">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Icon className="h-8 w-8 text-text-disabled" />
            </div>
          )}

          {/* Type badge */}
          <div
            className={`absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 px-1 py-0.5 text-[0.6rem] font-mono uppercase ${colorClass}`}
          >
            <Icon className="h-2.5 w-2.5" />
            {item.entityType === "audio-track" ? "audio" : item.entityType}
          </div>

          {/* Source badge */}
          {showSource && (
            <div className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 px-1 py-0.5 text-[0.55rem] font-mono bg-surface-1/80 backdrop-blur-sm text-text-disabled">
              {item.source === "manual" ? (
                <Hand className="h-2 w-2" />
              ) : (
                <Zap className="h-2 w-2" />
              )}
              {item.source}
            </div>
          )}

          {/* Meta overlay */}
          {meta && (
            <div className="absolute bottom-1.5 right-1.5 px-1 py-0.5 text-[0.6rem] font-mono bg-surface-1/80 backdrop-blur-sm text-text-secondary">
              {meta}
            </div>
          )}
        </div>

        {/* Title */}
        <div className="p-2">
          <h3 className="font-heading text-[0.78rem] font-medium text-text-primary truncate leading-tight">
            {title}
          </h3>
        </div>
      </div>
    </Link>
  );
}
