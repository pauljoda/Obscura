<script module lang="ts">
  export interface VideoPlayerHandle {
    seekTo: (time: number) => void;
  }

  export interface ActiveCue {
    start: number;
    end: number;
    text: string;
  }

  export interface VideoPlayerMarker {
    id: string;
    time: number;
    title: string;
  }
</script>

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type Hls from "hls.js";
  import {
    Captions,
    ChevronDown,
    Gauge,
    Loader,
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
  } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type {
    HlsRendition,
    HlsStatus,
    SubtitleAppearance,
  } from "@obscura/contracts";
  import {
    enterMediaFullscreen,
    exitDocumentFullscreen,
    isDocumentFullscreen,
  } from "$lib/fullscreen";
  import FilmStrip from "./FilmStrip.svelte";
  import AssSubtitleOverlay from "./AssSubtitleOverlay.svelte";
  import SubtitleSettingsPanel from "./SubtitleSettingsPanel.svelte";
  import {
    chooseInitialPlaybackMode,
    computeVideoLoadState,
    requestedModeFromQualityMode,
    type QualityMode,
  } from "./video-player-load";
  import { fetchVideoSubtitleCues } from "$lib/api/videos";
  import type { VideoSubtitleTrackDto, SubtitleCueDto } from "$lib/api/types";
  import {
    captionClassName,
    pickPreferredSubtitleTrack,
    readLocalSubtitleAppearance,
    resolveSubtitleAppearance,
    writeLocalSubtitleAppearance,
  } from "$lib/subtitle-appearance";

  interface Props {
    src?: string;
    directSrc?: string;
    poster?: string;
    markers?: VideoPlayerMarker[];
    duration?: number;
    onMarkerClick?: (marker: VideoPlayerMarker) => void;
    onPlayStarted?: () => void;
    onTimeUpdate?: (time: number) => void;
    trickplaySprite?: string;
    trickplayVtt?: string;
    subtitleTracks?: VideoSubtitleTrackDto[];
    activeSubtitleTrackId?: string | null;
    onActiveSubtitleTrackIdChange?: (id: string | null) => void;
    onActiveCueChange?: (cue: ActiveCue | null) => void;
    subtitleChoiceLocked?: boolean;
    subtitleDefaults?: {
      autoEnable: boolean;
      preferredLanguages: string;
      appearance: SubtitleAppearance;
    };
    defaultPlaybackMode?: "direct" | "hls";
    onEnded?: () => void;
    autoPlay?: boolean;
    /** Bound handle for parent access (`bind:handle`). */
    handle?: VideoPlayerHandle;
  }

  let {
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
    onEnded,
    autoPlay = false,
    handle = $bindable(),
  }: Props = $props();

  interface QualityOption {
    value: QualityMode;
    label: string;
  }

  // ─── Helpers ────────────────────────────────────────────────────
  function isVirtualHlsSrc(s: string): boolean {
    return /\/hls2\/master\.m3u8$/.test(s);
  }

  function usesProgressiveHlsSeekWindow(s: string | undefined): boolean {
    return Boolean(s?.endsWith("/master.m3u8")) && !Boolean(s && isVirtualHlsSrc(s));
  }

  function hlsStatusUrlForSrc(s: string): string | null {
    if (!s.endsWith("/master.m3u8")) return null;
    if (isVirtualHlsSrc(s)) return null;
    return s.replace(/\/master\.m3u8(\?.*)?$/, "/status$1");
  }

  async function fetchHlsStatus(
    statusUrl: string,
    signal?: AbortSignal,
  ): Promise<HlsStatus | null> {
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
    opts: { intervalMs?: number; maxAttempts?: number } = {},
  ): Promise<HlsStatus> {
    const interval = opts.intervalMs ?? 2000;
    const max = opts.maxAttempts ?? 450;
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
      ...renditions
        .slice()
        .sort((a, b) => b.height - a.height)
        .map<QualityOption>((r) => ({ value: `seed:${r.name}` as const, label: r.label })),
    ];
  }

  const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

  function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function formatBandwidth(bps: number | null) {
    if (!bps || !Number.isFinite(bps)) return "—";
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
    return `${Math.round(bps / 1_000)} Kbps`;
  }

  function getLevelLabel(level: { height?: number; name?: string }, index: number) {
    if (level.name) return level.name.toUpperCase();
    if (level.height) return `${level.height}p`;
    return `Level ${index + 1}`;
  }

  function describeMediaError(error: MediaError | null): string {
    if (!error) return "media error";
    switch (error.code) {
      case error.MEDIA_ERR_ABORTED: return "request aborted";
      case error.MEDIA_ERR_NETWORK: return "network error";
      case error.MEDIA_ERR_DECODE: return "decode error";
      case error.MEDIA_ERR_SRC_NOT_SUPPORTED: return "format not supported";
      default: return "media error";
    }
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

  function isAssTrackActive(
    id: string | null | undefined,
    tracks: readonly VideoSubtitleTrackDto[],
  ): boolean {
    if (!id) return false;
    const t = tracks.find((x) => x.id === id);
    if (!t) return false;
    return (t.sourceFormat === "ass" || t.sourceFormat === "ssa") && !!t.sourceUrl;
  }

  // ─── State ──────────────────────────────────────────────────────
  let containerEl: HTMLDivElement | undefined = $state();
  let videoEl: HTMLVideoElement | undefined = $state();
  let hlsRef: Hls | null = null;
  let controlsTimeout: number | null = null;
  let playTracked = false;
  let isDraggingRef = false;

  let prevSrcKey = "";
  let prevLoadKey = "";
  let pendingAutoPlay = false;
  let pendingSeekTime: number | null = null;
  let pendingSeedName: string | null = null;
  let seededRenditions: HlsRendition[] = [];
  let qualityModeRef: QualityMode = "direct";
  let directFallbackTried = false;
  let adaptiveSrcRef = "";

  let playing = $state(false);
  let isDragging = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);
  let muted = $state(false);
  let volume = $state(1);
  let showControls = $state(true);
  let playbackRate = $state(1);
  let qualityMode = $state<QualityMode>("direct");
  let streamMode = $state<"direct" | "hls">("direct");
  let qualityOptions = $state<QualityOption[]>([{ value: "direct", label: "Direct" }]);
  let activeQualityLabel = $state<string | null>(null);
  let bufferedProgress = $state(0);
  let bufferAhead = $state(0);
  let bandwidthEstimate = $state<number | null>(null);
  let droppedFrames = $state<number | null>(null);
  let qualityMenuOpen = $state(false);
  let speedMenuOpen = $state(false);
  let timelineHover = $state<{
    markerTitles: string[];
    percent: number;
    time: number;
  } | null>(null);
  let usingAdaptiveStream = $state(false);
  let playerNotice = $state<string | null>(null);
  let hlsInitializing = $state(false);
  let deferredSeekTarget = $state<number | null>(null);
  let subtitleMenuOpen = $state(false);
  let internalSubtitleId = $state<string | null>(null);
  let activeCueText = $state<string | null>(null);
  let subtitleSettingsOpen = $state(false);
  let localAppearance = $state<Partial<SubtitleAppearance> | null>(null);
  let autoSelected = false;

  const activeSubtitleId = $derived(
    controlledSubtitleId !== undefined ? controlledSubtitleId : internalSubtitleId,
  );

  const appearance = $derived(
    resolveSubtitleAppearance(subtitleDefaults?.appearance ?? null, localAppearance),
  );

  const subtitleSelectionContext = $derived.by(() =>
    [
      src ?? "",
      directSrc ?? "",
      subtitleChoiceLocked ? "locked" : "unlocked",
      controlledSubtitleId ?? "__null__",
      subtitleTracks.map((track) => track.id).join(","),
    ].join("|"),
  );

  const progress = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);

  const selectedQualityLabel = $derived(
    qualityMode === "direct"
      ? "Direct"
      : qualityMode === "auto"
        ? `Auto${activeQualityLabel ? ` · ${activeQualityLabel}` : ""}`
        : typeof qualityMode === "string" && qualityMode.startsWith("seed:")
          ? (qualityMode as string).slice(5)
          : activeQualityLabel,
  );

  const hasFilmStrip = $derived(Boolean(trickplaySprite && trickplayVtt && duration > 0));

  // ─── Imperative handle ───────────────────────────────────────────
  $effect(() => {
    handle = {
      seekTo: (time: number) => handleSeekTo(time),
    };
  });

  // ─── Subtitle: read local override ───────────────────────────────
  onMount(() => {
    localAppearance = readLocalSubtitleAppearance();
  });

  $effect(() => {
    subtitleSelectionContext;
    autoSelected = false;
  });

  $effect(() => {
    adaptiveSrcRef = src ?? "";
  });

  // ─── Subtitle auto-select ────────────────────────────────────────
  $effect(() => {
    if (autoSelected) return;
    if (subtitleChoiceLocked) {
      autoSelected = true;
      return;
    }
    if (controlledSubtitleId !== undefined && controlledSubtitleId !== null) {
      autoSelected = true;
      return;
    }
    if (!subtitleDefaults?.autoEnable || subtitleTracks.length === 0) return;
    const picked = pickPreferredSubtitleTrack(
      subtitleTracks.map((t) => ({ id: t.id, language: t.language })),
      subtitleDefaults.preferredLanguages,
    );
    if (picked) {
      autoSelected = true;
      selectSubtitle(picked);
    }
  });

  function selectSubtitle(id: string | null) {
    if (controlledSubtitleId === undefined) internalSubtitleId = id;
    onActiveSubtitleTrackIdChange?.(id);
    subtitleMenuOpen = false;
  }

  function handleAppearanceChange(next: SubtitleAppearance) {
    localAppearance = next;
    writeLocalSubtitleAppearance(next);
  }

  function handleAppearanceReset() {
    localAppearance = null;
    writeLocalSubtitleAppearance(null);
  }

  // ─── Controls visibility ─────────────────────────────────────────
  function clearControlsTimer() {
    if (controlsTimeout) {
      window.clearTimeout(controlsTimeout);
      controlsTimeout = null;
    }
  }

  function scheduleControlsHide() {
    clearControlsTimer();
    if (!playing) return;
    controlsTimeout = window.setTimeout(() => {
      showControls = false;
      qualityMenuOpen = false;
      speedMenuOpen = false;
    }, 2400);
  }

  function surfaceControls() {
    showControls = true;
    scheduleControlsHide();
  }

  onMount(() => () => clearControlsTimer());

  // ─── Status-seed quality options ─────────────────────────────────
  $effect(() => {
    if (!src) {
      seededRenditions = [];
      return;
    }
    const statusUrl = hlsStatusUrlForSrc(src);
    if (!statusUrl) return;
    const controller = new AbortController();
    void (async () => {
      const status = await fetchHlsStatus(statusUrl, controller.signal);
      if (!status || controller.signal.aborted) return;
      seededRenditions = status.renditions;
      const hasRealLevels = qualityOptions.some((opt) => typeof opt.value === "number");
      if (!hasRealLevels) {
        qualityOptions = renditionsToQualityOptions(status.renditions, Boolean(directSrc));
      }
    })();
    return () => controller.abort();
  });

  // ─── Request play with direct-fallback ───────────────────────────
  function handleDirectPlaybackFailure(reason: string, shouldResumePlayback = false) {
    if (streamMode !== "direct") {
      playerNotice = `Playback failed: ${reason}.`;
      return;
    }
    if (!adaptiveSrcRef) {
      playerNotice = `Direct playback failed: ${reason}.`;
      return;
    }
    if (directFallbackTried) {
      playerNotice = `Direct playback failed: ${reason}.`;
      return;
    }
    directFallbackTried = true;
    pendingAutoPlay = shouldResumePlayback;
    pendingSeekTime = videoEl?.currentTime ?? 0;
    playerNotice = `Direct playback failed on this device — switched to adaptive HLS (${reason}).`;
    qualityMode = "auto";
  }

  function requestPlay(video: HTMLVideoElement) {
    const p = video.play();
    if (!p || typeof p.catch !== "function") return;
    void p.catch((error: unknown) => {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "playback could not start";
      handleDirectPlaybackFailure(message, true);
    });
  }

  // ─── Source lifecycle (direct <-> HLS) ───────────────────────────
  $effect(() => {
    if (!videoEl) return;
    const currentSrc = src;
    const currentDirectSrc = directSrc;
    const localVideoEl = videoEl;
    const currentPropDuration = propDuration;
    const currentDefaultPlaybackMode = defaultPlaybackMode;
    const requestedMode = requestedModeFromQualityMode(qualityMode);

    return untrack(() => {
    const videoEl = localVideoEl!;
    let cancelled = false;
    const hlsLoadAbort = new AbortController();

    const { srcKey, isNewSource, effectiveMode, loadKey } = computeVideoLoadState({
      src: currentSrc,
      directSrc: currentDirectSrc,
      defaultPlaybackMode: currentDefaultPlaybackMode,
      requestedMode,
      prevSrcKey,
    });

    if (loadKey === prevLoadKey) {
      return;
    }

    prevSrcKey = srcKey;
    prevLoadKey = loadKey;

    if (isNewSource) {
      duration = currentPropDuration ?? 0;
      currentTime = 0;
      bufferedProgress = 0;
      bufferAhead = 0;
      bandwidthEstimate = null;
      droppedFrames = null;
      qualityMode = effectiveMode === "direct" ? "direct" : "auto";
      streamMode = effectiveMode;
      pendingSeedName = null;
      deferredSeekTarget = null;
      const seeded = seededRenditions;
      if (seeded.length > 0) {
        qualityOptions = renditionsToQualityOptions(seeded, Boolean(currentDirectSrc));
      } else {
        qualityOptions = chooseInitialPlaybackMode({
          src: currentSrc,
          directSrc: currentDirectSrc,
          defaultPlaybackMode: currentDefaultPlaybackMode,
        }) === "direct"
          ? [
              { value: "direct" as const, label: "Direct" },
              { value: "auto" as const, label: "Auto" },
            ]
          : [{ value: "auto" as const, label: "Auto" }];
      }
      activeQualityLabel = null;
      playerNotice = null;
      usingAdaptiveStream = false;
      hlsInitializing = false;
      pendingAutoPlay = false;
      pendingSeekTime = null;
      directFallbackTried = false;
    } else {
      pendingSeekTime = videoEl.currentTime > 0.5 ? videoEl.currentTime : null;
      pendingAutoPlay = pendingAutoPlay || !videoEl.paused;
    }

    const destroyHls = () => {
      hlsRef?.destroy();
      hlsRef = null;
    };

    destroyHls();
    videoEl.pause();
    playing = false;
    videoEl.removeAttribute("src");
    videoEl.load();

    if (!src && !directSrc) {
      hlsInitializing = false;
      return;
    }

    if (effectiveMode === "direct") {
      hlsInitializing = false;
      usingAdaptiveStream = false;
      const directSource = currentDirectSrc ?? currentSrc;
      if (directSource) {
        videoEl.src = directSource;
        videoEl.load();
        const seekTime = pendingSeekTime;
        const shouldPlay = pendingAutoPlay;
        if (seekTime !== null || shouldPlay) {
          pendingSeekTime = null;
          pendingAutoPlay = false;
          const onReady = () => {
            if (seekTime !== null && videoEl) videoEl.currentTime = seekTime;
            if (shouldPlay && videoEl) requestPlay(videoEl);
          };
          videoEl.addEventListener("loadedmetadata", onReady, { once: true });
        }
      }
      return () => {
        cancelled = true;
        destroyHls();
      };
    }

    if (currentSrc?.endsWith(".m3u8")) {
      hlsInitializing = true;

      void (async () => {
        const { default: Hls } = await import("hls.js");
        if (cancelled) return;

        const statusUrl = hlsStatusUrlForSrc(currentSrc);
        if (statusUrl) {
          try {
            const ready = await waitForHlsReady(statusUrl, hlsLoadAbort.signal);
            if (!cancelled && ready.renditions.length > 0) {
              seededRenditions = ready.renditions;
            }
          } catch (err) {
            if (cancelled || hlsLoadAbort.signal.aborted) return;
            hlsInitializing = false;
            usingAdaptiveStream = false;
            if (currentDirectSrc) {
              qualityMode = "direct";
              playerNotice = `Adaptive stream unavailable — switched to direct. (${
                err instanceof Error ? err.message : "unknown error"
              })`;
              videoEl!.src = currentDirectSrc;
              videoEl!.load();
              return;
            }
            playerNotice = `Adaptive playback unavailable: ${
              err instanceof Error ? err.message : "unknown error"
            }`;
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

          hlsRef = hls;
          hls.attachMedia(videoEl!);
          usingAdaptiveStream = true;

          hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(currentSrc));

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            hlsInitializing = false;
            const hlsLevels = hls.levels
              .map((level, index) => ({ value: index, label: getLevelLabel(level, index) }))
              .reverse();
            const options: QualityOption[] = [
              ...(currentDirectSrc ? [{ value: "direct" as const, label: "Direct" }] : []),
              { value: "auto" as const, label: "Auto" },
              ...hlsLevels,
            ];
            qualityOptions = options;
            const highestLevel = Math.max(hls.levels.length - 1, 0);

            const seedName = pendingSeedName;
            pendingSeedName = null;
            if (seedName) {
              const matchIdx = hls.levels.findIndex((lvl, idx) => {
                const label = getLevelLabel(lvl, idx).toLowerCase();
                return label === seedName.toLowerCase();
              });
              if (matchIdx >= 0) {
                hls.currentLevel = matchIdx;
                hls.nextLevel = matchIdx;
                qualityMode = matchIdx;
                activeQualityLabel = getLevelLabel(hls.levels[matchIdx] ?? {}, matchIdx);
              } else {
                hls.currentLevel = -1;
                hls.nextAutoLevel = highestLevel;
                qualityMode = "auto";
                activeQualityLabel = getLevelLabel(hls.levels[highestLevel] ?? {}, highestLevel);
              }
            } else if (typeof qualityModeRef === "number") {
              const target = qualityModeRef as number;
              hls.currentLevel = target;
              hls.nextLevel = target;
              activeQualityLabel = getLevelLabel(hls.levels[target] ?? {}, target);
            } else {
              hls.currentLevel = -1;
              hls.startLevel = highestLevel;
              hls.nextAutoLevel = highestLevel;
              activeQualityLabel = getLevelLabel(hls.levels[highestLevel] ?? {}, highestLevel);
            }

            bandwidthEstimate = Number.isFinite(hls.bandwidthEstimate) ? hls.bandwidthEstimate : null;

            const seekTime = pendingSeekTime;
            const shouldPlay = pendingAutoPlay;
            pendingSeekTime = null;
            pendingAutoPlay = false;
            if (seekTime !== null && videoEl) videoEl.currentTime = seekTime;
            if (shouldPlay && videoEl) requestPlay(videoEl);
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (_: unknown, data: { level: number }) => {
            const level = hls.levels[data.level];
            activeQualityLabel = getLevelLabel(level ?? {}, data.level);
            bandwidthEstimate = Number.isFinite(hls.bandwidthEstimate) ? hls.bandwidthEstimate : null;
          });

          hls.on(Hls.Events.FRAG_BUFFERED, () => {
            bandwidthEstimate = Number.isFinite(hls.bandwidthEstimate) ? hls.bandwidthEstimate : null;
          });

          hls.on(Hls.Events.ERROR, (_: unknown, data: { fatal?: boolean }) => {
            if (!data.fatal) return;
            hls.destroy();
            hlsRef = null;
            usingAdaptiveStream = false;
            hlsInitializing = false;
            pendingAutoPlay = false;
            pendingSeekTime = null;
            if (currentDirectSrc) {
              qualityMode = "direct";
              playerNotice = "Adaptive stream failed — switched to direct.";
              videoEl!.src = currentDirectSrc;
              videoEl!.load();
              return;
            }
            playerNotice = "Adaptive playback failed.";
          });
          return;
        }

        // Native HLS (Safari)
        if (videoEl!.canPlayType("application/vnd.apple.mpegurl")) {
          hlsInitializing = false;
          usingAdaptiveStream = true;
          videoEl!.src = currentSrc;
          videoEl!.load();
          const seekTime = pendingSeekTime;
          const shouldPlay = pendingAutoPlay;
          if (seekTime !== null || shouldPlay) {
            pendingSeekTime = null;
            pendingAutoPlay = false;
            const onReady = () => {
              if (seekTime !== null && videoEl) videoEl.currentTime = seekTime;
              if (shouldPlay && videoEl) requestPlay(videoEl);
            };
            videoEl!.addEventListener("loadedmetadata", onReady, { once: true });
          }
          return;
        }

        hlsInitializing = false;
        const fallbackSource = currentDirectSrc ?? currentSrc;
        if (fallbackSource) {
          videoEl!.src = fallbackSource;
          videoEl!.load();
        }
      })();

      return () => {
        cancelled = true;
        hlsLoadAbort.abort();
        destroyHls();
      };
    }

    hlsInitializing = false;
    const fallbackSource = currentDirectSrc ?? currentSrc;
    if (fallbackSource) {
      videoEl.src = fallbackSource;
      videoEl.load();
    }

    return () => {
      cancelled = true;
      destroyHls();
    };
    });
  });

  // Sync streamMode from qualityMode
  $effect(() => {
    qualityModeRef = qualityMode;
    streamMode = qualityMode === "direct" ? "direct" : "hls";
  });

  $effect(() => {
    if (qualityMode === "direct") return;
    if (typeof qualityMode === "string" && qualityMode.startsWith("seed:")) {
      pendingSeedName = qualityMode.slice(5);
      return;
    }
    const hls = hlsRef;
    if (!hls) return;
    if (qualityMode === "auto") {
      const highestLevel = Math.max(hls.levels.length - 1, 0);
      hls.currentLevel = -1;
      hls.startLevel = highestLevel;
      hls.nextAutoLevel = highestLevel;
      return;
    }
    if (typeof qualityMode === "number") {
      hls.currentLevel = qualityMode;
      activeQualityLabel = getLevelLabel(hls.levels[qualityMode] ?? {}, qualityMode);
    }
  });

  // ─── Video event wiring ──────────────────────────────────────────
  $effect(() => {
    if (!videoEl) return;

    const updateBuffered = () => {
      const bufferedEnd = videoEl!.buffered.length > 0
        ? videoEl!.buffered.end(videoEl!.buffered.length - 1)
        : 0;
      bufferedProgress = duration > 0 ? (bufferedEnd / duration) * 100 : 0;
      bufferAhead = Math.max(0, bufferedEnd - videoEl!.currentTime);
    };

    const handleTimeUpdate = () => {
      currentTime = videoEl!.currentTime;
      onTimeUpdate?.(videoEl!.currentTime);
      updateBuffered();
    };

    const applyDuration = () => {
      const vd = Number.isFinite(videoEl!.duration) ? videoEl!.duration : 0;
      const next = Math.max(vd, propDuration ?? 0);
      if (next > 0) duration = next;
    };

    const onLoadedMetadata = () => {
      applyDuration();
      updateBuffered();
      onTimeUpdate?.(videoEl!.currentTime);
      if (autoPlay && videoEl!.paused) requestPlay(videoEl!);
    };
    const onDurationChange = () => applyDuration();
    const onSeeked = () => {
      currentTime = videoEl!.currentTime;
      onTimeUpdate?.(videoEl!.currentTime);
    };
    const onProgress = () => updateBuffered();
    const onPlay = () => {
      playing = true;
      scheduleControlsHide();
      if (!playTracked) {
        playTracked = true;
        onPlayStarted?.();
      }
    };
    const onPause = () => {
      playing = false;
      showControls = true;
      clearControlsTimer();
    };
    const onEndedEvt = () => {
      playing = false;
      showControls = true;
      clearControlsTimer();
      onEnded?.();
    };
    const onVolumeChange = () => {
      muted = videoEl!.muted || videoEl!.volume === 0;
      volume = videoEl!.volume;
    };
    const onErrorEvt = () => handleDirectPlaybackFailure(describeMediaError(videoEl!.error));

    videoEl.addEventListener("timeupdate", handleTimeUpdate);
    videoEl.addEventListener("loadedmetadata", onLoadedMetadata);
    videoEl.addEventListener("durationchange", onDurationChange);
    videoEl.addEventListener("seeked", onSeeked);
    videoEl.addEventListener("progress", onProgress);
    videoEl.addEventListener("play", onPlay);
    videoEl.addEventListener("pause", onPause);
    videoEl.addEventListener("ended", onEndedEvt);
    videoEl.addEventListener("volumechange", onVolumeChange);
    videoEl.addEventListener("error", onErrorEvt);

    onTimeUpdate?.(videoEl.currentTime);

    const metricsInterval = window.setInterval(() => {
      const quality = videoEl!.getVideoPlaybackQuality?.();
      if (quality) droppedFrames = quality.droppedVideoFrames;
      const hls = hlsRef;
      if (hls && Number.isFinite(hls.bandwidthEstimate)) {
        bandwidthEstimate = hls.bandwidthEstimate;
      }
    }, 1000);

    return () => {
      if (!videoEl) return;
      videoEl.removeEventListener("timeupdate", handleTimeUpdate);
      videoEl.removeEventListener("loadedmetadata", onLoadedMetadata);
      videoEl.removeEventListener("durationchange", onDurationChange);
      videoEl.removeEventListener("seeked", onSeeked);
      videoEl.removeEventListener("progress", onProgress);
      videoEl.removeEventListener("play", onPlay);
      videoEl.removeEventListener("pause", onPause);
      videoEl.removeEventListener("ended", onEndedEvt);
      videoEl.removeEventListener("volumechange", onVolumeChange);
      videoEl.removeEventListener("error", onErrorEvt);
      window.clearInterval(metricsInterval);
    };
  });

  // ─── Keyboard shortcuts ──────────────────────────────────────────
  onMount(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
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

  // ─── Subtitle cue pipeline ───────────────────────────────────────
  let activeTrackCues = $state<SubtitleCueDto[]>([]);

  $effect(() => {
    if (!activeSubtitleId) {
      activeTrackCues = [];
      activeCueText = null;
      onActiveCueChange?.(null);
      return;
    }
    const track = subtitleTracks.find((t) => t.id === activeSubtitleId);
    if (!track) {
      activeTrackCues = [];
      activeCueText = null;
      onActiveCueChange?.(null);
      return;
    }

    let cancelled = false;
    fetchVideoSubtitleCues(track.videoId, track.id)
      .then(({ cues }) => {
        if (cancelled) return;
        activeTrackCues = cues;
      })
      .catch(() => {
        if (cancelled) return;
        activeTrackCues = [];
      });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    if (!videoEl) return;
    let lastIndex = -1;
    const evaluate = () => {
      const cues = activeTrackCues;
      if (!activeSubtitleId || cues.length === 0) {
        if (lastIndex !== -1) {
          lastIndex = -1;
          activeCueText = null;
          onActiveCueChange?.(null);
        }
        return;
      }
      const t = videoEl!.currentTime;
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
        activeCueText = null;
        onActiveCueChange?.(null);
        return;
      }
      const cue = cues[idx]!;
      const text = cue.text.replace(/<[^>]+>/g, "");
      activeCueText = text || null;
      onActiveCueChange?.({ start: cue.start, end: cue.end, text });
    };

    evaluate();
    videoEl.addEventListener("timeupdate", evaluate);
    videoEl.addEventListener("seeking", evaluate);
    videoEl.addEventListener("seeked", evaluate);
    return () => {
      if (!videoEl) return;
      videoEl.removeEventListener("timeupdate", evaluate);
      videoEl.removeEventListener("seeking", evaluate);
      videoEl.removeEventListener("seeked", evaluate);
    };
  });

  // ─── Seek / playback helpers ────────────────────────────────────
  function togglePlay() {
    if (!videoEl) return;
    if (videoEl.paused) requestPlay(videoEl);
    else videoEl.pause();
  }

  function seek(delta: number) {
    if (!videoEl) return;
    videoEl.currentTime = Math.max(0, Math.min(duration, videoEl.currentTime + delta));
  }

  function handleSeekTo(time: number) {
    if (!videoEl) return;
    const target = Math.max(0, Math.min(duration || time, time));
    if (
      streamMode === "hls" &&
      usesProgressiveHlsSeekWindow(src) &&
      videoEl.seekable.length > 0
    ) {
      const seekableEnd = videoEl.seekable.end(videoEl.seekable.length - 1);
      if (Number.isFinite(seekableEnd) && target > seekableEnd + 0.5) {
        deferredSeekTarget = target;
        videoEl.currentTime = Math.max(0, seekableEnd - 0.5);
        return;
      }
    }
    deferredSeekTarget = null;
    videoEl.currentTime = target;
  }

  $effect(() => {
    if (deferredSeekTarget == null || !videoEl) return;

    const attemptReseek = () => {
      if (!videoEl || videoEl.seekable.length === 0) return false;
      const end = videoEl.seekable.end(videoEl.seekable.length - 1);
      if (!Number.isFinite(end)) return false;
      if (end + 0.25 >= deferredSeekTarget!) {
        videoEl.currentTime = Math.min(duration || deferredSeekTarget!, deferredSeekTarget!);
        deferredSeekTarget = null;
        return true;
      }
      return false;
    };

    if (attemptReseek()) return;
    const interval = window.setInterval(() => attemptReseek(), 500);
    return () => window.clearInterval(interval);
  });

  function toggleMute() {
    if (!videoEl) return;
    videoEl.muted = !videoEl.muted;
    if (!videoEl.muted && videoEl.volume === 0) videoEl.volume = 1;
  }

  function handleVolumeChange(next: number) {
    if (!videoEl) return;
    videoEl.volume = next;
    videoEl.muted = next === 0;
    volume = next;
    muted = next === 0;
  }

  function toggleFullscreen() {
    if (isDocumentFullscreen()) {
      exitDocumentFullscreen();
      return;
    }
    if (!containerEl) return;
    enterMediaFullscreen(containerEl, videoEl ?? null);
  }

  function applyPlaybackRate(nextRate: number) {
    if (!videoEl) return;
    videoEl.playbackRate = nextRate;
    playbackRate = nextRate;
    speedMenuOpen = false;
  }

  function updateTimelineHover(clientX: number, rect: DOMRect) {
    if (duration <= 0) {
      timelineHover = null;
      return;
    }
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = percent * duration;
    const windowSec = Math.max(duration * 0.01, 1.5);
    const markerTitles = markers
      .filter((m) => Math.abs(m.time - time) <= windowSec)
      .map((m) => m.title);
    timelineHover = { markerTitles, percent: percent * 100, time };
  }

  function handleFilmStripInteraction(active: boolean) {
    if (active) {
      clearControlsTimer();
      showControls = false;
      qualityMenuOpen = false;
      speedMenuOpen = false;
    } else {
      surfaceControls();
    }
  }

  const assTrackForRender = $derived.by(() => {
    if (!activeSubtitleId) return null;
    const track = subtitleTracks.find((t) => t.id === activeSubtitleId);
    if (!track) return null;
    if (track.sourceFormat !== "ass" && track.sourceFormat !== "ssa") return null;
    if (!track.sourceUrl) return null;
    return track;
  });
</script>

<div class="space-y-1">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={containerEl}
    class="relative surface-media-well"
    onmousemove={surfaceControls}
    onmouseleave={() => {
      if (playing) showControls = false;
    }}
    ontouchstart={surfaceControls}
  >
    {#if src || directSrc}
      <!-- svelte-ignore a11y_media_has_caption -->
      <!-- Cap the player's width off the viewport height so the scrub /
           play / volume row always stays inside the fold. Without this,
           a 16:9 aspect with w-full on a wide desktop window pushes the
           controls below the viewport and the player appears broken. -->
      <video
        bind:this={videoEl}
        {poster}
        class="aspect-video w-full max-w-[calc((100dvh-14rem)*16/9)] mx-auto bg-black"
        onclick={togglePlay}
        playsinline
        crossorigin="anonymous"
      ></video>
    {:else}
      <div class="flex aspect-video items-center justify-center bg-surface-1">
        <div class="text-center">
          <Play class="mx-auto mb-3 h-16 w-16 text-text-disabled" />
          <p class="text-sm text-text-muted">No video source</p>
          <p class="mt-1 text-xs text-text-disabled">Video playback will appear here</p>
        </div>
      </div>
    {/if}

    {#if assTrackForRender}
      {#key assTrackForRender.id}
        <AssSubtitleOverlay
          videoEl={videoEl ?? null}
          videoId={assTrackForRender.videoId}
          trackId={assTrackForRender.id}
          opacity={appearance.opacity}
        />
      {/key}
    {/if}

    {#if activeCueText && !isAssTrackActive(activeSubtitleId, subtitleTracks)}
      <div
        class="pointer-events-none absolute inset-x-0 flex justify-center px-4"
        style:top="{appearance.positionPercent}%"
        style:transform="translateY(-100%)"
        style:opacity={appearance.opacity}
      >
        <div
          class={cn(
            captionClassName(appearance.style),
            "max-w-[86%] whitespace-pre-line text-center font-medium leading-snug",
          )}
          style:font-size="{appearance.fontScale * 1.05}rem"
        >
          {activeCueText}
        </div>
      </div>
    {/if}

    {#if subtitleSettingsOpen}
      <SubtitleSettingsPanel
        {appearance}
        onChange={handleAppearanceChange}
        onClose={() => (subtitleSettingsOpen = false)}
        onReset={handleAppearanceReset}
        hasLocalOverride={localAppearance != null}
      />
    {/if}

    <!-- Top overlay: chips + metrics -->
    <div
      class={cn(
        "pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/75 via-black/30 to-transparent px-3 sm:px-4 pb-8 sm:pb-12 pt-3 sm:pt-4 transition-opacity duration-normal",
        showControls ? "opacity-100" : "opacity-0",
      )}
    >
      <div class="flex flex-wrap gap-1.5 sm:gap-2">
        {#if hlsInitializing || usingAdaptiveStream || qualityMode !== "direct"}
          <span
            class="player-chip px-2 sm:px-2.5 py-0.5 sm:py-1 text-[0.6rem] sm:text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/75"
          >
            {#if hlsInitializing}Loading…{:else if usingAdaptiveStream}{qualityMode === "auto"
                ? "Adaptive HLS"
                : typeof qualityMode === "number"
                  ? "HLS"
                  : "Adaptive HLS"}{:else}Direct{/if}
          </span>
        {/if}
        {#if selectedQualityLabel}
          <span
            class="player-chip-accent px-2 sm:px-2.5 py-0.5 sm:py-1 text-[0.6rem] sm:text-[0.7rem] font-medium text-accent-100"
          >
            {selectedQualityLabel}
          </span>
        {/if}
        {#if deferredSeekTarget != null}
          <span
            class="player-chip border-warning/30 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[0.6rem] sm:text-[0.7rem] text-white/85"
          >
            Seeking to {formatTime(deferredSeekTarget)} · still encoding
          </span>
        {/if}
        {#if playerNotice}
          <span
            class="player-chip border-warning/20 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[0.6rem] sm:text-[0.7rem] text-white/80"
          >
            {playerNotice}
          </span>
        {/if}
      </div>

      <div
        class={cn(
          "hidden sm:grid gap-2 text-right text-[0.68rem] text-white/70",
          streamMode === "direct" ? "min-w-[120px] grid-cols-2" : "min-w-[184px] grid-cols-3",
        )}
      >
        {#if streamMode !== "direct"}
          <div class="pointer-events-none player-chip px-2 py-1.5">
            <div class="mb-0.5 flex items-center justify-end gap-1 text-white/50">
              <Wifi class="h-3.5 w-3.5" />
              <span class="text-[0.58rem] uppercase tracking-[0.16em]">ABR</span>
            </div>
            <div class="truncate text-mono-tabular text-glow-phosphor text-[0.72rem] font-medium">
              {formatBandwidth(bandwidthEstimate)}
            </div>
          </div>
        {/if}
        <div class="pointer-events-none player-chip px-2 py-1.5">
          <div class="mb-0.5 flex items-center justify-end gap-1 text-white/50">
            <Gauge class="h-3.5 w-3.5" />
            <span class="text-[0.58rem] uppercase tracking-[0.16em]">Buffer</span>
          </div>
          <div class="truncate text-mono-tabular text-glow-phosphor text-[0.72rem] font-medium">
            {bufferAhead.toFixed(1)}s
          </div>
        </div>
        <div class="pointer-events-none player-chip px-2 py-1.5">
          <div class="mb-0.5 flex items-center justify-end gap-1 text-white/50">
            <Settings2 class="h-3.5 w-3.5" />
            <span class="text-[0.58rem] uppercase tracking-[0.16em]">Drop</span>
          </div>
          <div class="truncate text-mono-tabular text-glow-phosphor text-[0.72rem] font-medium">
            {droppedFrames == null ? "—" : String(droppedFrames)}
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom control bar -->
    <div
      class={cn(
        "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/92 via-black/65 to-transparent px-3 sm:px-4 pb-3 sm:pb-4 pt-12 sm:pt-20 transition-opacity duration-normal",
        showControls ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div class="mb-3 sm:mb-4 space-y-2">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="video-progress-track group/track"
          data-dragging={isDragging}
          onpointerdown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            isDraggingRef = true;
            isDragging = true;
            const rect = event.currentTarget.getBoundingClientRect();
            updateTimelineHover(event.clientX, rect);
            const nextPercent = Math.max(
              0,
              Math.min(1, (event.clientX - rect.left) / rect.width),
            );
            handleSeekTo(nextPercent * duration);
          }}
          onpointermove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            updateTimelineHover(event.clientX, rect);
            if (!isDraggingRef) return;
            const nextPercent = Math.max(
              0,
              Math.min(1, (event.clientX - rect.left) / rect.width),
            );
            handleSeekTo(nextPercent * duration);
          }}
          onpointerup={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            isDraggingRef = false;
            isDragging = false;
          }}
          onpointercancel={() => {
            isDraggingRef = false;
            isDragging = false;
          }}
          onpointerleave={() => {
            if (!isDraggingRef) timelineHover = null;
          }}
        >
          {#if timelineHover}
            <div
              class="pointer-events-none absolute bottom-[calc(100%+0.6rem)] z-20 -translate-x-1/2 border border-white/10 bg-black/88 px-2.5 py-1.5 text-center shadow-[0_0_16px_rgba(0,0,0,0.35)]"
              style:left="{timelineHover.percent}%"
            >
              <div class="text-mono-tabular text-[0.65rem] text-white/82">
                {formatTime(timelineHover.time)}
              </div>
              {#if timelineHover.markerTitles.length > 0}
                <div class="mt-1 max-w-48 text-[0.65rem] font-medium leading-snug text-accent-100">
                  {timelineHover.markerTitles.join(" • ")}
                </div>
              {/if}
            </div>
          {/if}
          <div class="video-progress-buffered" style:width="{bufferedProgress}%"></div>
          <div class="video-progress-fill" style:width="{progress}%"></div>
          {#each markers as marker (marker.id)}
            {@const markerPercent = duration > 0 ? (marker.time / duration) * 100 : 0}
            <button
              type="button"
              class="absolute top-1/2 h-full w-1 -translate-y-1/2 bg-white/60 transition-all hover:bg-white hover:w-1.5 hover:scale-y-150 z-10"
              style:left="{markerPercent}%"
              onclick={(event) => {
                event.stopPropagation();
                handleSeekTo(marker.time);
                onMarkerClick?.(marker);
              }}
              title={marker.title}
              aria-label={marker.title}
            ></button>
          {/each}
        </div>

        {#if markers.length > 0}
          <div class="hidden sm:flex flex-wrap gap-1.5">
            {#each markers as marker (marker.id)}
              <button
                type="button"
                onclick={() => {
                  handleSeekTo(marker.time);
                  onMarkerClick?.(marker);
                }}
                class="player-chip px-2.5 py-1 text-[0.68rem] text-white/72 transition-colors hover:border-accent-400/35 hover:text-white"
              >
                {marker.title}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onclick={() => seek(-10)}
            class="relative flex items-center justify-center text-white/70 transition-colors hover:text-white"
            title="Skip back 10s"
            aria-label="Skip back 10s"
          >
            <RotateCcw class="h-4 sm:h-[1.125rem] w-4 sm:w-[1.125rem]" />
            <span class="absolute text-[0.45rem] sm:text-[0.5rem] font-bold mt-[1px]">10</span>
          </button>
          <button
            type="button"
            onclick={hlsInitializing ? undefined : togglePlay}
            disabled={hlsInitializing}
            class="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center bg-gradient-to-b from-accent-400 to-accent-500 text-accent-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_0_14px_rgba(199,155,92,0.2)] transition-all hover:from-accent-300 hover:to-accent-400 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_20px_rgba(199,155,92,0.28)] disabled:opacity-70 disabled:cursor-wait"
            aria-label={playing ? "Pause" : "Play"}
          >
            {#if hlsInitializing}
              <Loader class="h-3.5 sm:h-4 w-3.5 sm:w-4 animate-spin" />
            {:else if playing}
              <Pause class="h-3.5 sm:h-4 w-3.5 sm:w-4" fill="currentColor" />
            {:else}
              <Play class="ml-0.5 h-3.5 sm:h-4 w-3.5 sm:w-4" fill="currentColor" />
            {/if}
          </button>
          <button
            type="button"
            onclick={() => seek(10)}
            class="relative flex items-center justify-center text-white/70 transition-colors hover:text-white"
            title="Skip forward 10s"
            aria-label="Skip forward 10s"
          >
            <RotateCw class="h-4 sm:h-[1.125rem] w-4 sm:w-[1.125rem]" />
            <span class="absolute text-[0.45rem] sm:text-[0.5rem] font-bold mt-[1px]">10</span>
          </button>

          <div class="hidden sm:flex items-center gap-2 text-white/80">
            <button type="button" onclick={toggleMute} class="transition-colors hover:text-white" aria-label={muted ? "Unmute" : "Mute"}>
              {#if muted}<VolumeX class="h-4 w-4" />{:else}<Volume2 class="h-4 w-4" />{/if}
            </button>
            <input
              aria-label="Volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              oninput={(event) =>
                handleVolumeChange(Number((event.currentTarget as HTMLInputElement).value))}
              class="h-1.5 w-20 accent-accent-500"
            />
          </div>

          <span class="text-mono-tabular text-glow-phosphor text-[0.68rem] sm:text-xs">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-2">
          {#if subtitleTracks.length > 0}
            <div class="relative">
              <button
                type="button"
                onclick={() => {
                  subtitleMenuOpen = !subtitleMenuOpen;
                  qualityMenuOpen = false;
                  speedMenuOpen = false;
                }}
                aria-label="Subtitles"
                class={cn(
                  "player-chip flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[0.65rem] sm:text-[0.72rem] transition-colors hover:border-white/20 hover:text-white",
                  activeSubtitleId ? "text-accent-100" : "text-white/82",
                )}
              >
                <Captions class="h-3.5 w-3.5" />
                <ChevronDown class="h-3 sm:h-3.5 w-3 sm:w-3.5" />
              </button>
              {#if subtitleMenuOpen}
                <div
                  class="fixed inset-x-3 bottom-24 z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-12 sm:min-w-[220px] sm:max-w-[360px] max-h-[60vh] overflow-y-auto overscroll-contain player-dropdown p-1"
                >
                  <button
                    type="button"
                    onclick={() => selectSubtitle(null)}
                    class={cn(
                      "flex w-full items-center justify-between px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm transition-colors",
                      !activeSubtitleId
                        ? "bg-accent-500/18 text-accent-100"
                        : "text-white/78 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <span>Off</span>
                    {#if !activeSubtitleId}
                      <span class="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.16em]">On</span>
                    {/if}
                  </button>
                  {#each subtitleTracks as track (track.id)}
                    {@const isActive = activeSubtitleId === track.id}
                    {@const lang = languageLabel(track.language)}
                    {@const displayName = track.label ? `${lang} — ${track.label}` : lang}
                    <button
                      type="button"
                      onclick={() => selectSubtitle(track.id)}
                      class={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm transition-colors",
                        isActive
                          ? "bg-accent-500/18 text-accent-100"
                          : "text-white/78 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <span class="min-w-0 flex-1 truncate">{displayName}</span>
                      <span class="shrink-0 text-[0.55rem] sm:text-[0.6rem] uppercase tracking-[0.16em] text-white/50">
                        {track.source}
                      </span>
                    </button>
                  {/each}
                  <div class="my-1 border-t border-white/10"></div>
                  <button
                    type="button"
                    onclick={() => {
                      subtitleSettingsOpen = true;
                      subtitleMenuOpen = false;
                    }}
                    class="flex w-full items-center gap-2 px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm text-white/78 hover:bg-white/8 hover:text-white transition-colors"
                  >
                    <Sliders class="h-3.5 w-3.5" />
                    <span>Subtitle style…</span>
                  </button>
                </div>
              {/if}
            </div>
          {/if}

          <div class="relative">
            <button
              type="button"
              onclick={() => {
                qualityMenuOpen = !qualityMenuOpen;
                speedMenuOpen = false;
                subtitleMenuOpen = false;
              }}
              class="player-chip flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[0.65rem] sm:text-[0.72rem] text-white/82 transition-colors hover:border-white/20 hover:text-white"
            >
              {selectedQualityLabel ?? "Quality"}
              <ChevronDown class="h-3 sm:h-3.5 w-3 sm:w-3.5" />
            </button>
            {#if qualityMenuOpen}
              <div
                class="fixed inset-x-3 bottom-24 z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-12 sm:min-w-[140px] sm:max-w-[220px] max-h-[60vh] overflow-y-auto overscroll-contain player-dropdown p-1"
              >
                {#each qualityOptions as option (String(option.value))}
                  <button
                    type="button"
                    onclick={() => {
                      qualityMode = option.value;
                      qualityMenuOpen = false;
                    }}
                    class={cn(
                      "flex w-full items-center justify-between px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm transition-colors",
                      qualityMode === option.value
                        ? "bg-accent-500/18 text-accent-100"
                        : "text-white/78 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <span>{option.label}</span>
                    {#if qualityMode === option.value}
                      <span class="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.16em]">On</span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <div class="relative hidden sm:block">
            <button
              type="button"
              onclick={() => {
                speedMenuOpen = !speedMenuOpen;
                qualityMenuOpen = false;
              }}
              class="player-chip flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] text-white/82 transition-colors hover:border-white/20 hover:text-white"
            >
              {playbackRate}x
              <ChevronDown class="h-3.5 w-3.5" />
            </button>
            {#if speedMenuOpen}
              <div
                class="absolute bottom-12 right-0 min-w-[112px] max-h-[60vh] overflow-y-auto overscroll-contain player-dropdown p-1"
              >
                {#each PLAYBACK_RATES as rate (rate)}
                  <button
                    type="button"
                    onclick={() => applyPlaybackRate(rate)}
                    class={cn(
                      "block w-full px-3 py-2 text-left text-sm transition-colors",
                      playbackRate === rate
                        ? "bg-accent-500/18 text-accent-100"
                        : "text-white/78 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    {rate}x
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <button
            type="button"
            onclick={toggleFullscreen}
            class="player-chip p-1.5 sm:p-2 text-white/80 transition-colors hover:border-white/20 hover:text-white"
            aria-label="Fullscreen"
          >
            <Maximize class="h-3.5 sm:h-4 w-3.5 sm:w-4" />
          </button>
        </div>
      </div>
    </div>
  </div>

  {#if hasFilmStrip}
    <div class="border border-border-subtle bg-black overflow-hidden">
      <FilmStrip
        spriteUrl={trickplaySprite!}
        vttUrl={trickplayVtt!}
        videoEl={videoEl ?? null}
        {duration}
        onSeek={handleSeekTo}
        {markers}
        onStripInteractionChange={handleFilmStripInteraction}
      />
    </div>
  {/if}
</div>
