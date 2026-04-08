"use client";

import { useEffect, useRef, useState, useCallback, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  loadTrickplayFrames,
  findFrameAtTime,
  timeToTrackPosition,
  type TrickplayFrame,
} from "@obscura/ui/lib/trickplay";

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
  /** True while user scrubs via pointer (any device) or wheel (desktop); parent may hide player chrome. */
  onStripInteractionChange?: (active: boolean) => void;
}

const STRIP_HEIGHT = 52;

/** Wheel scrub only on desktop — touch-primary devices keep native scroll/gestures. */
const DESKTOP_WHEEL_SCRUB_MQ = "(pointer: fine) and (hover: hover)";

export function FilmStrip({
  spriteUrl,
  vttUrl,
  videoRef,
  duration,
  onSeek,
  markers = [],
  onStripInteractionChange,
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
  const interactionCbRef = useRef(onStripInteractionChange);
  interactionCbRef.current = onStripInteractionChange;
  const wheelIdleTimerRef = useRef<number | null>(null);

  const clearWheelIdleTimer = useCallback(() => {
    if (wheelIdleTimerRef.current != null) {
      window.clearTimeout(wheelIdleTimerRef.current);
      wheelIdleTimerRef.current = null;
    }
  }, []);

  const notifyWheelScrubActivity = useCallback(() => {
    const cb = interactionCbRef.current;
    if (!cb) return;
    cb(true);
    clearWheelIdleTimer();
    wheelIdleTimerRef.current = window.setTimeout(() => {
      wheelIdleTimerRef.current = null;
      interactionCbRef.current?.(false);
    }, 320);
  }, [clearWheelIdleTimer]);

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

  // Apply track position for a given time — playhead stays at viewport center
  const applyPosition = useCallback(
    (time: number) => {
      const container = containerRef.current;
      const track = trackRef.current;
      if (!container || !track || !frames) return;

      const containerWidth = container.clientWidth;
      const trackPosition = timeToTrackPosition(frames, time, frameWidth);
      const tx = containerWidth / 2 - trackPosition;

      const transform = `translateX(${tx}px)`;
      track.style.transform = transform;
      if (markersRef.current) markersRef.current.style.transform = transform;
    },
    [frames, frameWidth]
  );

  // rAF loop: read video.currentTime every frame and set transform directly
  useEffect(() => {
    if (!frames || frames.length === 0) return;

    const tick = () => {
      const video = videoRef.current;
      if (!video || !containerRef.current || !trackRef.current || draggingRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      applyPosition(video.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [frames, frameWidth, videoRef, applyPosition]);

  // Desktop only: map wheel / trackpad scroll to scrub (passive: false). Skipped on touch-primary UIs.
  useEffect(() => {
    if (!frames || frames.length === 0 || duration <= 0 || trackWidth <= 0) return;
    const el = containerRef.current;
    if (!el) return;

    const mq = window.matchMedia(DESKTOP_WHEEL_SCRUB_MQ);

    const onWheel = (e: WheelEvent) => {
      if (!mq.matches) return;
      const raw =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (raw === 0) return;
      e.preventDefault();
      e.stopPropagation();
      const pixelsPerSecond = trackWidth / duration;
      const timeDelta = raw / pixelsPerSecond;
      const video = videoRef.current;
      const current = video?.currentTime ?? 0;
      const newTime = Math.max(0, Math.min(duration, current + timeDelta));
      applyPosition(newTime);
      onSeek(newTime);
      notifyWheelScrubActivity();
    };

    const syncListener = () => {
      el.removeEventListener("wheel", onWheel);
      if (mq.matches) {
        el.addEventListener("wheel", onWheel, { passive: false });
      }
    };

    syncListener();
    mq.addEventListener("change", syncListener);
    return () => {
      mq.removeEventListener("change", syncListener);
      el.removeEventListener("wheel", onWheel);
    };
  }, [frames, duration, trackWidth, videoRef, applyPosition, onSeek, notifyWheelScrubActivity]);

  useEffect(() => {
    return () => {
      clearWheelIdleTimer();
      interactionCbRef.current?.(false);
    };
  }, [clearWheelIdleTimer]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!frames) return;
      clearWheelIdleTimer();
      interactionCbRef.current?.(true);
      draggingRef.current = true;
      dragStartXRef.current = e.clientX;
      dragStartTimeRef.current = videoRef.current?.currentTime ?? 0;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [frames, videoRef, clearWheelIdleTimer]
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
      applyPosition(newTime);
      onSeek(newTime);
    },
    [frames, trackWidth, duration, onSeek, applyPosition]
  );

  const endStripPointerInteraction = useCallback(() => {
    draggingRef.current = false;
    clearWheelIdleTimer();
    interactionCbRef.current?.(false);
  }, [clearWheelIdleTimer]);

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
        onPointerUp={endStripPointerInteraction}
        onPointerCancel={endStripPointerInteraction}
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
              const left = timeToTrackPosition(frames, marker.time, frameWidth);
              return (
                <div
                  key={marker.id}
                  className="absolute top-0 bottom-0 flex flex-col items-center"
                  style={{ left }}
                >
                  <div className="w-px h-full bg-accent-500/50" />
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-px text-[0.5rem] font-medium tracking-wide uppercase leading-tight bg-black/80 text-accent-300 border border-accent-500/30 ">
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
