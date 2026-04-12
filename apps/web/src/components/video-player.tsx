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
  Sliders,
  Volume2,
  VolumeX,
  Wifi,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { HlsRendition, HlsStatus, SubtitleAppearance } from "@obscura/contracts";
import {
  enterMediaFullscreen,
  exitDocumentFullscreen,
  isDocumentFullscreen,
} from "../lib/fullscreen";
import { FilmStrip } from "./film-strip";
import { AssSubtitleOverlay } from "./ass-subtitle-overlay";
import { fetchSceneSubtitleCues } from "../lib/api/media";
import type { SceneSubtitleTrackDto, SubtitleCueDto } from "../lib/api/types";
import {
  captionClassName,
  pickPreferredSubtitleTrack,
  readLocalSubtitleAppearance,
  resolveSubtitleAppearance,
  writeLocalSubtitleAppearance,
} from "../lib/subtitle-appearance";
import { SubtitleSettingsPanel } from "./subtitle-settings-panel";

function isAssTrackActive(
  activeSubtitleId: string | null | undefined,
  tracks: readonly SceneSubtitleTrackDto[],
): boolean {
  if (!activeSubtitleId) return false;
  const track = tracks.find((t) => t.id === activeSubtitleId);
  if (!track) return false;
  return (
    (track.sourceFormat === "ass" || track.sourceFormat === "ssa") &&
    !!track.sourceUrl
  );
}

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
  /** When true, parent has already decided the subtitle state (including
   *  an explicit "Off") — the player will not run its library-default
   *  auto-enable pass. */
  subtitleChoiceLocked?: boolean;
  /** Library-level defaults from /settings/library (auto-enable, lang prefs, style). */
  subtitleDefaults?: {
    autoEnable: boolean;
    preferredLanguages: string;
    appearance: SubtitleAppearance;
  };
  /** Default playback mode from library settings. User can still override. */
  defaultPlaybackMode?: "direct" | "hls";
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

type QualityMode = "auto" | "direct" | number | `seed:${string}`;

interface QualityOption {
  value: QualityMode;
  label: string;
}

function hlsStatusUrlForSrc(src: string): string | null {
  if (!src.endsWith("/master.m3u8")) return null;
  // Virtual HLS (per-segment on-demand) has no /status endpoint — the
  // playlist is static and covers the full scene from the first request,
  // so there's nothing to wait on before handing the URL to hls.js.
  if (/\/hls2\/master\.m3u8$/.test(src)) return null;
  return src.replace(/\/master\.m3u8(\?.*)?$/, "/status$1");
}

async function fetchHlsStatus(statusUrl: string, signal?: AbortSignal): Promise<HlsStatus | null> {
  try {
    const res = await fetch(statusUrl, { signal, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as HlsStatus;
  } catch {
    return null;
  }
}

async function waitForHlsReady(
  statusUrl: string,
  signal: AbortSignal,
  opts: { intervalMs?: number; maxAttempts?: number } = {}
): Promise<HlsStatus> {
  const interval = opts.intervalMs ?? 2000;
  const max = opts.maxAttempts ?? 450; // 15 minutes at 2s
  for (let i = 0; i < max; i += 1) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const status = await fetchHlsStatus(statusUrl, signal);
    if (!status) {
      await new Promise((r) => setTimeout(r, interval));
      continue;
    }
    if (status.state === "ready") return status;
    if (status.state === "error") {
      throw new Error(status.error ?? "HLS generation failed");
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Timed out waiting for HLS package");
}

function renditionsToQualityOptions(
  renditions: HlsRendition[],
  directAvailable: boolean,
): QualityOption[] {
  return [
    ...(directAvailable ? [{ value: "direct" as const, label: "Direct" }] : []),
    { value: "auto" as const, label: "Auto" },
    // Highest-first display ordering.
    ...renditions
      .slice()
      .sort((a, b) => b.height - a.height)
      .map<QualityOption>((r) => ({
        value: `seed:${r.name}` as const,
        label: r.label,
      })),
  ];
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
    subtitleChoiceLocked = false,
    subtitleDefaults,
    defaultPlaybackMode,
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
  // When the user picks a pre-seeded rendition (from /hls/status) before
  // hls.js has loaded the manifest, we stash the target rendition name here
  // and reconcile it to the real level index once MANIFEST_PARSED fires.
  const pendingSeedNameRef = useRef<string | null>(null);
  const seededRenditionsRef = useRef<HlsRendition[]>([]);
  const qualityModeRef = useRef<QualityMode>("direct");

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
  /** When the user scrubs past the seekable range in progressive HLS, we
   * remember the desired target here and re-seek once the playlist grows
   * to cover it. */
  const [deferredSeekTarget, setDeferredSeekTarget] = useState<number | null>(null);
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);
  const [internalSubtitleId, setInternalSubtitleId] = useState<string | null>(null);
  const [activeCueText, setActiveCueText] = useState<string | null>(null);
  const [subtitleSettingsOpen, setSubtitleSettingsOpen] = useState(false);
  const [localAppearance, setLocalAppearance] = useState<
    Partial<SubtitleAppearance> | null
  >(null);
  const autoSelectedRef = useRef(false);

  // Read local appearance override on mount (client-only).
  useEffect(() => {
    setLocalAppearance(readLocalSubtitleAppearance());
  }, []);

  const appearance = resolveSubtitleAppearance(
    subtitleDefaults?.appearance ?? null,
    localAppearance,
  );

  const activeSubtitleId =
    controlledSubtitleId !== undefined ? controlledSubtitleId : internalSubtitleId;

  function selectSubtitle(id: string | null) {
    if (controlledSubtitleId === undefined) {
      setInternalSubtitleId(id);
    }
    onActiveSubtitleTrackIdChange?.(id);
    setSubtitleMenuOpen(false);
  }

  // Auto-enable a track on first load when the library says so and the
  // controlled parent hasn't already made a choice. Runs at most once per
  // player instance — once a choice exists (including explicit "Off"),
  // this never fires again.
  useEffect(() => {
    if (autoSelectedRef.current) return;
    // Parent owns subtitle state and has already decided — respect it.
    if (subtitleChoiceLocked) {
      autoSelectedRef.current = true;
      return;
    }
    // Parent explicitly picked a non-null track — lock in and stop.
    if (controlledSubtitleId !== undefined && controlledSubtitleId !== null) {
      autoSelectedRef.current = true;
      return;
    }
    if (!subtitleDefaults?.autoEnable || subtitleTracks.length === 0) return;
    const picked = pickPreferredSubtitleTrack(
      subtitleTracks.map((t) => ({ id: t.id, language: t.language })),
      subtitleDefaults.preferredLanguages,
    );
    if (picked) {
      autoSelectedRef.current = true;
      selectSubtitle(picked);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    subtitleTracks,
    subtitleDefaults?.autoEnable,
    subtitleDefaults?.preferredLanguages,
    subtitleChoiceLocked,
  ]);

  function handleAppearanceChange(next: SubtitleAppearance) {
    setLocalAppearance(next);
    writeLocalSubtitleAppearance(next);
  }

  function handleAppearanceReset() {
    setLocalAppearance(null);
    writeLocalSubtitleAppearance(null);
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

  // Fetch the HLS status endpoint when the source changes so we can seed the
  // quality menu with real rendition labels even before hls.js has parsed the
  // manifest. This also kicks the backend into starting ffmpeg early.
  useEffect(() => {
    if (!src) {
      seededRenditionsRef.current = [];
      return;
    }
    const statusUrl = hlsStatusUrlForSrc(src);
    if (!statusUrl) return;

    const controller = new AbortController();
    void (async () => {
      const status = await fetchHlsStatus(statusUrl, controller.signal);
      if (!status || controller.signal.aborted) return;
      seededRenditionsRef.current = status.renditions;
      // Only seed options if the real level list isn't already in place.
      setQualityOptions((current) => {
        const hasRealLevels = current.some((opt) => typeof opt.value === "number");
        if (hasRealLevels) return current;
        return renditionsToQualityOptions(status.renditions, Boolean(directSrc));
      });
    })();

    return () => controller.abort();
  }, [src, directSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    let cancelled = false;
    const hlsLoadAbort = new AbortController();

    const srcKey = `${src ?? ""}|${directSrc ?? ""}`;
    const isNewSource = srcKey !== prevSrcKeyRef.current;
    prevSrcKeyRef.current = srcKey;

    // For a brand-new video pick the default mode from the library setting
    // (falling back to `direct` when a direct source is available, otherwise
    // `hls`). For a quality switch keep the mode the user selected.
    const initialMode: "direct" | "hls" =
      defaultPlaybackMode === "hls" && src
        ? "hls"
        : directSrc
          ? "direct"
          : "hls";
    const effectiveMode: "direct" | "hls" = isNewSource ? initialMode : streamMode;

    if (isNewSource) {
      setDuration(propDuration ?? 0);
      setCurrentTime(0);
      setBufferedProgress(0);
      setBufferAhead(0);
      setBandwidthEstimate(null);
      setDroppedFrames(null);
      setQualityMode(effectiveMode === "direct" ? "direct" : "auto");
      setStreamMode(effectiveMode);
      pendingSeedNameRef.current = null;
      setDeferredSeekTarget(null);
      // Seed from any renditions already fetched by the status effect.
      const seeded = seededRenditionsRef.current;
      if (seeded.length > 0) {
        setQualityOptions(renditionsToQualityOptions(seeded, Boolean(directSrc)));
      } else {
        setQualityOptions(
          directSrc
            ? [{ value: "direct" as const, label: "Direct" }, { value: "auto" as const, label: "Auto" }]
            : [{ value: "auto" as const, label: "Auto" }],
        );
      }
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

        // Wait for the backend to report `ready` before handing the manifest
        // URL to hls.js. Otherwise the master.m3u8 request would hit our 503
        // retry path while ffmpeg is still transcoding and hls.js would trip
        // its own timeouts before the package is available.
        const statusUrl = hlsStatusUrlForSrc(src);
        if (statusUrl) {
          try {
            const ready = await waitForHlsReady(statusUrl, hlsLoadAbort.signal);
            if (!cancelled && ready.renditions.length > 0) {
              seededRenditionsRef.current = ready.renditions;
            }
          } catch (err) {
            if (cancelled || hlsLoadAbort.signal.aborted) return;
            setHlsInitializing(false);
            setUsingAdaptiveStream(false);
            if (directSrc) {
              setQualityMode("direct");
              setPlayerNotice(
                `Adaptive stream unavailable — switched to direct. (${
                  err instanceof Error ? err.message : "unknown error"
                })`,
              );
              video.src = directSrc;
              video.load();
              return;
            }
            setPlayerNotice(
              `Adaptive playback unavailable: ${
                err instanceof Error ? err.message : "unknown error"
              }`,
            );
            return;
          }
        }

        if (cancelled) return;

        if (Hls.isSupported()) {
          const hls = new Hls({
            startLevel: -1,
            capLevelToPlayerSize: true,
            maxBufferLength: 30,
            backBufferLength: 90,
            // Be patient with transient 503s from the status-gated master
            // route so an in-progress transcode doesn't instantly go fatal.
            manifestLoadPolicy: {
              default: {
                maxTimeToFirstByteMs: 20_000,
                maxLoadTimeMs: 60_000,
                timeoutRetry: { maxNumRetry: 4, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
                errorRetry: { maxNumRetry: 8, retryDelayMs: 1000, maxRetryDelayMs: 4000 },
              },
            },
            playlistLoadPolicy: {
              default: {
                maxTimeToFirstByteMs: 20_000,
                maxLoadTimeMs: 60_000,
                timeoutRetry: { maxNumRetry: 4, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
                errorRetry: { maxNumRetry: 8, retryDelayMs: 1000, maxRetryDelayMs: 4000 },
              },
            },
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

            // Reconcile a pre-seeded rendition pick now that we know real
            // level indices. Otherwise, apply the current qualityMode to the
            // freshly-created hls instance (closes the race where the
            // qualityMode effect fired before hlsRef.current was set).
            const seedName = pendingSeedNameRef.current;
            pendingSeedNameRef.current = null;
            if (seedName) {
              const matchIdx = hls.levels.findIndex((lvl, idx) => {
                const label = getLevelLabel(lvl, idx).toLowerCase();
                return label === seedName.toLowerCase();
              });
              if (matchIdx >= 0) {
                hls.currentLevel = matchIdx;
                hls.nextLevel = matchIdx;
                setQualityMode(matchIdx);
                setActiveQualityLabel(getLevelLabel(hls.levels[matchIdx] ?? {}, matchIdx));
              } else {
                hls.currentLevel = -1;
                hls.nextAutoLevel = highestLevel;
                setQualityMode("auto");
                setActiveQualityLabel(getLevelLabel(hls.levels[highestLevel] ?? {}, highestLevel));
              }
            } else if (typeof qualityModeRef.current === "number") {
              const target = qualityModeRef.current as number;
              hls.currentLevel = target;
              hls.nextLevel = target;
              setActiveQualityLabel(getLevelLabel(hls.levels[target] ?? {}, target));
            } else {
              hls.currentLevel = -1;
              hls.startLevel = highestLevel;
              hls.nextAutoLevel = highestLevel;
              setActiveQualityLabel(getLevelLabel(hls.levels[highestLevel] ?? {}, highestLevel));
            }

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
        hlsLoadAbort.abort();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, directSrc, propDuration, streamMode, defaultPlaybackMode]);

  // Sync streamMode from qualityMode — only triggers source re-init when
  // switching between direct and adaptive (not when changing HLS levels)
  useEffect(() => {
    qualityModeRef.current = qualityMode;
    setStreamMode(qualityMode === "direct" ? "direct" : "hls");
  }, [qualityMode]);

  useEffect(() => {
    if (qualityMode === "direct") {
      return;
    }

    // Seeded picks can't be applied yet — they'll be reconciled to a real
    // level index inside MANIFEST_PARSED once hls.js has loaded the manifest.
    if (typeof qualityMode === "string" && qualityMode.startsWith("seed:")) {
      pendingSeedNameRef.current = qualityMode.slice(5);
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

    if (typeof qualityMode === "number") {
      // Immediate switch (flushes buffer) — matches user intent when they
      // explicitly pick a quality. `nextLevel` would only swap at the next
      // fragment boundary, making the change feel laggy.
      hls.currentLevel = qualityMode;
      setActiveQualityLabel(getLevelLabel(hls.levels[qualityMode] ?? {}, qualityMode));
    }
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

    // In progressive HLS the EVENT playlist only lists segments ffmpeg has
    // written so far, so `video.duration` on first load is a partial value
    // that grows over time. `propDuration` is the scene's real total from
    // the DB, which is always correct — prefer the larger of the two so
    // the film strip and seek bar are sized for the whole video from the
    // very first frame. We still listen to `durationchange` for the
    // direct-stream case where `propDuration` might be stale.
    const applyDuration = () => {
      const videoDur = Number.isFinite(video.duration) ? video.duration : 0;
      const next = Math.max(videoDur, propDuration ?? 0);
      if (next > 0) setDuration(next);
    };

    const onLoadedMetadata = () => {
      applyDuration();
      updateBuffered();
      onTimeUpdate?.(video.currentTime);
    };

    const onDurationChange = () => {
      applyDuration();
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
    video.addEventListener("durationchange", onDurationChange);
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
      video.removeEventListener("durationchange", onDurationChange);
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

  // ─── Subtitle cue pipeline ─────────────────────────────────────
  // We fetch parsed cues directly from the API instead of relying on
  // <track> elements. The native text-track machinery is unreliable when
  // the media element is backed by an MSE source (hls.js): Chrome won't
  // refetch cues after a source swap, and hls.js's own SubtitleTrack-
  // Controller likes to muck with textTracks[*].mode. Driving the overlay
  // from a plain fetch + timeupdate gives us deterministic behavior in
  // direct, HLS, and mode-switch scenarios.
  const [activeTrackCues, setActiveTrackCues] = useState<SubtitleCueDto[]>([]);
  const activeCuesRef = useRef<SubtitleCueDto[]>([]);
  useEffect(() => {
    activeCuesRef.current = activeTrackCues;
  }, [activeTrackCues]);

  useEffect(() => {
    if (!activeSubtitleId) {
      setActiveTrackCues([]);
      setActiveCueText(null);
      onActiveCueChange?.(null);
      return;
    }
    const track = subtitleTracks.find((t) => t.id === activeSubtitleId);
    if (!track) {
      setActiveTrackCues([]);
      setActiveCueText(null);
      onActiveCueChange?.(null);
      return;
    }

    let cancelled = false;
    fetchSceneSubtitleCues(track.sceneId, track.id)
      .then(({ cues }) => {
        if (cancelled) return;
        setActiveTrackCues(cues);
      })
      .catch(() => {
        if (cancelled) return;
        setActiveTrackCues([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSubtitleId, subtitleTracks, onActiveCueChange]);

  // Drive the overlay off the video's timeupdate (plus seeking/seeked so
  // we react instantly to scrubs without waiting for the next ~250ms
  // timeupdate tick). Also re-evaluate whenever the cue set or active
  // track changes so a freshly-loaded cue list renders on the current
  // frame instead of waiting for the next tick.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let lastIndex = -1;
    const evaluate = () => {
      const cues = activeCuesRef.current;
      if (!activeSubtitleId || cues.length === 0) {
        if (lastIndex !== -1) {
          lastIndex = -1;
          setActiveCueText(null);
          onActiveCueChange?.(null);
        }
        return;
      }
      const t = video.currentTime;
      // Linear scan is fine — subtitle cue counts are in the low thousands
      // at most and this runs on timeupdate (~4Hz).
      let idx = -1;
      for (let i = 0; i < cues.length; i++) {
        const cue = cues[i];
        if (!cue) continue;
        if (t >= cue.start && t < cue.end) {
          idx = i;
          break;
        }
      }
      if (idx === lastIndex) return;
      lastIndex = idx;
      if (idx === -1) {
        setActiveCueText(null);
        onActiveCueChange?.(null);
        return;
      }
      const cue = cues[idx]!;
      const text = cue.text.replace(/<[^>]+>/g, "");
      setActiveCueText(text || null);
      onActiveCueChange?.({ start: cue.start, end: cue.end, text });
    };

    evaluate();
    video.addEventListener("timeupdate", evaluate);
    video.addEventListener("seeking", evaluate);
    video.addEventListener("seeked", evaluate);
    return () => {
      video.removeEventListener("timeupdate", evaluate);
      video.removeEventListener("seeking", evaluate);
      video.removeEventListener("seeked", evaluate);
    };
  }, [activeSubtitleId, activeTrackCues, onActiveCueChange]);

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

    const target = Math.max(0, Math.min(duration || time, time));

    // In progressive HLS the variant playlist only lists segments ffmpeg
    // has already produced, so `video.seekable.end` grows over time. If the
    // user scrubs past that boundary, we can't actually seek there yet —
    // jump to the latest available position and remember the intended
    // target. A watcher effect re-seeks once the playlist catches up.
    if (streamMode === "hls" && video.seekable.length > 0) {
      const seekableEnd = video.seekable.end(video.seekable.length - 1);
      if (Number.isFinite(seekableEnd) && target > seekableEnd + 0.5) {
        setDeferredSeekTarget(target);
        video.currentTime = Math.max(0, seekableEnd - 0.5);
        return;
      }
    }

    setDeferredSeekTarget(null);
    video.currentTime = target;
  }

  // Re-seek once the HLS playlist grows to cover a scrub target that was
  // beyond the seekable range when the user first asked for it.
  useEffect(() => {
    if (deferredSeekTarget == null) return;
    const video = videoRef.current;
    if (!video) return;

    const attemptReseek = () => {
      if (video.seekable.length === 0) return false;
      const end = video.seekable.end(video.seekable.length - 1);
      if (!Number.isFinite(end)) return false;
      if (end + 0.25 >= deferredSeekTarget) {
        video.currentTime = Math.min(duration || deferredSeekTarget, deferredSeekTarget);
        setDeferredSeekTarget(null);
        return true;
      }
      return false;
    };

    if (attemptReseek()) return;

    const interval = window.setInterval(() => {
      attemptReseek();
    }, 500);
    return () => window.clearInterval(interval);
  }, [deferredSeekTarget, duration]);

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
        : typeof qualityMode === "string" && qualityMode.startsWith("seed:")
          ? qualityMode.slice(5)
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

      {/* Advanced SubStation rendering — when the active track was ingested
          as .ass/.ssa we hand the original file to libass (via JASSUB) so
          positioning, fonts, colors, and karaoke render with full fidelity.
          The plain-text caption box below is suppressed in that case. */}
      {(() => {
        if (!activeSubtitleId) return null;
        const track = subtitleTracks.find((t) => t.id === activeSubtitleId);
        if (!track) return null;
        if (track.sourceFormat !== "ass" && track.sourceFormat !== "ssa") {
          return null;
        }
        if (!track.sourceUrl) return null;
        return (
          <AssSubtitleOverlay
            key={track.id}
            videoRef={videoRef}
            sceneId={track.sceneId}
            trackId={track.id}
            opacity={appearance.opacity}
          />
        );
      })()}

      {/* Caption overlay — deliberately NO z-index so the controls
          (which come later in DOM order) paint on top when visible. */}
      {activeCueText && !isAssTrackActive(activeSubtitleId, subtitleTracks) && (
        <div
          className="pointer-events-none absolute inset-x-0 flex justify-center px-4"
          style={{
            top: `${appearance.positionPercent}%`,
            transform: "translateY(-100%)",
            opacity: appearance.opacity,
          }}
        >
          <div
            className={cn(
              captionClassName(appearance.style),
              "max-w-[86%] whitespace-pre-line text-center font-medium leading-snug",
            )}
            style={{ fontSize: `${appearance.fontScale * 1.05}rem` }}
          >
            {activeCueText}
          </div>
        </div>
      )}

      {subtitleSettingsOpen && (
        <SubtitleSettingsPanel
          appearance={appearance}
          onChange={handleAppearanceChange}
          onClose={() => setSubtitleSettingsOpen(false)}
          onReset={handleAppearanceReset}
          hasLocalOverride={localAppearance != null}
        />
      )}

      <div className={cn(
        "pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/75 via-black/30 to-transparent px-3 sm:px-4 pb-8 sm:pb-12 pt-3 sm:pt-4 transition-opacity duration-normal",
        showControls ? "opacity-100" : "opacity-0"
      )}>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {(hlsInitializing || usingAdaptiveStream || qualityMode !== "direct") && (
            <span className="player-chip px-2 sm:px-2.5 py-0.5 sm:py-1 text-[0.6rem] sm:text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/75">
              {hlsInitializing
                ? "Loading…"
                : usingAdaptiveStream
                  ? qualityMode === "auto"
                    ? "Adaptive HLS"
                    : typeof qualityMode === "number"
                      ? "HLS"
                      : "Adaptive HLS"
                  : "Direct"}
            </span>
          )}
          {selectedQualityLabel && (
            <span className="player-chip-accent px-2 sm:px-2.5 py-0.5 sm:py-1 text-[0.6rem] sm:text-[0.7rem] font-medium text-accent-100">
              {selectedQualityLabel}
            </span>
          )}
          {deferredSeekTarget != null && (
            <span className="player-chip border-warning/30 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[0.6rem] sm:text-[0.7rem] text-white/85">
              Seeking to {formatTime(deferredSeekTarget)} · still encoding
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
                  <div className="fixed inset-x-3 bottom-24 z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-12 sm:min-w-[220px] sm:max-w-[360px] max-h-[60vh] overflow-y-auto overscroll-contain player-dropdown p-1">
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
                      const lang = languageLabel(track.language);
                      const displayName = track.label
                        ? `${lang} — ${track.label}`
                        : lang;
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
                          <span className="min-w-0 flex-1 truncate">{displayName}</span>
                          <span className="shrink-0 text-[0.55rem] sm:text-[0.6rem] uppercase tracking-[0.16em] text-white/50">
                            {track.source}
                          </span>
                        </button>
                      );
                    })}
                    <div className="my-1 border-t border-white/10" />
                    <button
                      type="button"
                      onClick={() => {
                        setSubtitleSettingsOpen(true);
                        setSubtitleMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm text-white/78 hover:bg-white/8 hover:text-white transition-colors"
                    >
                      <Sliders className="h-3.5 w-3.5" />
                      <span>Subtitle style…</span>
                    </button>
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
                <div className="fixed inset-x-3 bottom-24 z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-12 sm:min-w-[140px] sm:max-w-[220px] max-h-[60vh] overflow-y-auto overscroll-contain player-dropdown p-1">
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
                <div className="absolute bottom-12 right-0 min-w-[112px] max-h-[60vh] overflow-y-auto overscroll-contain player-dropdown p-1">
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
