/**
 * Shared scrub interaction logic for time-based media controls.
 * Used by the video film strip (trickplay sprites) and audio waveform player.
 *
 * Handles: pointer grab-drag, wheel/trackpad scroll, rAF position sync, idle timeout.
 */

import { useRef, useCallback, useEffect, type RefObject } from "react";

/** Wheel scrub only on desktop — touch-primary devices keep native scroll/gestures. */
export const DESKTOP_WHEEL_SCRUB_MQ = "(pointer: fine) and (hover: hover)";

export interface UseScrubInteractionProps {
  /** Container element receiving pointer/wheel events */
  containerRef: RefObject<HTMLElement | null>;
  /** Total duration in seconds */
  duration: number;
  /** Total scrollable width in pixels (trackWidth for film strip, canvas width for waveform) */
  trackWidth: number;
  /** Called when the user seeks to a new time */
  onSeek: (time: number) => void;
  /** Called when scrub interaction starts/ends (parent may hide/show chrome) */
  onInteractionChange?: (active: boolean) => void;
  /** Returns current playback time (e.g. from video.currentTime or audio.currentTime) */
  getCurrentTime: () => number;
}

export interface ScrubInteraction {
  /** True while the user is pointer-dragging */
  draggingRef: RefObject<boolean>;
  /** Pointer event handlers to attach to the scrub area */
  handlePointerDown: (e: React.PointerEvent) => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerEnd: () => void;
}

export function useScrubInteraction({
  containerRef,
  duration,
  trackWidth,
  onSeek,
  onInteractionChange,
  getCurrentTime,
}: UseScrubInteractionProps): ScrubInteraction {
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartTimeRef = useRef(0);
  const interactionCbRef = useRef(onInteractionChange);
  interactionCbRef.current = onInteractionChange;
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

  // Desktop wheel/trackpad scrub
  useEffect(() => {
    if (duration <= 0 || trackWidth <= 0) return;
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
      const current = getCurrentTime();
      const newTime = Math.max(0, Math.min(duration, current + timeDelta));
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
  }, [containerRef, duration, trackWidth, getCurrentTime, onSeek, notifyWheelScrubActivity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearWheelIdleTimer();
      interactionCbRef.current?.(false);
    };
  }, [clearWheelIdleTimer]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      clearWheelIdleTimer();
      interactionCbRef.current?.(true);
      draggingRef.current = true;
      dragStartXRef.current = e.clientX;
      dragStartTimeRef.current = getCurrentTime();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getCurrentTime, clearWheelIdleTimer]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - dragStartXRef.current;
      const pixelsPerSecond = trackWidth / duration;
      const timeDelta = -dx / pixelsPerSecond;
      const newTime = Math.max(
        0,
        Math.min(duration, dragStartTimeRef.current + timeDelta)
      );
      onSeek(newTime);
    },
    [trackWidth, duration, onSeek]
  );

  const handlePointerEnd = useCallback(() => {
    draggingRef.current = false;
    clearWheelIdleTimer();
    interactionCbRef.current?.(false);
  }, [clearWheelIdleTimer]);

  return {
    draggingRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
  };
}
