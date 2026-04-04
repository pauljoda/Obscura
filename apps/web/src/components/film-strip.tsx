"use client";

import { useEffect, useRef, useState, useCallback, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  loadTrickplayFrames,
  findFrameAtTime,
  type TrickplayFrame,
} from "@obscura/ui";

interface FilmStripMarker {
  id: string;
  time: number;
  title: string;
  tag?: string;
}

interface FilmStripProps {
  spriteUrl: string;
  vttUrl: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  duration: number;
  onSeek: (time: number) => void;
  markers?: FilmStripMarker[];
}

const STRIP_HEIGHT = 52;

export function FilmStrip({
  spriteUrl,
  vttUrl,
  videoRef,
  duration,
  onSeek,
  markers = [],
}: FilmStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<HTMLDivElement>(null);
  const [frames, setFrames] = useState<TrickplayFrame[] | null>(null);
  const [error, setError] = useState(false);
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartTimeRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    loadTrickplayFrames(vttUrl)
      .then(setFrames)
      .catch(() => setError(true));
  }, [vttUrl]);

  const frameWidth =
    frames && frames.length > 0
      ? Math.round((frames[0].width / frames[0].height) * STRIP_HEIGHT)
      : Math.round((16 / 9) * STRIP_HEIGHT);

  const spriteWidth = frames
    ? frames.reduce((max, f) => Math.max(max, f.x + f.width), 0)
    : 0;
  const spriteHeight = frames
    ? frames.reduce((max, f) => Math.max(max, f.y + f.height), 0)
    : 0;

  const trackWidth = frames ? frames.length * frameWidth : 0;

  // rAF loop: read video.currentTime every frame and set transform directly
  useEffect(() => {
    if (!frames || frames.length === 0) return;

    const tick = () => {
      const video = videoRef.current;
      const container = containerRef.current;
      const track = trackRef.current;
      if (!video || !container || !track || draggingRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const time = video.currentTime;
      const containerWidth = container.clientWidth;
      const normalizedTime = Math.max(0, Math.min(1, time / duration));
      const trackPosition = normalizedTime * trackWidth;
      const tx = containerWidth / 2 - trackPosition;

      const transform = `translateX(${tx}px)`;
      track.style.transform = transform;
      if (markersRef.current) markersRef.current.style.transform = transform;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [frames, frameWidth, trackWidth, duration, videoRef]);

  // During drag, we drive the position ourselves
  const applyDragTransform = useCallback(
    (time: number) => {
      const container = containerRef.current;
      const track = trackRef.current;
      if (!container || !track) return;

      const containerWidth = container.clientWidth;
      const normalizedTime = Math.max(0, Math.min(1, time / duration));
      const trackPosition = normalizedTime * trackWidth;
      const transform = `translateX(${containerWidth / 2 - trackPosition}px)`;
      track.style.transform = transform;
      if (markersRef.current) markersRef.current.style.transform = transform;
    },
    [trackWidth, duration]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!frames) return;
      draggingRef.current = true;
      dragStartXRef.current = e.clientX;
      dragStartTimeRef.current = videoRef.current?.currentTime ?? 0;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [frames, videoRef]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current || !frames) return;
      const dx = e.clientX - dragStartXRef.current;
      const pixelsPerSecond = trackWidth / duration;
      const timeDelta = -dx / pixelsPerSecond;
      const newTime = Math.max(
        0,
        Math.min(duration, dragStartTimeRef.current + timeDelta)
      );
      applyDragTransform(newTime);
      onSeek(newTime);
    },
    [frames, trackWidth, duration, onSeek, applyDragTransform]
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const jumpFrame = useCallback(
    (direction: -1 | 1) => {
      if (!frames || frames.length === 0) return;
      const time = videoRef.current?.currentTime ?? 0;
      const currentIndex = findFrameAtTime(frames, time);
      const nextIndex = Math.max(
        0,
        Math.min(frames.length - 1, currentIndex + direction)
      );
      onSeek(frames[nextIndex].start);
    },
    [frames, videoRef, onSeek]
  );

  if (error || !frames || frames.length === 0) {
    return null;
  }

  return (
    <div className="relative flex items-center" style={{ height: STRIP_HEIGHT }}>
      <button
        type="button"
        onClick={() => jumpFrame(-1)}
        className="relative z-30 flex h-full w-8 flex-shrink-0 items-center justify-center bg-black/80 text-white/50 transition-colors hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden select-none touch-none"
        style={{ height: STRIP_HEIGHT }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-black/60 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-black/60 to-transparent" />

        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2">
          <div className="absolute -top-px left-1/2 -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-accent-500" />
          <div className="h-full w-[2px] bg-accent-500 shadow-[0_0_8px_rgba(var(--accent-500-rgb,59,130,246),0.6)]" />
          <div className="absolute -bottom-px left-1/2 -translate-x-1/2 border-x-[5px] border-b-[5px] border-x-transparent border-b-accent-500" />
        </div>

        <div
          ref={trackRef}
          className="absolute inset-y-0 flex will-change-transform"
          style={{
            width: trackWidth,
            cursor: draggingRef.current ? "grabbing" : "grab",
          }}
        >
          {frames.map((frame, i) => (
            <div
              key={i}
              className="flex-shrink-0"
              style={{
                width: frameWidth,
                height: STRIP_HEIGHT,
              }}
            >
              <div
                className="h-full w-full"
                style={{
                  backgroundImage: `url(${spriteUrl})`,
                  backgroundSize: `${(spriteWidth / frame.width) * frameWidth}px ${(spriteHeight / frame.height) * STRIP_HEIGHT}px`,
                  backgroundPosition: `-${(frame.x / frame.width) * frameWidth}px -${(frame.y / frame.height) * STRIP_HEIGHT}px`,
                  backgroundRepeat: "no-repeat",
                }}
              />
            </div>
          ))}

        </div>

        {/* Marker indicators — same width, synced via rAF in markersRef */}
        {duration > 0 && markers.length > 0 && (
          <div
            ref={markersRef}
            className="absolute inset-y-0 pointer-events-none will-change-transform"
            style={{ width: trackWidth }}
          >
            {markers.map((marker) => {
              const left = (marker.time / duration) * trackWidth;
              return (
                <div
                  key={marker.id}
                  className="absolute top-0 bottom-0 flex flex-col items-center"
                  style={{ left }}
                >
                  <div className="w-px h-full bg-accent-500/50" />
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-px text-[0.5rem] font-medium tracking-wide uppercase leading-tight bg-black/80 text-accent-300 border border-accent-500/30 rounded-sm">
                    {marker.title}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => jumpFrame(1)}
        className="relative z-30 flex h-full w-8 flex-shrink-0 items-center justify-center bg-black/80 text-white/50 transition-colors hover:text-white"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
