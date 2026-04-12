"use client";

import Link from "next/link";
import { Film, Images, Layers, Music, Hand, Zap, Trash2 } from "lucide-react";
import type {
  CollectionItemDto,
  CollectionEntityType,
} from "@obscura/contracts";
import { toApiUrl } from "../../lib/api/core";
import {
  getEntityHref,
  getEntityTitle,
  getEntityThumbnail,
  getEntityMeta,
} from "./collection-item-helpers";

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

interface CollectionItemCardProps {
  item: CollectionItemDto;
  /** Whether the card is in a selectable/removable context. */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (itemId: string) => void;
  onRemove?: (itemId: string) => void;
  from?: string;
}

export function CollectionItemCard({
  item,
  selectable = false,
  selected = false,
  onSelect,
  onRemove,
  from,
}: CollectionItemCardProps) {
  const Icon = typeIcons[item.entityType];
  const colorClass = typeColors[item.entityType];
  const title = getEntityTitle(item);
  const thumbnailPath = getEntityThumbnail(item);
  const meta = getEntityMeta(item);
  const href = getEntityHref(item, from);
  const thumbnailUrl = toApiUrl(thumbnailPath);
  const isManual = item.source === "manual";

  const card = (
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

        {/* Type badge — bottom left */}
        <div
          className={`absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 px-1 py-0.5 text-[0.6rem] font-mono uppercase ${colorClass}`}
        >
          <Icon className="h-2.5 w-2.5" />
          {item.entityType === "audio-track" ? "audio" : item.entityType}
        </div>

        {/* Source badge — top right, always visible */}
        <div
          className={`absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[0.6rem] font-mono uppercase tracking-wider backdrop-blur-md ${
            isManual
              ? "bg-surface-1/90 text-accent-400 border border-accent-brass/30"
              : "bg-surface-1/90 text-text-secondary border border-border-default"
          }`}
        >
          {isManual ? (
            <Hand className="h-2.5 w-2.5" />
          ) : (
            <Zap className="h-2.5 w-2.5" />
          )}
          {item.source}
        </div>

        {/* Selection checkbox indicator — shown when selectable */}
        {selectable && isManual && (
          <div
            className={`absolute top-1.5 left-1.5 h-5 w-5 flex items-center justify-center border pointer-events-none transition-colors ${
              selected
                ? "border-accent-brass/50 bg-accent-brass/30"
                : "border-border-default bg-surface-1/60"
            }`}
          >
            {selected && (
              <svg
                className="h-3 w-3 text-text-accent"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M2 6l3 3 5-5" />
              </svg>
            )}
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
  );

  if (selectable) {
    return (
      <button
        type="button"
        onClick={() => isManual && onSelect?.(item.id)}
        className={`h-full w-full text-left transition-shadow ${
          isManual ? "cursor-pointer" : "cursor-default opacity-60"
        } ${selected ? "ring-2 ring-accent-brass/40" : ""}`}
      >
        {card}
      </button>
    );
  }

  return (
    <Link href={href} className="block h-full">
      {card}
    </Link>
  );
}
