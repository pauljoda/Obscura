"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Hls from "hls.js";
import {
  ChevronDown,
  Gauge,
  Maximize,
  Pause,
  Play,
  Settings2,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Wifi,
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
  directSrc?: string;
  poster?: string;
  markers?: Marker[];
  duration?: number;
  onMarkerClick?: (marker: Marker) => void;
}

type QualityMode = "auto" | number;

interface QualityOption {
  value: QualityMode;
  label: string;
}

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBandwidth(bitsPerSecond: number | null) {
  if (!bitsPerSecond || !Number.isFinite(bitsPerSecond)) {
    return "—";
  }

  if (bitsPerSecond >= 1_000_000) {
    return `${(bitsPerSecond / 1_000_000).toFixed(1)} Mbps`;
  }

  return `${Math.round(bitsPerSecond / 1_000)} Kbps`;
}

function getLevelLabel(level: { height?: number; name?: string }, index: number) {
  if (level.name) {
    return level.name.toUpperCase();
  }

  if (level.height) {
    return `${level.height}p`;
  }

  return `Level ${index + 1}`;
}

export function VideoPlayer({
  src,
  directSrc,
  poster,
  markers = [],
  duration: propDuration,
  onMarkerClick,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(propDuration ?? 0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [qualityMode, setQualityMode] = useState<QualityMode>("auto");
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([
    { value: "auto", label: "Auto" },
  ]);
  const [activeQualityLabel, setActiveQualityLabel] = useState<string | null>(null);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [bufferAhead, setBufferAhead] = useState(0);
  const [bandwidthEstimate, setBandwidthEstimate] = useState<number | null>(null);
  const [droppedFrames, setDroppedFrames] = useState<number | null>(null);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [usingAdaptiveStream, setUsingAdaptiveStream] = useState(false);
  const [playerNotice, setPlayerNotice] = useState<string | null>(null);

  function clearControlsTimer() {
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }

  function scheduleControlsHide() {
    clearControlsTimer();
    if (!playing) {
      return;
    }

    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
      setQualityMenuOpen(false);
      setSpeedMenuOpen(false);
    }, 2400);
  }

  function surfaceControls() {
    setShowControls(true);
    scheduleControlsHide();
  }

  useEffect(() => {
    return () => {
      clearControlsTimer();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    setDuration(propDuration ?? 0);
    setCurrentTime(0);
    setBufferedProgress(0);
    setBufferAhead(0);
    setBandwidthEstimate(null);
    setDroppedFrames(null);
    setQualityOptions([{ value: "auto", label: "Auto" }]);
    setActiveQualityLabel(null);
    setPlayerNotice(null);
    setUsingAdaptiveStream(false);
    setQualityMode("auto");

    hlsRef.current?.destroy();
    hlsRef.current = null;
    video.pause();
    setPlaying(false);
    video.removeAttribute("src");
    video.load();

    if (!src && !directSrc) {
      return;
    }

    if (src?.endsWith(".m3u8")) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          startLevel: -1,
          capLevelToPlayerSize: true,
          maxBufferLength: 30,
          backBufferLength: 90,
        });

        hlsRef.current = hls;
        hls.attachMedia(video);
        setUsingAdaptiveStream(true);

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(src);
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const options = [
            { value: "auto" as const, label: "Auto" },
            ...hls.levels
              .map((level, index) => ({
                value: index,
                label: getLevelLabel(level, index),
              }))
              .reverse(),
          ];

          setQualityOptions(options);
          const highestLevel = Math.max(hls.levels.length - 1, 0);
          hls.startLevel = highestLevel;
          hls.nextAutoLevel = highestLevel;
          setActiveQualityLabel(getLevelLabel(hls.levels[highestLevel] ?? {}, highestLevel));
          setBandwidthEstimate(Number.isFinite(hls.bandwidthEstimate) ? hls.bandwidthEstimate : null);
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
          const level = hls.levels[data.level];
          setActiveQualityLabel(getLevelLabel(level ?? {}, data.level));
          setBandwidthEstimate(Number.isFinite(hls.bandwidthEstimate) ? hls.bandwidthEstimate : null);
        });

        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          setBandwidthEstimate(Number.isFinite(hls.bandwidthEstimate) ? hls.bandwidthEstimate : null);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal) {
            return;
          }

          hls.destroy();
          hlsRef.current = null;
          setUsingAdaptiveStream(false);

          if (directSrc) {
            setPlayerNotice("Adaptive stream recovered to direct source.");
            video.src = directSrc;
            video.load();
            return;
          }

          setPlayerNotice("Adaptive playback failed.");
        });

        return () => {
          hls.destroy();
          hlsRef.current = null;
        };
      }

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        setUsingAdaptiveStream(true);
        video.src = src;
        video.load();
        return;
      }
    }

    const fallbackSource = directSrc ?? src;
    if (fallbackSource) {
      video.src = fallbackSource;
      video.load();
    }
  }, [src, directSrc, propDuration]);

  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls) {
      return;
    }

    if (qualityMode === "auto") {
      const highestLevel = Math.max(hls.levels.length - 1, 0);
      hls.currentLevel = -1;
      hls.startLevel = highestLevel;
      hls.nextAutoLevel = highestLevel;
      return;
    }

    hls.nextLevel = qualityMode;
  }, [qualityMode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const updateBuffered = () => {
      const bufferedEnd = video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0;
      const nextBufferedProgress = duration > 0 ? (bufferedEnd / duration) * 100 : 0;
      setBufferedProgress(nextBufferedProgress);
      setBufferAhead(Math.max(0, bufferedEnd - video.currentTime));
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      updateBuffered();
    };

    const onLoadedMetadata = () => {
      setDuration(video.duration || propDuration || 0);
      updateBuffered();
    };

    const onProgress = () => updateBuffered();
    const onPlay = () => {
      setPlaying(true);
      scheduleControlsHide();
    };
    const onPause = () => {
      setPlaying(false);
      setShowControls(true);
      clearControlsTimer();
    };
    const onEnded = () => {
      setPlaying(false);
      setShowControls(true);
      clearControlsTimer();
    };
    const onVolumeChange = () => {
      setMuted(video.muted || video.volume === 0);
      setVolume(video.volume);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("progress", onProgress);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("volumechange", onVolumeChange);

    const metricsInterval = window.setInterval(() => {
      const quality = video.getVideoPlaybackQuality?.();
      if (quality) {
        setDroppedFrames(quality.droppedVideoFrames);
      }

      const hls = hlsRef.current;
      if (hls && Number.isFinite(hls.bandwidthEstimate)) {
        setBandwidthEstimate(hls.bandwidthEstimate);
      }
    }, 1000);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("volumechange", onVolumeChange);
      window.clearInterval(metricsInterval);
    };
  }, [duration, propDuration, playing]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          event.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
          seek(-5);
          break;
        case "arrowright":
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
  });

  function togglePlay() {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }

  function seek(delta: number) {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + delta));
  }

  function seekTo(time: number) {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.currentTime = Math.max(0, Math.min(duration, time));
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) {
      video.volume = 1;
    }
  }

  function handleVolumeChange(nextVolume: number) {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.volume = nextVolume;
    video.muted = nextVolume === 0;
    setVolume(nextVolume);
    setMuted(nextVolume === 0);
  }

  function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    void container.requestFullscreen();
  }

  function applyPlaybackRate(nextRate: number) {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.playbackRate = nextRate;
    setPlaybackRate(nextRate);
    setSpeedMenuOpen(false);
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const selectedQualityLabel =
    qualityMode === "auto" ? `Auto${activeQualityLabel ? ` · ${activeQualityLabel}` : ""}` : activeQualityLabel;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl border border-border-subtle bg-black shadow-[0_18px_70px_rgba(0,0,0,0.45)]"
      onMouseMove={surfaceControls}
      onMouseLeave={() => playing && setShowControls(false)}
      onTouchStart={surfaceControls}
    >
      {src || directSrc ? (
        <video
          ref={videoRef}
          poster={poster}
          className="aspect-video w-full bg-black"
          onClick={togglePlay}
          playsInline
        />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-surface-1">
          <div className="text-center">
            <Play className="mx-auto mb-3 h-16 w-16 text-text-disabled" />
            <p className="text-sm text-text-muted">No video source</p>
            <p className="mt-1 text-xs text-text-disabled">Video playback will appear here</p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/75 via-black/30 to-transparent px-4 pb-12 pt-4">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/75">
            {usingAdaptiveStream ? "Adaptive HLS" : "Direct"}
          </span>
          {selectedQualityLabel && (
            <span className="rounded-full border border-accent-500/25 bg-accent-500/12 px-2.5 py-1 text-[0.7rem] font-medium text-accent-100">
              {selectedQualityLabel}
            </span>
          )}
          {playerNotice && (
            <span className="rounded-full border border-warning/20 bg-black/50 px-2.5 py-1 text-[0.7rem] text-white/80">
              {playerNotice}
            </span>
          )}
        </div>

        <div className="grid min-w-[184px] grid-cols-3 gap-2 text-right text-[0.68rem] text-white/70">
          <MetricChip icon={<Wifi className="h-3.5 w-3.5" />} label="ABR" value={formatBandwidth(bandwidthEstimate)} />
          <MetricChip icon={<Gauge className="h-3.5 w-3.5" />} label="Buffer" value={`${bufferAhead.toFixed(1)}s`} />
          <MetricChip icon={<Settings2 className="h-3.5 w-3.5" />} label="Drop" value={droppedFrames == null ? "—" : String(droppedFrames)} />
        </div>
      </div>

      {!playing && (src || directSrc) && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/10"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-[0_0_32px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <Play className="ml-1 h-8 w-8" fill="currentColor" />
          </span>
        </button>
      )}

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/92 via-black/65 to-transparent px-4 pb-4 pt-20 transition-opacity duration-normal",
          showControls ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div className="mb-3 space-y-2">
          <div
            className="relative h-2.5 w-full cursor-pointer overflow-hidden rounded-full bg-white/14"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const nextPercent = (event.clientX - rect.left) / rect.width;
              seekTo(nextPercent * duration);
            }}
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/15" style={{ width: `${bufferedProgress}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-accent-500" style={{ width: `${progress}%` }} />
            {markers.map((marker) => {
              const markerPercent = duration > 0 ? (marker.time / duration) * 100 : 0;
              return (
                <button
                  key={marker.id}
                  type="button"
                  className="absolute top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-sm bg-accent-200/90 transition-colors hover:bg-white"
                  style={{ left: `${markerPercent}%` }}
                  onClick={(event) => {
                    event.stopPropagation();
                    seekTo(marker.time);
                    onMarkerClick?.(marker);
                  }}
                  title={marker.title}
                />
              );
            })}
          </div>

          {markers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {markers.slice(0, 4).map((marker) => (
                <button
                  key={marker.id}
                  type="button"
                  onClick={() => {
                    seekTo(marker.time);
                    onMarkerClick?.(marker);
                  }}
                  className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[0.68rem] text-white/72 transition-colors hover:border-accent-400/35 hover:text-white"
                >
                  {marker.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => seek(-10)}
              className="text-white/70 transition-colors hover:text-white"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-500 text-accent-950 transition-colors hover:bg-accent-400"
            >
              {playing ? (
                <Pause className="h-4 w-4" fill="currentColor" />
              ) : (
                <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
              )}
            </button>
            <button
              type="button"
              onClick={() => seek(10)}
              className="text-white/70 transition-colors hover:text-white"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 text-white/80">
              <button type="button" onClick={toggleMute} className="transition-colors hover:text-white">
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                aria-label="Volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={(event) => handleVolumeChange(Number(event.target.value))}
                className="h-1.5 w-20 accent-accent-500"
              />
            </div>

            <span className="text-xs text-white/80">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setQualityMenuOpen((open) => !open);
                  setSpeedMenuOpen(false);
                }}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[0.72rem] text-white/82 transition-colors hover:border-white/20 hover:text-white"
              >
                {selectedQualityLabel ?? "Quality"}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {qualityMenuOpen && (
                <div className="absolute bottom-12 right-0 min-w-[140px] rounded-lg border border-white/10 bg-black/92 p-1 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur">
                  {qualityOptions.map((option) => (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() => {
                        setQualityMode(option.value);
                        setQualityMenuOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                        qualityMode === option.value
                          ? "bg-accent-500/18 text-accent-100"
                          : "text-white/78 hover:bg-white/8 hover:text-white"
                      )}
                    >
                      <span>{option.label}</span>
                      {qualityMode === option.value && <span className="text-[0.68rem] uppercase tracking-[0.16em]">On</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setSpeedMenuOpen((open) => !open);
                  setQualityMenuOpen(false);
                }}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[0.72rem] text-white/82 transition-colors hover:border-white/20 hover:text-white"
              >
                {playbackRate}x
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {speedMenuOpen && (
                <div className="absolute bottom-12 right-0 min-w-[112px] rounded-lg border border-white/10 bg-black/92 p-1 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur">
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => applyPlaybackRate(rate)}
                      className={cn(
                        "block w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                        playbackRate === rate
                          ? "bg-accent-500/18 text-accent-100"
                          : "text-white/78 hover:bg-white/8 hover:text-white"
                      )}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-full border border-white/10 bg-white/6 p-2 text-white/80 transition-colors hover:border-white/20 hover:text-white"
            >
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="pointer-events-none rounded-lg border border-white/8 bg-black/30 px-2 py-1.5 backdrop-blur-sm">
      <div className="mb-0.5 flex items-center justify-end gap-1 text-white/50">
        {icon}
        <span className="text-[0.58rem] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <div className="truncate text-[0.72rem] font-medium text-white/88">{value}</div>
    </div>
  );
}
