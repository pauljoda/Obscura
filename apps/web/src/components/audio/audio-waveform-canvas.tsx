"use client";

import { useRef, useEffect, useCallback, useState } from "react";

interface AudioWaveformCanvasProps {
  /** Min/max amplitude pairs from audiowaveform JSON */
  peaks: number[];
  /** Total track duration in seconds */
  duration: number;
  /** Current playback time in seconds */
  currentTime: number;
  /** Called when user clicks/drags to seek */
  onSeek: (time: number) => void;
  /** Height in pixels (default: 48) */
  height?: number;
}

/** Brass accent color for the played portion */
const PLAYED_COLOR = "#c49a5a";
/** Muted color for the unplayed portion */
const UNPLAYED_COLOR = "rgba(255, 255, 255, 0.12)";
/** Playhead glow */
const PLAYHEAD_COLOR = "#c49a5a";

export function AudioWaveformCanvas({
  peaks,
  duration,
  currentTime,
  onSeek,
  height = 48,
}: AudioWaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [containerWidth, setContainerWidth] = useState(0);

  // Observe container width for responsive rendering
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(container);
    setContainerWidth(container.clientWidth);

    return () => observer.disconnect();
  }, []);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerWidth <= 0 || peaks.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, containerWidth, height);

    // Peaks are min/max pairs — resample to fit container width
    const pairCount = Math.floor(peaks.length / 2);
    const barWidth = Math.max(1, containerWidth / pairCount);
    const playProgress = duration > 0 ? currentTime / duration : 0;
    const playX = playProgress * containerWidth;
    const centerY = height / 2;
    const maxAmplitude = peaks.reduce((max, v) => Math.max(max, Math.abs(v)), 1);

    for (let i = 0; i < pairCount; i++) {
      const min = peaks[i * 2] / maxAmplitude;
      const max = peaks[i * 2 + 1] / maxAmplitude;
      const x = (i / pairCount) * containerWidth;

      const barTop = centerY - max * (height / 2) * 0.9;
      const barBottom = centerY - min * (height / 2) * 0.9;
      const barHeight = Math.max(1, barBottom - barTop);

      ctx.fillStyle = x <= playX ? PLAYED_COLOR : UNPLAYED_COLOR;
      ctx.fillRect(x, barTop, Math.max(1, barWidth - 0.5), barHeight);
    }

    // Playhead line
    if (playProgress > 0 && playProgress < 1) {
      ctx.fillStyle = PLAYHEAD_COLOR;
      ctx.shadowColor = PLAYHEAD_COLOR;
      ctx.shadowBlur = 6;
      ctx.fillRect(playX - 0.5, 0, 1, height);
      ctx.shadowBlur = 0;
    }
  }, [peaks, containerWidth, height, currentTime, duration]);

  // Click/drag to seek
  const seekFromEvent = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container || duration <= 0) return;
      const rect = container.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeek(fraction * duration);
    },
    [duration, onSeek],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      draggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      seekFromEvent(e.clientX);
    },
    [seekFromEvent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      seekFromEvent(e.clientX);
    },
    [seekFromEvent],
  );

  const handlePointerEnd = useCallback(() => {
    draggingRef.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative select-none touch-none cursor-pointer"
      style={{ height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
