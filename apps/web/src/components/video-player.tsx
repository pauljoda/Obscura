"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type Hls from "hls.js";
import {
  Captions,
  ChevronDown,
  Gauge,
  Loader2,
  Maximize,
  Pause,
  Play,
  Settings2,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Wifi,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import {
  enterMediaFullscreen,
  exitDocumentFullscreen,
  isDocumentFullscreen,
} from "../lib/fullscreen";
import { FilmStrip } from "./film-strip";
import type { SceneSubtitleTrackDto } from "../lib/api/types";

interface Marker {
  id: string;
  time: number;
  title: string;
}

export interface VideoPlayerHandle {
  seekTo: (time: number) => void;
}

export interface ActiveCue {
  start: number;
  end: number;
  text: string;
}

interface VideoPlayerProps {
  src?: string;
  directSrc?: string;
  poster?: string;
  markers?: Marker[];
  duration?: number;
  onMarkerClick?: (marker: Marker) => void;
  onPlayStarted?: () => void;
  onTimeUpdate?: (time: number) => void;
  trickplaySprite?: string;
  trickplayVtt?: string;
  subtitleTracks?: SceneSubtitleTrackDto[];
  activeSubtitleTrackId?: string | null;
  onActiveSubtitleTrackIdChange?: (id: string | null) => void;
  onActiveCueChange?: (cue: ActiveCue | null) => void;
  subtitleAssetBase?: string;
}

function languageLabel(language: string): string {
  if (!language || language === "und") return "Unknown";
  try {
    const dn = new Intl.DisplayNames(undefined, { type: "language" });
    return dn.of(language) ?? language.toUpperCase();
  } catch {
    return language.toUpperCase();
  }
}

type QualityMode = "auto" | "direct" | number;

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

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer(
  {
    src,
    directSrc,
    poster,
    markers = [],
    duration: propDuration,
    onMarkerClick,
    onPlayStarted,
    onTimeUpdate,
    trickplaySprite,
    trickplayVtt,
    subtitleTracks = [],
    activeSubtitleTrackId: controlledSubtitleId,
    onActiveSubtitleTrackIdChange,
    onActiveCueChange,
    subtitleAssetBase,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const playTrackedRef = useRef(false);
  const isDraggingRef = useRef(false);
  // Track last-seen src/directSrc to distinguish "new video loaded" from
  // "user changed quality mode" when the source effect re-runs.
  const prevSrcKeyRef = useRef<string>("");
  // Capture playback state before a quality-mode teardown so we can restore
  // position and resume playing once the new mode is initialised.
  const pendingAutoPlayRef = useRef(false);
  const pendingSeekTimeRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(propDuration ?? 0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [qualityMode, setQualityMode] = useState<QualityMode>("direct");
  const [streamMode, setStreamMode] = useState<"direct" | "hls">("direct");
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([
    { value: "direct", label: "Direct" },
  ]);
  const [activeQualityLabel, setActiveQualityLabel] = useState<string | null>(null);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [bufferAhead, setBufferAhead] = useState(0);
  const [bandwidthEstimate, setBandwidthEstimate] = useState<number | null>(null);
  const [droppedFrames, setDroppedFrames] = useState<number | null>(null);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [timelineHover, setTimelineHover] = useState<{
    markerTitles: string[];
    percent: number;
    time: number;
  } | null>(null);
  const [usingAdaptiveStream, setUsingAdaptiveStream] = useState(false);
  const [playerNotice, setPlayerNotice] = useState<string | null>(null);
  const [hlsInitializing, setHlsInitializing] = useState(false);
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);
  const [internalSubtitleId, setInternalSubtitleId] = useState<string | null>(null);
  const [activeCueText, setActiveCueText] = useState<string | null>(null);

  const activeSubtitleId =
    controlledSubtitleId !== undefined ? controlledSubtitleId : internalSubtitleId;

  function selectSubtitle(id: string | null) {
    if (controlledSubtitleId === undefined) {
      setInternalSubtitleId(id);
    }
    onActiveSubtitleTrackIdChange?.(id);
    setSubtitleMenuOpen(false);
  }

  useImperativeHandle(
    ref,
    () => ({
      seekTo(time: number) {
        const video = videoRef.current;
        if (!video) return;
        const dur = duration || video.duration || 0;
        video.currentTime = Math.max(0, Math.min(dur || time, time));
      },
    }),
    [duration],
  );

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

    let cancelled = false;

    const srcKey = `${src ?? ""}|${directSrc ?? ""}`;
    const isNewSource = srcKey !== prevSrcKeyRef.current;
    prevSrcKeyRef.current = srcKey;

    // For a brand-new video always start in the default mode (direct when
    // a directSrc is available) regardless of where the previous video left off.
    // For a quality switch keep the mode the user selected.
    const effectiveMode: "direct" | "hls" = isNewSource
      ? (directSrc ? "direct" : "hls")
      : streamMode;

    if (isNewSource) {
      setDuration(propDuration ?? 0);
      setCurrentTime(0);
      setBufferedProgress(0);
      setBufferAhead(0);
      setBandwidthEstimate(null);
      setDroppedFrames(null);
      setQualityMode(effectiveMode === "direct" ? "direct" : "auto");
      setStreamMode(effectiveMode);
      setQualityOptions(
        directSrc
          ? [{ value: "direct" as const, label: "Direct" }, { value: "auto" as const, label: "Auto" }]
          : [{ value: "auto" as const, label: "Auto" }],
      );
      setActiveQualityLabel(null);
      setPlayerNotice(null);
      setUsingAdaptiveStream(false);
      setHlsInitializing(false);
      pendingAutoPlayRef.current = false;
      pendingSeekTimeRef.current = null;
    } else {
      // Quality switch — capture position and play state so we can restore
      // them seamlessly once the new mode has initialised.
      pendingSeekTimeRef.current = video.currentTime > 0.5 ? video.currentTime : null;
      pendingAutoPlayRef.current = !video.paused;
    }

    const destroyHls = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };

    destroyHls();
    video.pause();
    setPlaying(false);
    video.removeAttribute("src");
    video.load();

    if (!src && !directSrc) {
      setHlsInitializing(false);
      return;
    }

    // ─── Direct mode ──────────────────────────────────────────────────────
    if (effectiveMode === "direct") {
      setHlsInitializing(false);
      setUsingAdaptiveStream(false);
      const directSource = directSrc ?? src;
      if (directSource) {
        video.src = directSource;
        video.load();

        const seekTime = pendingSeekTimeRef.current;
        const shouldPlay = pendingAutoPlayRef.current;
        if (seekTime !== null || shouldPlay) {
          pendingSeekTimeRef.current = null;
          pendingAutoPlayRef.current = false;
          // Wait for metadata before seeking; then resume playing if needed.
          const onReady = () => {
            if (seekTime !== null) video.currentTime = seekTime;
            if (shouldPlay) void video.play();
          };
          video.addEventListener("loadedmetadata", onReady, { once: true });
        }
      }
      return;
    }

    // ─── HLS / adaptive mode ──────────────────────────────────────────────
    if (src?.endsWith(".m3u8")) {
      setHlsInitializing(true);

      void (async () => {
        const { default: Hls } = await import("hls.js");
        if (cancelled) {
          return;
        }

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
            setHlsInitializing(false);

            const hlsLevels = hls.levels
              .map((level, index) => ({
                value: index,
                label: getLevelLabel(level, index),
              }))
              .reverse();

            const options: QualityOption[] = [
              ...(directSrc ? [{ value: "direct" as const, label: "Direct" }] : []),
              { value: "auto" as const, label: "Auto" },
              ...hlsLevels,
            ];

            setQualityOptions(options);
            const highestLevel = Math.max(hls.levels.length - 1, 0);
            hls.startLevel = highestLevel;
            hls.nextAutoLevel = highestLevel;
            setActiveQualityLabel(getLevelLabel(hls.levels[highestLevel] ?? {}, highestLevel));
            setBandwidthEstimate(
              Number.isFinite(hls.bandwidthEstimate) ? hls.bandwidthEstimate : null,
            );

            // Restore playback state captured before teardown.
            const seekTime = pendingSeekTimeRef.current;
            const shouldPlay = pendingAutoPlayRef.current;
            pendingSeekTimeRef.current = null;
            pendingAutoPlayRef.current = false;
            if (seekTime !== null) {
              video.currentTime = seekTime;
            }
            if (shouldPlay) {
              void video.play();
            }
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
            const level = hls.levels[data.level];
            setActiveQualityLabel(getLevelLabel(level ?? {}, data.level));
            setBandwidthEstimate(
              Number.isFinite(hls.bandwidthEstimate) ? hls.bandwidthEstimate : null,
            );
          });

          hls.on(Hls.Events.FRAG_BUFFERED, () => {
            setBandwidthEstimate(
              Number.isFinite(hls.bandwidthEstimate) ? hls.bandwidthEstimate : null,
            );
          });

          hls.on(Hls.Events.ERROR, (_, data) => {
            if (!data.fatal) {
              return;
            }

            hls.destroy();
            hlsRef.current = null;
            setUsingAdaptiveStream(false);
            setHlsInitializing(false);
            pendingAutoPlayRef.current = false;
            pendingSeekTimeRef.current = null;

            if (directSrc) {
              setQualityMode("direct");
              setPlayerNotice("Adaptive stream failed — switched to direct.");
              video.src = directSrc;
              video.load();
              return;
            }

            setPlayerNotice("Adaptive playback failed.");
          });

          return;
        }

        // Native HLS (Safari)
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          setHlsInitializing(false);
          setUsingAdaptiveStream(true);
          video.src = src;
          video.load();

          const seekTime = pendingSeekTimeRef.current;
          const shouldPlay = pendingAutoPlayRef.current;
          if (seekTime !== null || shouldPlay) {
            pendingSeekTimeRef.current = null;
            pendingAutoPlayRef.current = false;
            const onReady = () => {
              if (seekTime !== null) video.currentTime = seekTime;
              if (shouldPlay) void video.play();
            };
            video.addEventListener("loadedmetadata", onReady, { once: true });
          }
          return;
        }

        // Browser can't play HLS at all — fall back to direct
        setHlsInitializing(false);
        const fallbackSource = directSrc ?? src;
        if (fallbackSource) {
          video.src = fallbackSource;
          video.load();
        }
      })();

      return () => {
        cancelled = true;
        destroyHls();
      };
    }

    // Non-HLS fallback in adaptive mode
    setHlsInitializing(false);
    const fallbackSource = directSrc ?? src;
    if (fallbackSource) {
      video.src = fallbackSource;
      video.load();
    }

    return () => {
      cancelled = true;
      destroyHls();
    };
  }, [src, directSrc, propDuration, streamMode]);

  // Sync streamMode from qualityMode — only triggers source re-init when
  // switching between direct and adaptive (not when changing HLS levels)
  useEffect(() => {
    setStreamMode(qualityMode === "direct" ? "direct" : "hls");
  }, [qualityMode]);

  useEffect(() => {
    if (qualityMode === "direct") {
      return;
    }

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

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
      updateBuffered();
    };

    const onLoadedMetadata = () => {
      setDuration(video.duration || propDuration || 0);
      updateBuffered();
      onTimeUpdate?.(video.currentTime);
    };

    const onSeeked = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };

    const onProgress = () => updateBuffered();
    const onPlay = () => {
      setPlaying(true);
      scheduleControlsHide();
      if (playTrackedRef.current === false) {
        playTrackedRef.current = true;
        onPlayStarted?.();
      }
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

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("progress", onProgress);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("volumechange", onVolumeChange);

    // Fire initial time in case metadata is already loaded
    onTimeUpdate?.(video.currentTime);

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
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("seeked", onSeeked);
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
          event.preventDefault();
          togglePlay();
          break;
        case "k":
          if (event.metaKey || event.ctrlKey) break;
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

  // ─── Subtitle track mode management ────────────────────────────
  // Keep all <track> elements in "hidden" mode for the selected one (so the
  // browser parses cues but doesn't draw them — we render our own overlay)
  // and "disabled" for every other track.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const apply = () => {
      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        if (!t) continue;
        // Skip trickplay/metadata tracks — we only touch subtitles.
        if (t.kind !== "subtitles" && t.kind !== "captions") continue;
        const matches =
          (t.id && t.id === activeSubtitleId) ||
          (!t.id && t.label && subtitleTracks.find((s) => s.id === activeSubtitleId)?.label === t.label);
        t.mode = matches ? "hidden" : "disabled";
      }
    };

    apply();
    // textTracks can be populated async after the <track> element mounts —
    // re-apply on addtrack as well.
    const tracks = video.textTracks;
    tracks.addEventListener?.("addtrack", apply);
    return () => {
      tracks.removeEventListener?.("addtrack", apply);
    };
  }, [activeSubtitleId, subtitleTracks]);

  // Subscribe to cuechange on the active (hidden) track and surface the cue
  // text for the overlay + transcript sync.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSubtitleId) {
      setActiveCueText(null);
      onActiveCueChange?.(null);
      return;
    }

    let cleanupFn: (() => void) | null = null;

    const attach = () => {
      const tracks = video.textTracks;
      let target: TextTrack | null = null;
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        if (!t) continue;
        if (t.kind !== "subtitles" && t.kind !== "captions") continue;
        if (t.id && t.id === activeSubtitleId) {
          target = t;
          break;
        }
      }
      if (!target) return;

      const handler = () => {
        const active = target!.activeCues;
        if (!active || active.length === 0) {
          setActiveCueText(null);
          onActiveCueChange?.(null);
          return;
        }
        const first = active[0] as VTTCue;
        const text = (first.text ?? "").replace(/<[^>]+>/g, "");
        setActiveCueText(text || null);
        onActiveCueChange?.({
          start: first.startTime,
          end: first.endTime,
          text,
        });
      };

      target.addEventListener("cuechange", handler);
      handler();
      cleanupFn = () => target!.removeEventListener("cuechange", handler);
    };

    attach();
    // Textract may attach late.
    const tracks = video.textTracks;
    const onAdd = () => {
      cleanupFn?.();
      cleanupFn = null;
      attach();
    };
    tracks.addEventListener?.("addtrack", onAdd);

    return () => {
      tracks.removeEventListener?.("addtrack", onAdd);
      cleanupFn?.();
    };
  }, [activeSubtitleId, onActiveCueChange, src, directSrc]);

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
    const video = videoRef.current;

    if (isDocumentFullscreen()) {
      exitDocumentFullscreen();
      return;
    }

    if (!container) {
      return;
    }

    enterMediaFullscreen(container, video);
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

  function updateTimelineHover(clientX: number, rect: DOMRect) {
    if (duration <= 0) {
      setTimelineHover(null);
      return;
    }

    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = percent * duration;
    const markerWindowSeconds = Math.max(duration * 0.01, 1.5);
    const markerTitles = markers
      .filter((marker) => Math.abs(marker.time - time) <= markerWindowSeconds)
      .map((marker) => marker.title);

    setTimelineHover({
      markerTitles,
      percent: percent * 100,
      time,
    });
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const selectedQualityLabel =
    qualityMode === "direct"
      ? "Direct"
      : qualityMode === "auto"
        ? `Auto${activeQualityLabel ? ` · ${activeQualityLabel}` : ""}`
        : activeQualityLabel;

  const hasFilmStrip = Boolean(trickplaySprite && trickplayVtt && duration > 0);

  function handleFilmStripInteraction(active: boolean) {
    if (active) {
      clearControlsTimer();
      setShowControls(false);
      setQualityMenuOpen(false);
      setSpeedMenuOpen(false);
    } else {
      surfaceControls();
    }
  }

  return (
    <div className="space-y-1">
    <div
      ref={containerRef}
      className="relative surface-media-well"
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
          crossOrigin="anonymous"
        >
          {subtitleTracks.map((track) => {
            const href = subtitleAssetBase
              ? `${subtitleAssetBase}${track.url}`
              : track.url;
            return (
              <track
                key={track.id}
                id={track.id}
                kind="subtitles"
                src={href}
                srcLang={track.language === "und" ? undefined : track.language}
                label={track.label ?? languageLabel(track.language)}
              />
            );
          })}
        </video>
      ) : (
        <div className="flex aspect-video items-center justify-center bg-surface-1">
          <div className="text-center">
            <Play className="mx-auto mb-3 h-16 w-16 text-text-disabled" />
            <p className="text-sm text-text-muted">No video source</p>
            <p className="mt-1 text-xs text-text-disabled">Video playback will appear here</p>
          </div>
        </div>
      )}

      {activeCueText && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4 transition-all duration-normal",
            showControls ? "bottom-[110px] sm:bottom-[128px]" : "bottom-8 sm:bottom-10",
          )}
        >
          <div className="video-caption-overlay max-w-[86%] whitespace-pre-line text-center text-[0.95rem] sm:text-lg font-medium leading-snug text-white">
            {activeCueText}
          </div>
        </div>
      )}

      <div className={cn(
        "pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/75 via-black/30 to-transparent px-3 sm:px-4 pb-8 sm:pb-12 pt-3 sm:pt-4 transition-opacity duration-normal",
        showControls ? "opacity-100" : "opacity-0"
      )}>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {(hlsInitializing || usingAdaptiveStream || qualityMode !== "direct") && (
            <span className="player-chip px-2 sm:px-2.5 py-0.5 sm:py-1 text-[0.6rem] sm:text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/75">
              {hlsInitializing ? "Loading…" : usingAdaptiveStream ? "Adaptive HLS" : "Direct"}
            </span>
          )}
          {selectedQualityLabel && (
            <span className="player-chip-accent px-2 sm:px-2.5 py-0.5 sm:py-1 text-[0.6rem] sm:text-[0.7rem] font-medium text-accent-100">
              {selectedQualityLabel}
            </span>
          )}
          {playerNotice && (
            <span className="player-chip border-warning/20 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[0.6rem] sm:text-[0.7rem] text-white/80">
              {playerNotice}
            </span>
          )}
        </div>

        <div
          className={cn(
            "hidden sm:grid gap-2 text-right text-[0.68rem] text-white/70",
            streamMode === "direct" ? "min-w-[120px] grid-cols-2" : "min-w-[184px] grid-cols-3",
          )}
        >
          {streamMode !== "direct" && (
            <MetricChip icon={<Wifi className="h-3.5 w-3.5" />} label="ABR" value={formatBandwidth(bandwidthEstimate)} />
          )}
          <MetricChip icon={<Gauge className="h-3.5 w-3.5" />} label="Buffer" value={`${bufferAhead.toFixed(1)}s`} />
          <MetricChip icon={<Settings2 className="h-3.5 w-3.5" />} label="Drop" value={droppedFrames == null ? "—" : String(droppedFrames)} />
        </div>
      </div>

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/92 via-black/65 to-transparent px-3 sm:px-4 pb-3 sm:pb-4 pt-12 sm:pt-20 transition-opacity duration-normal",
          showControls ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div className="mb-3 sm:mb-4 space-y-2">
          <div
            className="video-progress-track group/track"
            data-dragging={isDragging}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              isDraggingRef.current = true;
              setIsDragging(true);
              const rect = event.currentTarget.getBoundingClientRect();
              updateTimelineHover(event.clientX, rect);
              const nextPercent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
              seekTo(nextPercent * duration);
            }}
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              updateTimelineHover(event.clientX, rect);
              if (!isDraggingRef.current) return;
              const nextPercent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
              seekTo(nextPercent * duration);
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              isDraggingRef.current = false;
              setIsDragging(false);
            }}
            onPointerCancel={(event) => {
              isDraggingRef.current = false;
              setIsDragging(false);
            }}
            onPointerLeave={() => {
              if (!isDraggingRef.current) {
                setTimelineHover(null);
              }
            }}
          >
            {timelineHover && (
              <div
                className="pointer-events-none absolute bottom-[calc(100%+0.6rem)] z-20 -translate-x-1/2 border border-white/10 bg-black/88 px-2.5 py-1.5 text-center shadow-[0_0_16px_rgba(0,0,0,0.35)]"
                style={{ left: `${timelineHover.percent}%` }}
              >
                <div className="text-mono-tabular text-[0.65rem] text-white/82">
                  {formatTime(timelineHover.time)}
                </div>
                {timelineHover.markerTitles.length > 0 && (
                  <div className="mt-1 max-w-48 text-[0.65rem] font-medium leading-snug text-accent-100">
                    {timelineHover.markerTitles.join(" • ")}
                  </div>
                )}
              </div>
            )}
            <div className="video-progress-buffered" style={{ width: `${bufferedProgress}%` }} />
            <div className="video-progress-fill" style={{ width: `${progress}%` }} />
            {markers.map((marker) => {
              const markerPercent = duration > 0 ? (marker.time / duration) * 100 : 0;
              return (
                <button
                  key={marker.id}
                  type="button"
                  className="absolute top-1/2 h-full w-1 -translate-y-1/2 bg-white/60 transition-all hover:bg-white hover:w-1.5 hover:scale-y-150 z-10"
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
            <div className="hidden sm:flex flex-wrap gap-1.5">
              {markers.map((marker) => (
                <button
                  key={marker.id}
                  type="button"
                  onClick={() => {
                    seekTo(marker.time);
                    onMarkerClick?.(marker);
                  }}
                  className="player-chip px-2.5 py-1 text-[0.68rem] text-white/72 transition-colors hover:border-accent-400/35 hover:text-white"
                >
                  {marker.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={() => seek(-10)}
              className="relative flex items-center justify-center text-white/70 transition-colors hover:text-white"
              title="Skip back 10s"
            >
              <RotateCcw className="h-4 sm:h-[1.125rem] w-4 sm:w-[1.125rem]" />
              <span className="absolute text-[0.45rem] sm:text-[0.5rem] font-bold mt-[1px]">10</span>
            </button>
            <button
              type="button"
              onClick={hlsInitializing ? undefined : togglePlay}
              disabled={hlsInitializing}
              className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center bg-gradient-to-b from-accent-400 to-accent-500 text-accent-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_0_14px_rgba(199,155,92,0.2)] transition-all hover:from-accent-300 hover:to-accent-400 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_20px_rgba(199,155,92,0.28)] disabled:opacity-70 disabled:cursor-wait"
            >
              {hlsInitializing ? (
                <Loader2 className="h-3.5 sm:h-4 w-3.5 sm:w-4 animate-spin" />
              ) : playing ? (
                <Pause className="h-3.5 sm:h-4 w-3.5 sm:w-4" fill="currentColor" />
              ) : (
                <Play className="ml-0.5 h-3.5 sm:h-4 w-3.5 sm:w-4" fill="currentColor" />
              )}
            </button>
            <button
              type="button"
              onClick={() => seek(10)}
              className="relative flex items-center justify-center text-white/70 transition-colors hover:text-white"
              title="Skip forward 10s"
            >
              <RotateCw className="h-4 sm:h-[1.125rem] w-4 sm:w-[1.125rem]" />
              <span className="absolute text-[0.45rem] sm:text-[0.5rem] font-bold mt-[1px]">10</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 text-white/80">
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

            <span className="text-mono-tabular text-glow-phosphor text-[0.68rem] sm:text-xs">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {subtitleTracks.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setSubtitleMenuOpen((open) => !open);
                    setQualityMenuOpen(false);
                    setSpeedMenuOpen(false);
                  }}
                  aria-label="Subtitles"
                  className={cn(
                    "player-chip flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[0.65rem] sm:text-[0.72rem] transition-colors hover:border-white/20 hover:text-white",
                    activeSubtitleId ? "text-accent-100" : "text-white/82",
                  )}
                >
                  <Captions className="h-3.5 w-3.5" />
                  <ChevronDown className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                </button>
                {subtitleMenuOpen && (
                  <div className="absolute bottom-10 sm:bottom-12 right-0 min-w-[180px] player-dropdown p-1">
                    <button
                      type="button"
                      onClick={() => selectSubtitle(null)}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm transition-colors",
                        !activeSubtitleId
                          ? "bg-accent-500/18 text-accent-100"
                          : "text-white/78 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <span>Off</span>
                      {!activeSubtitleId && (
                        <span className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.16em]">On</span>
                      )}
                    </button>
                    {subtitleTracks.map((track) => {
                      const isActive = activeSubtitleId === track.id;
                      const displayName =
                        track.label ?? languageLabel(track.language);
                      return (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() => selectSubtitle(track.id)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm transition-colors",
                            isActive
                              ? "bg-accent-500/18 text-accent-100"
                              : "text-white/78 hover:bg-white/8 hover:text-white",
                          )}
                        >
                          <span className="truncate">{displayName}</span>
                          <span className="text-[0.55rem] sm:text-[0.6rem] uppercase tracking-[0.16em] text-white/50">
                            {track.source}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setQualityMenuOpen((open) => !open);
                  setSpeedMenuOpen(false);
                  setSubtitleMenuOpen(false);
                }}
                className="player-chip flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[0.65rem] sm:text-[0.72rem] text-white/82 transition-colors hover:border-white/20 hover:text-white"
              >
                {selectedQualityLabel ?? "Quality"}
                <ChevronDown className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
              </button>
              {qualityMenuOpen && (
                <div className="absolute bottom-10 sm:bottom-12 right-0 min-w-[120px] sm:min-w-[140px] player-dropdown p-1">
                  {qualityOptions.map((option) => (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() => {
                        setQualityMode(option.value);
                        setQualityMenuOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm transition-colors",
                        qualityMode === option.value
                          ? "bg-accent-500/18 text-accent-100"
                          : "text-white/78 hover:bg-white/8 hover:text-white"
                      )}
                    >
                      <span>{option.label}</span>
                      {qualityMode === option.value && <span className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.16em]">On</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => {
                  setSpeedMenuOpen((open) => !open);
                  setQualityMenuOpen(false);
                }}
                className="player-chip flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] text-white/82 transition-colors hover:border-white/20 hover:text-white"
              >
                {playbackRate}x
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {speedMenuOpen && (
                <div className="absolute bottom-12 right-0 min-w-[112px] player-dropdown p-1">
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => applyPlaybackRate(rate)}
                      className={cn(
                        "block w-full px-3 py-2 text-left text-sm transition-colors",
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
              className="player-chip p-1.5 sm:p-2 text-white/80 transition-colors hover:border-white/20 hover:text-white"
            >
              <Maximize className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
    {hasFilmStrip && (
      <div className="border border-border-subtle bg-black overflow-hidden">
        <FilmStrip
          spriteUrl={trickplaySprite!}
          vttUrl={trickplayVtt!}
          videoRef={videoRef}
          duration={duration}
          onSeek={seekTo}
          markers={markers}
          onStripInteractionChange={handleFilmStripInteraction}
        />
      </div>
    )}
    </div>
  );
});

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
    <div className="pointer-events-none player-chip px-2 py-1.5">
      <div className="mb-0.5 flex items-center justify-end gap-1 text-white/50">
        {icon}
        <span className="text-[0.58rem] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <div className="truncate text-mono-tabular text-glow-phosphor text-[0.72rem] font-medium">{value}</div>
    </div>
  );
}
