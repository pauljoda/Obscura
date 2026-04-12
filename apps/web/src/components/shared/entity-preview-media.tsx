"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Images } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { useElementInView } from "../../hooks/use-element-in-view";

interface EntityPreviewMediaProps {
  title: string;
  mode: "cover-only" | "cycle-previews" | "cover-or-cycle";
  coverImage?: string;
  previewImages?: string[];
  previewVideoUrl?: string | null;
  showVideoOnHover?: boolean;
  className?: string;
  imageClassName?: string;
  fallback?: ReactNode;
  children?: ReactNode;
}

export function EntityPreviewMedia({
  title,
  mode,
  coverImage,
  previewImages = [],
  previewVideoUrl,
  showVideoOnHover = false,
  className,
  imageClassName,
  fallback,
  children,
}: EntityPreviewMediaProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [hovering, setHovering] = useState(false);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const isInView = useElementInView(cardRef, { rootMargin: "240px" });

  const activePreviewImages =
    mode === "cover-only"
      ? []
      : mode === "cycle-previews"
        ? previewImages
        : coverImage
          ? []
          : previewImages;

  const staticDisplayUrl =
    coverImage ??
    (activePreviewImages.length > 0
      ? (activePreviewImages[currentPreviewIndex] ?? activePreviewImages[0])
      : undefined);

  const showVideo =
    showVideoOnHover &&
    hovering &&
    isInView &&
    Boolean(previewVideoUrl) &&
    !videoFailed &&
    activePreviewImages.length <= 1;

  const startHover = useCallback(() => {
    setHovering(true);
    if (activePreviewImages.length > 1) {
      let idx = 0;
      setCurrentPreviewIndex(0);
      intervalRef.current = setInterval(() => {
        idx = (idx + 1) % activePreviewImages.length;
        setCurrentPreviewIndex(idx);
      }, 800);
    }
  }, [activePreviewImages.length]);

  const stopHover = useCallback(() => {
    setHovering(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setCurrentPreviewIndex(0);
  }, []);

  return (
    <div
      ref={cardRef}
      className={cn("relative overflow-hidden bg-surface-2", className)}
      onPointerEnter={startHover}
      onPointerLeave={stopHover}
    >
      {showVideo ? (
        <video
          src={previewVideoUrl ?? undefined}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          onError={() => setVideoFailed(true)}
          className={cn("h-full w-full object-contain", imageClassName)}
        />
      ) : staticDisplayUrl ? (
        <img
          src={staticDisplayUrl}
          alt={title}
          className={cn("h-full w-full object-cover", imageClassName)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        fallback ?? (
          <div className="flex h-full w-full items-center justify-center">
            <Images className="h-10 w-10 text-text-disabled" />
          </div>
        )
      )}

      {children}

      {hovering && !showVideo && activePreviewImages.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 flex gap-0.5 px-1 pb-0.5">
          {activePreviewImages.map((_, index) => (
            <div
              key={`${title}-${index}`}
              className={cn(
                "h-0.5 flex-1 transition-colors duration-fast",
                index === currentPreviewIndex ? "bg-accent-500" : "bg-white/30",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
