"use client";

import Link from "next/link";
import { Building2, Heart, Star } from "lucide-react";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import type { StudioCardData } from "./studio-card-data";
import { NsfwBlur, NsfwShowModeChip } from "../nsfw/nsfw-gate";
import { MediaAppearanceCounts } from "../shared/media-appearance-counts";

interface StudioEntityCardProps {
  studio: StudioCardData;
  variant?: "banner" | "list" | "compact";
  onSelect?: (href: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function StudioEntityCard({
  studio,
  variant = "banner",
  onSelect,
  selected,
  onToggleSelect,
}: StudioEntityCardProps) {
  if (variant === "list") {
    return <StudioListCard studio={studio} selected={selected} onToggleSelect={onToggleSelect} />;
  }
  if (variant === "compact") {
    return <StudioCompactCard studio={studio} onSelect={onSelect} />;
  }

  return (
    <Link href={studio.href}>
      <article className="surface-card overflow-hidden group cursor-pointer h-full">
        <NsfwBlur isNsfw={studio.isNsfw ?? false} className="relative aspect-[16/7] bg-surface-3 overflow-hidden">
          <div className="relative aspect-[16/7] bg-surface-3 overflow-hidden">
            {studio.imagePath ? (
              <img
                src={studio.imagePath}
                alt={studio.name}
                className="absolute inset-0 w-full h-full object-contain group-hover:scale-105 transition-transform duration-normal"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Building2 className="h-10 w-10 text-text-disabled/20" />
              </div>
            )}
            <NsfwShowModeChip
              isNsfw={studio.isNsfw}
              className="absolute bottom-2 right-2 z-10 pointer-events-none"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        </NsfwBlur>

        <div className="p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium truncate group-hover:text-text-accent transition-colors duration-fast">
              {studio.name}
            </h3>
            {studio.favorite && (
              <Heart className="h-3 w-3 text-red-400 fill-red-400 flex-shrink-0" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text-disabled">
            <MediaAppearanceCounts
              sceneCount={studio.sceneCount}
              imageAppearanceCount={studio.imageAppearanceCount}
              audioLibraryCount={studio.audioLibraryCount}
              compact
            />
            {studio.rating != null && studio.rating > 0 && (
              <span className="flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 text-accent-500 fill-accent-500" />
                {Math.round(studio.rating / 20)}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

function StudioListCard({
  studio,
  selected,
  onToggleSelect,
}: {
  studio: StudioCardData;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  return (
    <Link href={studio.href}>
      <div className="surface-card-sharp group flex items-center gap-3 px-3 py-2 cursor-pointer">
        {onToggleSelect && (
          <Checkbox
            checked={selected ?? false}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.preventDefault();
              onToggleSelect(studio.id);
            }}
            className="flex-shrink-0"
          />
        )}
        <NsfwBlur isNsfw={studio.isNsfw ?? false} className="flex-shrink-0 w-12 h-7 overflow-hidden bg-surface-3">
          <div className="relative h-full w-full overflow-hidden bg-surface-3">
            {studio.imagePath ? (
              <img src={studio.imagePath} alt={studio.name} loading="lazy" decoding="async" className="h-full w-full object-contain" />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <Building2 className="h-3.5 w-3.5 text-text-disabled" />
              </div>
            )}
            <NsfwShowModeChip
              isNsfw={studio.isNsfw}
              compact
              className="pointer-events-none absolute bottom-0.5 right-0.5 z-10"
            />
          </div>
        </NsfwBlur>

        <div className="flex-1 min-w-0">
          <span className="text-[0.8rem] font-medium text-text-primary truncate block group-hover:text-text-accent transition-colors duration-fast">
            {studio.name}
          </span>
          <MediaAppearanceCounts
            sceneCount={studio.sceneCount}
            imageAppearanceCount={studio.imageAppearanceCount}
            audioLibraryCount={studio.audioLibraryCount}
            className="truncate"
          />
        </div>

        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
          {studio.favorite && (
            <Heart className="h-3 w-3 text-red-400 fill-red-400" />
          )}
          {studio.rating != null && studio.rating > 0 && (
            <span className="flex items-center gap-0.5 text-[0.65rem] text-text-disabled">
              <Star className="h-3 w-3 text-accent-500 fill-accent-500" />
              {Math.round(studio.rating / 20)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function StudioCompactCard({
  studio,
  onSelect,
}: {
  studio: StudioCardData;
  onSelect?: (href: string) => void;
}) {
  const content = (
    <>
      <div className="shrink-0 overflow-hidden bg-surface-1 flex items-center justify-center h-8 w-12 ">
        {studio.imagePath ? (
          <img src={studio.imagePath} alt="" className="h-full w-full object-cover" />
        ) : (
          <Building2 className="h-3.5 w-3.5 text-text-disabled" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary truncate">{studio.name}</div>
        <MediaAppearanceCounts
          sceneCount={studio.sceneCount}
          imageAppearanceCount={studio.imageAppearanceCount}
          audioLibraryCount={studio.audioLibraryCount}
          compact
          className="truncate"
        />
      </div>
      <span className="shrink-0 tag-chip tag-chip-default text-[0.6rem]">studio</span>
    </>
  );

  if (onSelect) {
    return (
      <button
        onClick={() => onSelect(studio.href)}
        className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={studio.href}
      className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
    >
      {content}
    </Link>
  );
}
