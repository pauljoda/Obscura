"use client";

import Link from "next/link";
import { Star, Users } from "lucide-react";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import type { PerformerCardData } from "./performer-card-data";
import { NsfwBlur, NsfwShowModeChip, NsfwText } from "../nsfw/nsfw-gate";
import { entityTerms } from "../../lib/terminology";
import { MediaAppearanceCounts } from "../shared/media-appearance-counts";

interface PerformerEntityCardProps {
  performer: PerformerCardData;
  variant?: "portrait" | "list" | "compact";
  onSelect?: (href: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function PerformerEntityCard({
  performer,
  variant = "portrait",
  onSelect,
  selected,
  onToggleSelect,
}: PerformerEntityCardProps) {
  if (variant === "list") {
    return <PerformerListCard performer={performer} selected={selected} onToggleSelect={onToggleSelect} />;
  }
  if (variant === "compact") {
    return <PerformerCompactCard performer={performer} onSelect={onSelect} />;
  }

  return (
    <Link href={performer.href}>
      <article className="surface-card group h-full cursor-pointer overflow-hidden">
        <NsfwBlur isNsfw={performer.isNsfw ?? false} className="relative aspect-[3/4] bg-surface-3">
          <div className="relative aspect-[3/4] bg-surface-3">
            {performer.imagePath ? (
              <img
                src={performer.imagePath}
                alt={performer.name}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-moderate group-hover:scale-[1.02]"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Users className="h-10 w-10 text-text-disabled/50" />
              </div>
            )}
            <NsfwShowModeChip
              isNsfw={performer.isNsfw}
              className="absolute bottom-2 right-2 z-10 pointer-events-none"
            />
            {performer.favorite ? (
              <span className="absolute right-2 top-2 bg-black/60 px-1.5 py-1 text-text-accent backdrop-blur-sm">
                <Star className="h-3 w-3 fill-current" />
              </span>
            ) : null}
          </div>
        </NsfwBlur>
        <div className="space-y-1 px-3 py-2.5">
          <NsfwText isNsfw={performer.isNsfw ?? false} className="truncate text-sm font-medium transition-colors duration-fast group-hover:text-text-accent block">
            {performer.name}
          </NsfwText>
          <MediaAppearanceCounts
            sceneCount={performer.sceneCount}
            imageAppearanceCount={performer.imageAppearanceCount}
            audioLibraryCount={performer.audioLibraryCount}
            trailing={performer.gender ?? null}
          />
        </div>
      </article>
    </Link>
  );
}

function PerformerListCard({
  performer,
  selected,
  onToggleSelect,
}: {
  performer: PerformerCardData;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  return (
    <Link href={performer.href}>
      <div className="surface-card-sharp group flex items-center gap-3 px-3 py-2 cursor-pointer">
        {onToggleSelect && (
          <Checkbox
            checked={selected ?? false}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.preventDefault();
              onToggleSelect(performer.id);
            }}
            className="flex-shrink-0"
          />
        )}
        <NsfwBlur isNsfw={performer.isNsfw ?? false} className="flex-shrink-0 h-10 w-8 overflow-hidden bg-surface-3">
          <div className="relative h-10 w-8 overflow-hidden bg-surface-3">
            {performer.imagePath ? (
              <img src={performer.imagePath} alt={performer.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-text-disabled" />
              </div>
            )}
            <NsfwShowModeChip
              isNsfw={performer.isNsfw}
              compact
              className="pointer-events-none absolute bottom-0.5 right-0.5 z-10"
            />
          </div>
        </NsfwBlur>

        <div className="flex-1 min-w-0">
          <NsfwText isNsfw={performer.isNsfw ?? false} className="text-[0.8rem] font-medium text-text-primary truncate block group-hover:text-text-accent transition-colors duration-fast">
            {performer.name}
          </NsfwText>
          <div className="min-w-0">
            <MediaAppearanceCounts
              sceneCount={performer.sceneCount}
              imageAppearanceCount={performer.imageAppearanceCount}
              audioLibraryCount={performer.audioLibraryCount}
              trailing={performer.gender ?? null}
              className="truncate"
            />
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
          {performer.favorite && (
            <Star className="h-3 w-3 text-accent-500 fill-accent-500" />
          )}
          {performer.rating != null && performer.rating > 0 && (
            <span className="flex items-center gap-0.5 text-[0.65rem] text-text-disabled">
              <Star className="h-3 w-3 text-accent-500 fill-accent-500" />
              {Math.round(performer.rating / 20)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function PerformerCompactCard({
  performer,
  onSelect,
}: {
  performer: PerformerCardData;
  onSelect?: (href: string) => void;
}) {
  const content = (
    <>
      <div className="shrink-0 overflow-hidden bg-surface-1 flex items-center justify-center h-8 w-8 ">
        {performer.imagePath ? (
          <img src={performer.imagePath} alt="" className="h-full w-full object-cover" />
        ) : (
          <Users className="h-3.5 w-3.5 text-text-disabled" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary truncate">{performer.name}</div>
        <MediaAppearanceCounts
          sceneCount={performer.sceneCount}
          imageAppearanceCount={performer.imageAppearanceCount}
          audioLibraryCount={performer.audioLibraryCount}
          compact
          trailing={performer.gender ?? null}
          className="truncate"
        />
      </div>
      <span className="shrink-0 tag-chip tag-chip-default text-[0.6rem]">
        {entityTerms.performer.toLowerCase()}
      </span>
    </>
  );

  if (onSelect) {
    return (
      <button
        onClick={() => onSelect(performer.href)}
        className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={performer.href}
      className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
    >
      {content}
    </Link>
  );
}
