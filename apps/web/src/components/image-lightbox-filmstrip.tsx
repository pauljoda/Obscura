"use client";

import { useRef, useEffect } from "react";
import { cn } from "@obscura/ui/lib/utils";
import { toApiUrl } from "../lib/api";
import type { ImageListItemDto } from "@obscura/contracts";

interface ImageLightboxFilmstripProps {
  images: ImageListItemDto[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function ImageLightboxFilmstrip({
  images,
  currentIndex,
  onSelect,
}: ImageLightboxFilmstripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [currentIndex]);

  return (
    <div
      ref={containerRef}
      className="flex gap-1 overflow-x-auto scrollbar-hidden px-2 py-2"
    >
      {images.map((image, index) => {
        const isActive = index === currentIndex;
        const thumbUrl = toApiUrl(image.thumbnailPath);

        return (
          <button
            key={image.id}
            ref={isActive ? activeRef : undefined}
            onClick={() => onSelect(index)}
            className={cn(
              "flex-shrink-0 w-14 h-10 rounded-sm overflow-hidden transition-all duration-fast",
              isActive
                ? "ring-2 ring-accent-500 ring-offset-1 ring-offset-black brightness-110"
                : "opacity-60 hover:opacity-90"
            )}
          >
            {thumbUrl ? (
              <img
                src={thumbUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="h-full w-full bg-surface-3" />
            )}
          </button>
        );
      })}
    </div>
  );
}
