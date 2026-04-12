"use client";

import Link from "next/link";
import {
  FolderOpen,
  Film,
  Images,
  Music,
  Layers,
  Zap,
  Hand,
  Shuffle,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { CollectionListItemDto, CollectionEntityType } from "@obscura/contracts";
import { toApiUrl } from "../../lib/api/core";

interface CollectionCardProps {
  collection: CollectionListItemDto;
  variant?: "grid" | "list";
}

const modeIcons = {
  manual: Hand,
  dynamic: Zap,
  hybrid: Shuffle,
} as const;

const modeLabels = {
  manual: "Manual",
  dynamic: "Dynamic",
  hybrid: "Hybrid",
} as const;

const typeIcons: Record<CollectionEntityType, typeof Film> = {
  scene: Film,
  gallery: Images,
  image: Layers,
  "audio-track": Music,
};

export function CollectionCard({
  collection,
  variant = "grid",
}: CollectionCardProps) {
  if (variant === "list") {
    return <CollectionListCard collection={collection} />;
  }
  return <CollectionGridCard collection={collection} />;
}

function CollectionGridCard({
  collection,
}: {
  collection: CollectionListItemDto;
}) {
  const ModeIcon = modeIcons[collection.mode] ?? FolderOpen;
  const coverUrl = collection.coverImagePath
    ? toApiUrl(collection.coverImagePath)
    : null;

  const typeCounts = collection.typeCounts;
  const activeTypes = (
    Object.entries(typeCounts) as [CollectionEntityType, number][]
  ).filter(([, count]) => count > 0);

  return (
    <Link href={`/collections/${collection.id}`} className="block h-full">
      <div className="surface-card media-card-shell group relative h-full overflow-hidden">
        {/* Cover / Mosaic */}
        <div className="relative aspect-video overflow-hidden bg-surface-2">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={collection.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FolderOpen className="h-12 w-12 text-text-disabled" />
            </div>
          )}

          {/* Mode badge */}
          <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 text-[0.65rem] font-mono uppercase tracking-wider bg-surface-1/80 backdrop-blur-sm text-text-secondary">
            <ModeIcon className="h-3 w-3" />
            {modeLabels[collection.mode]}
          </div>

          {/* Item count */}
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 text-[0.65rem] font-mono bg-surface-1/80 backdrop-blur-sm text-text-secondary">
            {collection.itemCount} items
          </div>
        </div>

        {/* Info */}
        <div className="p-2.5 space-y-1.5">
          <h3 className="font-heading text-sm font-medium text-text-primary truncate leading-tight">
            {collection.name}
          </h3>

          {collection.description && (
            <p className="text-text-muted text-[0.7rem] line-clamp-2 leading-relaxed">
              {collection.description}
            </p>
          )}

          {/* Type breakdown chips */}
          {activeTypes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {activeTypes.map(([type, count]) => {
                const Icon = typeIcons[type];
                return (
                  <span
                    key={type}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[0.6rem] font-mono text-text-muted bg-surface-2"
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {count}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function CollectionListCard({
  collection,
}: {
  collection: CollectionListItemDto;
}) {
  const ModeIcon = modeIcons[collection.mode] ?? FolderOpen;
  const coverUrl = collection.coverImagePath
    ? toApiUrl(collection.coverImagePath)
    : null;

  const typeCounts = collection.typeCounts;
  const activeTypes = (
    Object.entries(typeCounts) as [CollectionEntityType, number][]
  ).filter(([, count]) => count > 0);

  return (
    <Link
      href={`/collections/${collection.id}`}
      className="flex items-center gap-3 p-2 surface-card hover:bg-surface-2 transition-colors duration-fast"
    >
      {/* Thumbnail */}
      <div className="h-12 w-20 flex-shrink-0 overflow-hidden bg-surface-2">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={collection.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FolderOpen className="h-5 w-5 text-text-disabled" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-heading text-sm font-medium text-text-primary truncate">
          {collection.name}
        </h3>
        <div className="flex items-center gap-2 text-[0.7rem] text-text-muted">
          <span className="inline-flex items-center gap-0.5">
            <ModeIcon className="h-3 w-3" />
            {modeLabels[collection.mode]}
          </span>
          <span>{collection.itemCount} items</span>
          {activeTypes.map(([type, count]) => {
            const Icon = typeIcons[type];
            return (
              <span key={type} className="inline-flex items-center gap-0.5">
                <Icon className="h-2.5 w-2.5" />
                {count}
              </span>
            );
          })}
        </div>
      </div>
    </Link>
  );
}
