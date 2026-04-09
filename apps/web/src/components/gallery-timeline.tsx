"use client";

import { useMemo } from "react";
import { GalleryCard } from "./gallery-card";
import type { GalleryListItemDto } from "@obscura/contracts";
import { useNsfw } from "./nsfw/nsfw-context";

interface GalleryTimelineProps {
  galleries: GalleryListItemDto[];
}

export function GalleryTimeline({ galleries }: GalleryTimelineProps) {
  const { mode: nsfwMode } = useNsfw();

  const grouped = useMemo(() => {
    const visible =
      nsfwMode === "off" ? galleries.filter((g) => g.isNsfw !== true) : galleries;

    const groups: { label: string; galleries: GalleryListItemDto[] }[] = [];
    const map = new Map<string, GalleryListItemDto[]>();

    for (const gallery of visible) {
      const date = gallery.date ?? gallery.createdAt;
      const d = new Date(date);
      const key = isNaN(d.getTime())
        ? "Unknown"
        : new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long" }).format(d);

      const existing = map.get(key);
      if (existing) {
        existing.push(gallery);
      } else {
        const arr = [gallery];
        map.set(key, arr);
        groups.push({ label: key, galleries: arr });
      }
    }

    return groups;
  }, [galleries, nsfwMode]);

  if (grouped.length === 0) {
    return (
      <div className="surface-well flex items-center justify-center py-16 text-text-muted text-sm">
        No galleries to display
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      {/* Timeline line */}
      <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border-subtle" />

      {grouped.map((group) => (
        <div key={group.label} className="mb-8">
          {/* Month header */}
          <div className="sticky top-0 z-10 -ml-6 mb-3 flex items-center gap-2">
            <div className="h-2 w-2 bg-accent-500 shadow-[0_0_6px_rgba(199,155,92,0.4)] flex-shrink-0" />
            <span className="text-kicker bg-bg px-2">{group.label}</span>
          </div>

          {/* Gallery cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {group.galleries.map((gallery) => (
              <GalleryCard key={gallery.id} gallery={gallery} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
