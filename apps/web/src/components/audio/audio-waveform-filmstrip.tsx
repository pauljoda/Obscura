"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  type RefObject,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface AudioWaveformFilmstripProps {
  peaks: number[];
  duration: number;
  audioRef: RefObject<HTMLAudioElement | null>;
  onSeek: (time: number) => void;
}

const STRIP_HEIGHT = 52;

/** Match video film strip: desktop wheel scrubs the strip. */
const DESKTOP_WHEEL_SCRUB_MQ = "(pointer: fine) and (hover: hover)";

const BAR_COLOR = "rgba(255, 255, 255, 0.18)";
const BAR_ACCENT = "rgba(196, 154, 90, 0.35)";

function drawWaveformStrip(
  canvas: HTMLCanvasElement,
  peaks: number[],
  trackWidth: number,
  height: number,
) {
  const pairCount = Math.floor(peaks.length / 2);
  if (pairCount <= 0 || trackWidth <= 0) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(trackWidth * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${trackWidth}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, trackWidth, height);

  const barWidth = Math.max(1, trackWidth / pairCount);
  const centerY = height / 2;
  const maxAmplitude = peaks.reduce((max, v) => Math.max(max, Math.abs(v)), 1);

  for (let i = 0; i < pairCount; i++) {
    const min = peaks[i * 2]! / maxAmplitude;
    const max = peaks[i * 2 + 1]! / maxAmplitude;
    const x = (i / pairCount) * trackWidth;
    const barTop = centerY - max * (height / 2) * 0.88;
    const barBottom = centerY - min * (height / 2) * 0.88;
    const barH = Math.max(1, barBottom - barTop);
    const intensity = (Math.abs(min) + Math.abs(max)) / 2;
    ctx.fillStyle = intensity > 0.35 ? BAR_ACCENT : BAR_COLOR;
    ctx.fillRect(x, barTop, Math.max(1, barWidth - 0.5), barH);
  }
}

export function AudioWaveformFilmstrip({
  peaks,
  duration,
  audioRef,
  onSeek,
}: AudioWaveformFilmstripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const draggingRef = useRef(false);
  const [stripDragging, setStripDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartTimeRef = useRef(0);
  const rafRef = useRef(0);
  const trackWidthRef = useRef(0);
  const wheelIdleTimerRef = useRef<number | null>(null);

  const safeDuration = duration > 0 ? duration : 0.001;

  const pairCount = Math.floor(peaks.length / 2);
  const naturalWidth = Math.max(1, pairCount * 2);
  const trackWidth =
    containerWidth > 0
      ? Math.max(naturalWidth, containerWidth * 6, safeDuration * 10)
      : 0;

  trackWidthRef.current = trackWidth;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el) {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setContainerWidth(w);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setContainerWidth(e.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || trackWidth <= 0 || pairCount <= 0) return;
    drawWaveformStrip(canvas, peaks, trackWidth, STRIP_HEIGHT);
  }, [peaks, trackWidth, pairCount]);

  const applyPosition = useCallback((time: number) => {
    const container = containerRef.current;
    const track = trackRef.current;
    const tw = trackWidthRef.current;
    if (!container || !track || tw <= 0) return;
    const cw = container.clientWidth;
    const t = Math.max(0, Math.min(safeDuration, time));
    const trackPosition = (t / safeDuration) * tw;
    const tx = cw / 2 - trackPosition;
    track.style.transform = `translateX(${tx}px)`;
  }, [safeDuration]);

  useEffect(() => {
    const tick = () => {
      const audio = audioRef.current;
      if (!containerRef.current || !trackRef.current || draggingRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (audio && trackWidthRef.current > 0) {
        applyPosition(audio.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [audioRef, applyPosition]);

  const clearWheelIdle = useCallback(() => {
    if (wheelIdleTimerRef.current != null) {
      window.clearTimeout(wheelIdleTimerRef.current);
      wheelIdleTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (trackWidth <= 0 || safeDuration <= 0) return;
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
      const tw = trackWidthRef.current;
      const pixelsPerSecond = tw / safeDuration;
      const timeDelta = raw / pixelsPerSecond;
      const audio = audioRef.current;
      const current = audio?.currentTime ?? 0;
      const newTime = Math.max(0, Math.min(safeDuration, current + timeDelta));
      applyPosition(newTime);
      onSeek(newTime);
      clearWheelIdle();
      wheelIdleTimerRef.current = window.setTimeout(() => {
        wheelIdleTimerRef.current = null;
      }, 320);
    };

    const sync = () => {
      el.removeEventListener("wheel", onWheel);
      if (mq.matches) {
        el.addEventListener("wheel", onWheel, { passive: false });
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      el.removeEventListener("wheel", onWheel);
      clearWheelIdle();
    };
  }, [audioRef, applyPosition, onSeek, safeDuration, trackWidth, clearWheelIdle]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (trackWidthRef.current <= 0) return;
      draggingRef.current = true;
      setStripDragging(true);
      dragStartXRef.current = e.clientX;
      dragStartTimeRef.current = audioRef.current?.currentTime ?? 0;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [audioRef],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current || trackWidthRef.current <= 0) return;
      const dx = e.clientX - dragStartXRef.current;
      const tw = trackWidthRef.current;
      const pixelsPerSecond = tw / safeDuration;
      const timeDelta = -dx / pixelsPerSecond;
      const newTime = Math.max(
        0,
        Math.min(safeDuration, dragStartTimeRef.current + timeDelta),
      );
      applyPosition(newTime);
      onSeek(newTime);
    },
    [applyPosition, onSeek, safeDuration],
  );

  const endPointer = useCallback(() => {
    draggingRef.current = false;
    setStripDragging(false);
  }, []);

  const jump = useCallback(
    (dir: -1 | 1) => {
      const step = Math.max(0.5, safeDuration / 48);
      const audio = audioRef.current;
      const t = audio?.currentTime ?? 0;
      const newTime = Math.max(0, Math.min(safeDuration, t + dir * step));
      onSeek(newTime);
      applyPosition(newTime);
    },
    [applyPosition, onSeek, safeDuration, audioRef],
  );

  useEffect(() => () => clearWheelIdle(), [clearWheelIdle]);

  if (pairCount <= 0) {
    return null;
  }

  return (
    <div className="relative flex items-center bg-black" style={{ height: STRIP_HEIGHT }}>
      <button
        type="button"
        onClick={() => jump(-1)}
        className="relative z-30 flex h-full w-8 flex-shrink-0 items-center justify-center bg-black/80 text-white/50 transition-colors hover:text-white"
        aria-label="Scrub back"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden select-none touch-none"
        style={{ height: STRIP_HEIGHT }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-black/70 to-transparent" />

        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2">
          <div className="absolute -top-px left-1/2 -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-accent-500" />
          <div className="h-full w-[2px] bg-accent-500 shadow-[0_0_8px_rgba(196,154,90,0.55)]" />
          <div className="absolute -bottom-px left-1/2 -translate-x-1/2 border-x-[5px] border-b-[5px] border-x-transparent border-b-accent-500" />
        </div>

        {trackWidth > 0 && (
          <div
            ref={trackRef}
            className="absolute inset-y-0 left-0 will-change-transform"
            style={{
              width: trackWidth,
              cursor: stripDragging ? "grabbing" : "grab",
            }}
          >
            <canvas ref={canvasRef} className="block h-full" />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => jump(1)}
        className="relative z-30 flex h-full w-8 flex-shrink-0 items-center justify-center bg-black/80 text-white/50 transition-colors hover:text-white"
        aria-label="Scrub forward"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
