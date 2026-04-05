"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { loadTrickplayFrames, type TrickplayFrame } from "../lib/trickplay";
import { LazyImage } from "./lazy-image";
import { Film, Clock, HardDrive, Eye, Star } from "lucide-react";

function formatHoverTime(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainder = wholeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export interface MediaCardProps {
  title: string;
  thumbnail?: string;
  cardThumbnail?: string;
  trickplaySprite?: string;
  trickplayVtt?: string;
  scrubDurationSeconds?: number;
  gradientClass?: string;
  duration?: string;
  resolution?: string;
  codec?: string;
  fileSize?: string;
  studio?: string;
  performers?: (string | { name: string; imagePath?: string | null })[];
  tags?: string[];
  tagColors?: Record<string, string>;
  rating?: number;
  views?: number;
  href?: string;
  className?: string;
}

export function MediaCard({
  title,
  thumbnail,
  cardThumbnail,
  trickplaySprite,
  trickplayVtt,
  scrubDurationSeconds,
  gradientClass,
  duration,
  resolution,
  codec,
  fileSize,
  studio,
  performers,
  tags,
  tagColors,
  rating,
  views,
  className,
}: MediaCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [frames, setFrames] = useState<TrickplayFrame[] | null>(null);
  const [trickplayError, setTrickplayError] = useState(false);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number | null>(null);
  const lastFrameIndexRef = useRef<number | null>(null);
  const touchScrubbing = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchLocked = useRef<"scrub" | "scroll" | null>(null);

  const hasScrubPreview =
    Boolean(trickplaySprite && trickplayVtt && scrubDurationSeconds && scrubDurationSeconds > 0) &&
    !trickplayError;

  const activeFrame =
    activeFrameIndex != null && frames && activeFrameIndex < frames.length
      ? frames[activeFrameIndex]
      : null;

  const { spriteWidth, spriteHeight } = useMemo(() => {
    if (!frames) return { spriteWidth: 0, spriteHeight: 0 };
    return {
      spriteWidth: frames.reduce((max, frame) => Math.max(max, frame.x + frame.width), 0),
      spriteHeight: frames.reduce((max, frame) => Math.max(max, frame.y + frame.height), 0),
    };
  }, [frames]);

  async function ensureTrickplayLoaded() {
    if (!trickplayVtt || frames || trickplayError) {
      return;
    }

    try {
      // Preload the sprite image in parallel with VTT parsing
      if (trickplaySprite) {
        const img = new Image();
        img.src = trickplaySprite;
      }
      const nextFrames = await loadTrickplayFrames(trickplayVtt);
      setFrames(nextFrames);
    } catch {
      setTrickplayError(true);
    }
  }

  function updateActiveFrame(normalizedPosition: number) {
    if (!frames || !scrubDurationSeconds) {
      return;
    }

    const clamped = Math.max(0, Math.min(1, normalizedPosition));
    const targetTime = clamped * scrubDurationSeconds;

    let nextFrameIndex = frames.findIndex(
      (frame) => targetTime >= frame.start && targetTime < frame.end
    );

    if (nextFrameIndex === -1) {
      nextFrameIndex = Math.min(frames.length - 1, Math.floor(clamped * frames.length));
    }

    if (lastFrameIndexRef.current === nextFrameIndex) {
      return;
    }

    lastFrameIndexRef.current = nextFrameIndex;
    setActiveFrameIndex(nextFrameIndex);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!hasScrubPreview || !cardRef.current) {
      return;
    }

    const bounds = cardRef.current.getBoundingClientRect();
    if (bounds.width === 0) {
      return;
    }

    updateActiveFrame((event.clientX - bounds.left) / bounds.width);
  }

  function handlePointerLeave() {
    lastFrameIndexRef.current = null;
    setActiveFrameIndex(null);
  }

  // --- Mobile touch scrub handlers ---
  // On mobile, pointerMove fires but vertical scroll cancels it immediately.
  // We use raw touch events with a direction-lock: once horizontal movement
  // exceeds vertical, we lock into scrub mode and preventDefault to stop scroll.
  const LOCK_THRESHOLD = 8; // px to decide scrub vs scroll

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (!hasScrubPreview) return;
    const touch = event.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    touchLocked.current = null;
    touchScrubbing.current = false;
    void ensureTrickplayLoaded();
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (!hasScrubPreview || !touchStartPos.current || !thumbRef.current) return;
    const touch = event.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);

    // Decide direction lock if not yet locked
    if (!touchLocked.current && (dx > LOCK_THRESHOLD || dy > LOCK_THRESHOLD)) {
      touchLocked.current = dx >= dy ? "scrub" : "scroll";
    }

    if (touchLocked.current === "scroll") return;

    // Lock into scrub — prevent scroll
    event.preventDefault();
    touchScrubbing.current = true;

    const bounds = thumbRef.current.getBoundingClientRect();
    if (bounds.width === 0) return;
    updateActiveFrame((touch.clientX - bounds.left) / bounds.width);
  }

  function handleTouchEnd() {
    touchStartPos.current = null;
    touchLocked.current = null;
    if (touchScrubbing.current) {
      touchScrubbing.current = false;
      lastFrameIndexRef.current = null;
      setActiveFrameIndex(null);
    }
  }

  return (
    <article
      ref={cardRef}
      className={cn(
        "surface-card-sharp group cursor-pointer overflow-hidden",
        className
      )}
      onPointerEnter={() => {
        void ensureTrickplayLoaded();
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div
        ref={thumbRef}
        className="relative aspect-video overflow-hidden bg-surface-1"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {thumbnail ? (
          <LazyImage
            src={cardThumbnail || thumbnail}
            alt={title}
            className={cn(
              "h-full w-full transition-transform duration-normal",
              activeFrame ? "scale-[1.01] opacity-0" : "group-hover:scale-[1.03]"
            )}
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center",
              gradientClass || "bg-surface-1",
              activeFrame && "opacity-0"
            )}
          >
            <Film className="h-7 w-7 text-white/10" />
          </div>
        )}

        {activeFrame && trickplaySprite && spriteWidth > 0 && spriteHeight > 0 && (
          <div className="absolute inset-0 overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${trickplaySprite})`,
                backgroundSize: `${(spriteWidth / activeFrame.width) * 100}% ${(spriteHeight / activeFrame.height) * 100}%`,
                backgroundPosition: `${
                  spriteWidth <= activeFrame.width
                    ? 0
                    : (activeFrame.x / (spriteWidth - activeFrame.width)) * 100
                }% ${
                  spriteHeight <= activeFrame.height
                    ? 0
                    : (activeFrame.y / (spriteHeight - activeFrame.height)) * 100
                }%`,
                backgroundRepeat: "no-repeat",
              }}
            />
            <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none" />
            <div className="absolute left-2 top-2 rounded-sm glass-chip-accent px-2 py-1 text-[0.65rem] font-mono tracking-[0.12em] text-accent-100">
              SCRUB {formatHoverTime(activeFrame.start)}
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

        {duration && (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-sm glass-chip px-1.5 py-0.5 text-[0.65rem] font-mono text-white/90">
            <Clock className="h-2.5 w-2.5 text-white/60" />
            {duration}
          </span>
        )}

        <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
          {resolution && (
            <span className="pill-accent px-1.5 py-0.5 text-[0.58rem] font-semibold tracking-wide">
              {resolution}
            </span>
          )}
          {codec && (
            <span className="rounded-sm glass-chip px-1.5 py-0.5 text-[0.58rem] font-mono text-white/70">
              {codec}
            </span>
          )}
        </div>


        {hasScrubPreview && (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/55">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-700 via-accent-500 to-accent-300 shadow-[0_0_6px_rgba(199,155,92,0.3)] transition-[width] duration-75"
                style={{
                  width:
                    activeFrame && scrubDurationSeconds
                      ? `${Math.min(100, (activeFrame.start / scrubDurationSeconds) * 100)}%`
                      : "0%",
                }}
              />
            </div>
            <div className="rounded-sm glass-chip px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-white/65">
              Scrub
            </div>
          </div>
        )}
      </div>

      <div className="p-2.5 space-y-1.5">
        <h4 className="truncate text-[0.8rem] font-medium text-text-primary leading-tight">
          {title}
        </h4>

        {(studio || (performers && performers.length > 0)) && (
          <div className="flex items-center gap-1.5 text-text-muted min-w-0">
            {studio && (
              <span className="text-[0.7rem] text-text-accent truncate flex-shrink-0">
                {studio}
              </span>
            )}
            {studio && performers?.length ? (
              <span className="text-text-disabled text-[0.6rem]">/</span>
            ) : null}
            {performers && performers.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[0.7rem] truncate">
                {performers.slice(0, 2).map((p, i) => {
                  const name = typeof p === "string" ? p : p.name;
                  const imgPath = typeof p === "string" ? null : p.imagePath;
                  return (
                    <span key={i} className="inline-flex items-center gap-1">
                      {i > 0 && <span className="text-text-disabled">,</span>}
                      {imgPath && (
                        <LazyImage src={imgPath} alt="" className="h-4 w-3 rounded-sm object-cover flex-shrink-0" />
                      )}
                      <span>{name}</span>
                    </span>
                  );
                })}
                {performers.length > 2 && (
                  <span className="text-text-disabled">
                    {" "}+{performers.length - 2}
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => {
              const colorClass =
                tagColors?.[tag] || "tag-chip-default";
              return (
                <span key={tag} className={cn("tag-chip", colorClass)}>
                  {tag}
                </span>
              );
            })}
            {tags.length > 3 && (
              <span className="tag-chip tag-chip-default text-text-disabled">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}

        {(fileSize || views !== undefined || (rating != null && rating > 0)) && (
          <div className="flex items-center gap-3 pt-1 border-t border-border-subtle">
            {rating != null && rating > 0 && (
              <span className="flex items-center gap-0.5 text-[0.62rem] text-text-accent">
                <Star className="h-2.5 w-2.5 fill-current" />
                {Math.round(rating / 20)}
              </span>
            )}
            {fileSize && (
              <span className="flex items-center gap-1 text-[0.62rem] text-text-disabled">
                <HardDrive className="h-2.5 w-2.5" />
                {fileSize}
              </span>
            )}
            {views !== undefined && (
              <span className="flex items-center gap-1 text-[0.62rem] text-text-disabled">
                <Eye className="h-2.5 w-2.5" />
                {views}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
