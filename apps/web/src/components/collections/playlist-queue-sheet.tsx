"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  X,
  Film,
  Images,
  Layers,
  Music,
  ListMusic,
} from "lucide-react";
import type { CollectionEntityType } from "@obscura/contracts";
import { toApiUrl } from "../../lib/api/core";
import { usePlaylistContext } from "./playlist-context";
import {
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

interface PlaylistQueueSheetProps {
  open: boolean;
  onClose: () => void;
}

export function PlaylistQueueSheet({ open, onClose }: PlaylistQueueSheetProps) {
  const playlist = usePlaylistContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to bring the current item into view when the sheet opens
  useEffect(() => {
    if (open && currentRef.current) {
      currentRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [open, playlist.currentPosition]);

  return (
    <div
      className={`fixed z-[55] transition-transform duration-300 ease-[var(--ease-mechanical)]
        inset-x-0 bottom-14 md:bottom-14 md:left-auto md:right-0 md:w-[420px]
        h-[calc(100dvh-7rem)] md:h-auto md:max-h-[70vh]
        ${open ? "translate-y-0" : "translate-y-[calc(100%+3.5rem)] pointer-events-none"}`}
    >
      <div className="h-full md:h-auto flex flex-col bg-surface-1/95 backdrop-blur-xl border border-border-subtle shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ListMusic className="h-4 w-4 text-text-accent shrink-0" />
            <Link
              href={`/collections/${playlist.collectionId}`}
              onClick={onClose}
              className="text-[0.78rem] font-heading font-medium text-text-primary truncate hover:text-text-accent transition-colors"
            >
              {playlist.collectionName}
            </Link>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[0.65rem] font-mono text-text-disabled">
              {playlist.currentPosition + 1}/{playlist.orderedItems.length}
            </span>
            <button
              onClick={onClose}
              className="p-1 text-text-muted hover:text-text-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Items — displayed in play order (respects shuffle) */}
        <div ref={scrollRef} className="overflow-y-auto flex-1 py-1">
          {playlist.orderedItems.map((item, position) => {
            const Icon = typeIcons[item.entityType];
            const title = getEntityTitle(item);
            const meta = getEntityMeta(item);
            const thumbnailPath = getEntityThumbnail(item);
            const thumbnailUrl = toApiUrl(thumbnailPath);
            const isCurrent = position === playlist.currentPosition;
            const isPlayed = position < playlist.currentPosition;

            return (
              <button
                key={item.id}
                ref={isCurrent ? currentRef : undefined}
                onClick={() => {
                  playlist.jumpTo(position);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  isCurrent
                    ? "bg-accent-brass/10 border-l-2 border-accent-brass shadow-[inset_0_0_12px_rgba(196,154,90,0.08)]"
                    : isPlayed
                      ? "border-l-2 border-transparent opacity-50"
                      : "border-l-2 border-transparent hover:bg-surface-2"
                }`}
              >
                {/* Thumbnail */}
                <div className="relative w-12 aspect-video shrink-0 bg-surface-2 overflow-hidden">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Icon className="h-4 w-4 text-text-disabled" />
                    </div>
                  )}
                  {/* Type badge overlay */}
                  <div className="absolute bottom-0 left-0 px-0.5 py-px bg-black/60 text-[0.5rem] font-mono text-text-secondary uppercase">
                    <Icon className="h-2 w-2 inline" />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[0.78rem] font-heading font-medium truncate leading-tight ${
                      isCurrent
                        ? "text-text-accent"
                        : isPlayed
                          ? "text-text-disabled"
                          : "text-text-primary"
                    }`}
                  >
                    {title}
                  </p>
                  {meta && (
                    <p className="text-[0.6rem] font-mono text-text-disabled truncate leading-tight mt-0.5">
                      {meta}
                    </p>
                  )}
                </div>

                {/* Position number */}
                <span className="text-[0.6rem] font-mono text-text-disabled shrink-0">
                  {position + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
