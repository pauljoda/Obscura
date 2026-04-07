"use client";

import Link from "next/link";
import { Building2, Film, Heart, Star } from "lucide-react";
import type { StudioCardData } from "./studio-card-data";

interface StudioEntityCardProps {
  studio: StudioCardData;
  variant?: "banner" | "compact";
  onSelect?: (href: string) => void;
}

export function StudioEntityCard({
  studio,
  variant = "banner",
  onSelect,
}: StudioEntityCardProps) {
  if (variant === "compact") {
    return <StudioCompactCard studio={studio} onSelect={onSelect} />;
  }

  return (
    <Link href={studio.href}>
      <article className="surface-card overflow-hidden group cursor-pointer h-full">
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
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
        </div>

        <div className="p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium truncate group-hover:text-text-accent transition-colors duration-fast">
              {studio.name}
            </h3>
            {studio.favorite && (
              <Heart className="h-3 w-3 text-red-400 fill-red-400 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-3 text-[0.65rem] text-text-disabled">
            <span className="flex items-center gap-1">
              <Film className="h-2.5 w-2.5" />
              {studio.sceneCount}
            </span>
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
        <div className="text-[0.68rem] text-text-muted truncate">
          {studio.sceneCount} scenes
        </div>
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
