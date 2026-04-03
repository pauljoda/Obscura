"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { cn } from "@obscura/ui";

interface Marker {
  id: string;
  time: number;
  title: string;
  tag?: string;
}

interface VideoPlayerProps {
  src?: string;
  poster?: string;
  markers?: Marker[];
  onMarkerClick?: (marker: Marker) => void;
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoPlayer({
  src,
  poster,
  markers = [],
  onMarkerClick,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }, []);

  const seek = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.max(
        0,
        Math.min(duration, video.currentTime + delta)
      );
    },
    [duration]
  );

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => setDuration(video.duration);
    const onEnded = () => setPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          seek(-5);
          break;
        case "ArrowRight":
          seek(5);
          break;
        case "j":
          seek(-10);
          break;
        case "l":
          seek(10);
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [togglePlay, seek, toggleMute, toggleFullscreen]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-black group"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      {/* Video element */}
      {src ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="w-full aspect-video"
          onClick={togglePlay}
          playsInline
        />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-surface-1">
          <div className="text-center">
            <Play className="h-16 w-16 text-text-disabled mx-auto mb-3" />
            <p className="text-text-muted text-sm">No video source</p>
            <p className="text-text-disabled text-xs mt-1">
              Video playback will appear here
            </p>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-3 px-4 transition-opacity duration-normal",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Scrubber / Timeline */}
        <div className="relative mb-3 group/scrub">
          {/* Track */}
          <div
            className="h-1 w-full cursor-pointer rounded-full bg-white/20 group-hover/scrub:h-2 transition-[height] duration-fast"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              seekTo(pct * duration);
            }}
          >
            {/* Progress fill */}
            <div
              className="h-full rounded-full bg-accent-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Markers on timeline */}
          {markers.map((marker) => {
            const markerPct =
              duration > 0 ? (marker.time / duration) * 100 : 0;
            return (
              <button
                key={marker.id}
                className="absolute top-1/2 -translate-y-1/2 h-3 w-1.5 rounded-sm bg-accent-400 hover:bg-accent-300 transition-colors duration-fast"
                style={{ left: `${markerPct}%` }}
                onClick={() => {
                  seekTo(marker.time);
                  onMarkerClick?.(marker);
                }}
                title={marker.title}
              />
            );
          })}
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => seek(-10)}
              className="text-white/70 hover:text-white transition-colors duration-fast"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500/90 text-accent-950 hover:bg-accent-400 transition-colors duration-fast"
            >
              {playing ? (
                <Pause className="h-4 w-4" fill="currentColor" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
              )}
            </button>
            <button
              onClick={() => seek(10)}
              className="text-white/70 hover:text-white transition-colors duration-fast"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            {/* Time display */}
            <span className="text-mono-tabular text-white/80 text-xs">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-white/70 hover:text-white transition-colors duration-fast"
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={toggleFullscreen}
              className="text-white/70 hover:text-white transition-colors duration-fast"
            >
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
