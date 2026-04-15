"use client";

import Link from "next/link";
import { Music } from "lucide-react";
import type { AudioLibraryListItemDto } from "@obscura/contracts";
import { cn } from "@obscura/ui/lib/utils";
import { toApiUrl } from "../../lib/api";
import { NsfwBlur } from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";
import { VIDEO_CARD_GRADIENTS } from "../videos/video-card-gradients";

interface AudioLibraryAppearanceGridProps {
  libraries: AudioLibraryListItemDto[];
  emptyMessage: string;
}

export function AudioLibraryAppearanceGrid({
  libraries,
  emptyMessage,
}: AudioLibraryAppearanceGridProps) {
  const { mode: nsfwMode } = useNsfw();
  const visible = libraries.filter((l) => nsfwMode !== "off" || !l.isNsfw);

  if (visible.length === 0) {
    return (
      <div className="surface-well p-8 text-center">
        <Music className="mx-auto mb-2 h-8 w-8 text-text-disabled" />
        <p className="text-sm text-text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {visible.map((library, index) => (
        <AudioAppearanceCard key={library.id} library={library} index={index} />
      ))}
    </div>
  );
}

function AudioAppearanceCard({
  library,
  index,
}: {
  library: AudioLibraryListItemDto;
  index: number;
}) {
  const coverUrl = library.coverImagePath ? toApiUrl(library.coverImagePath) : null;
  const gradientClass = VIDEO_CARD_GRADIENTS[index % VIDEO_CARD_GRADIENTS.length];

  return (
    <Link
      href={`/audio/${library.id}`}
      className="group surface-card-sharp overflow-hidden transition-colors hover:border-border-accent"
    >
      <NsfwBlur isNsfw={library.isNsfw} className="aspect-square overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={library.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className={cn("flex h-full w-full items-center justify-center", gradientClass)}>
            <Music className="h-10 w-10 text-white/20" />
          </div>
        )}
      </NsfwBlur>
      <div className="p-2.5">
        <h3 className="truncate text-sm font-medium">{library.title}</h3>
        <p className="mt-0.5 text-xs text-text-muted">
          {library.trackCount} track{library.trackCount !== 1 ? "s" : ""}
        </p>
      </div>
    </Link>
  );
}
