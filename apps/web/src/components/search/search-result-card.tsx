"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { SearchResultItem } from "@obscura/contracts";
import { toApiUrl } from "../../lib/api";
import { searchGalleryItemToCardData } from "../galleries/gallery-card-data";
import { GalleryEntityCard } from "../galleries/gallery-entity-card";
import { searchImageItemToCardData } from "../images/image-card-data";
import { ImageEntityCard } from "../images/image-entity-card";
import { searchPerformerItemToCardData } from "../performers/performer-card-data";
import { PerformerEntityCard } from "../performers/performer-entity-card";
import { searchVideoItemToCardData } from "../videos/video-card-data";
import { SceneCard } from "../videos/video-card";
import { searchStudioItemToCardData } from "../studios/studio-card-data";
import { StudioEntityCard } from "../studios/studio-entity-card";
import { SEARCH_KIND_CONFIG } from "./search-kind-config";
import { searchTagItemToCardData } from "../tags/tag-card-data";
import { TagEntityCard } from "../tags/tag-entity-card";

interface SearchResultCardProps {
  item: SearchResultItem;
  variant?: "default" | "compact";
  onSelect?: (href: string) => void;
  from?: string;
}

export function SearchResultCard({
  item,
  variant = "default",
  onSelect,
  from,
}: SearchResultCardProps) {
  if (item.kind === "scene") {
    const scene = searchVideoItemToCardData(item, from);

    if (scene) {
      return (
        <SceneCard
          scene={scene}
          variant={variant === "compact" ? "compact" : "grid"}
          onSelect={onSelect}
        />
      );
    }
  }

  if (item.kind === "gallery") {
    const gallery = searchGalleryItemToCardData(item, from);

    if (gallery) {
      return (
        <GalleryEntityCard
          gallery={gallery}
          variant={variant === "compact" ? "compact" : "grid"}
          onSelect={onSelect}
        />
      );
    }
  }

  if (item.kind === "image") {
    const image = searchImageItemToCardData(item, from);

    if (image) {
      return (
        <ImageEntityCard
          image={image}
          variant={variant === "compact" ? "compact" : "grid"}
          onSelect={onSelect}
        />
      );
    }
  }

  if (item.kind === "performer") {
    const performer = searchPerformerItemToCardData(item, from);

    if (performer) {
      return (
        <PerformerEntityCard
          performer={performer}
          variant={variant === "compact" ? "compact" : "portrait"}
          onSelect={onSelect}
        />
      );
    }
  }

  if (item.kind === "studio") {
    const studio = searchStudioItemToCardData(item, from);

    if (studio) {
      return (
        <StudioEntityCard
          studio={studio}
          variant={variant === "compact" ? "compact" : "banner"}
          onSelect={onSelect}
        />
      );
    }
  }

  if (item.kind === "tag") {
    const tag = searchTagItemToCardData(item, from);

    if (tag) {
      return (
        <TagEntityCard
          tag={tag}
          variant={variant === "compact" ? "compact" : "list"}
          onSelect={onSelect}
        />
      );
    }
  }

  return variant === "compact"
    ? <CompactFallbackResultCard item={item} onSelect={onSelect} />
    : <DefaultFallbackResultCard item={item} />;
}

function DefaultFallbackResultCard({ item }: { item: SearchResultItem }) {
  const Icon = SEARCH_KIND_CONFIG[item.kind].icon;
  const imgSrc = toApiUrl(item.imagePath);
  const rating = item.rating ?? 0;

  return (
    <Link
      href={item.href}
      className="surface-card-sharp group flex items-center gap-3 p-2 transition-colors duration-fast"
    >
      <div
        className={cn(
          "shrink-0 overflow-hidden bg-surface-1 flex items-center justify-center",
          item.kind === "performer" ? "h-12 w-12 " : "h-12 w-20 ",
        )}
      >
        {imgSrc ? (
          <img src={imgSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-4 w-4 text-text-disabled" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary group-hover:text-text-accent truncate transition-colors duration-fast">
          {item.title}
        </div>
        {item.subtitle ? (
          <div className="text-[0.68rem] text-text-muted truncate">{item.subtitle}</div>
        ) : null}
        {item.rating != null && item.rating > 0 ? (
          <div className="mt-0.5 flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, index) => (
              <Star
                key={index}
                className={cn(
                  "h-2.5 w-2.5",
                  index < rating ? "text-text-accent" : "text-text-disabled/30",
                )}
                fill={index < rating ? "currentColor" : "none"}
              />
            ))}
          </div>
        ) : null}
      </div>

      <span className="tag-chip tag-chip-default shrink-0 text-[0.55rem]">
        {SEARCH_KIND_CONFIG[item.kind]?.label ?? item.kind}
      </span>
    </Link>
  );
}

function CompactFallbackResultCard({
  item,
  onSelect,
}: {
  item: SearchResultItem;
  onSelect?: (href: string) => void;
}) {
  const Icon = SEARCH_KIND_CONFIG[item.kind].icon;
  const imgSrc = toApiUrl(item.imagePath);
  const content = (
    <>
      <div
        className={cn(
          "shrink-0 overflow-hidden bg-surface-1 flex items-center justify-center",
          item.kind === "performer" ? "h-8 w-8 " : "h-8 w-12 ",
        )}
      >
        {imgSrc ? (
          <img src={imgSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-3.5 w-3.5 text-text-disabled" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="truncate text-sm text-text-primary">{item.title}</div>
        {item.subtitle ? (
          <div className="truncate text-[0.68rem] text-text-muted">{item.subtitle}</div>
        ) : null}
      </div>

      <span className="tag-chip tag-chip-default shrink-0 text-[0.6rem]">
        {SEARCH_KIND_CONFIG[item.kind]?.label ?? item.kind}
      </span>
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(item.href)}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-2",
          "text-left hover:bg-surface-2 transition-colors duration-fast",
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2",
        "text-left hover:bg-surface-2 transition-colors duration-fast",
      )}
    >
      {content}
    </Link>
  );
}
