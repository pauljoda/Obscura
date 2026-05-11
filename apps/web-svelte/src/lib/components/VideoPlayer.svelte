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
  import "vidstack/player";

  import { onMount } from "svelte";
  import {
    Captions,
    Cast,
    ChevronLeft,
    ChevronDown,
    Gauge,
    Loader,
    Maximize,
    Pause,
    Play,
    RotateCcw,
    RotateCw,
    Settings2,
    Sliders,
    Volume2,
    VolumeX,
    Wifi,
  } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import {
    isHLSProvider,
    type AudioTrack,
    type MediaCanPlayEvent,
    type MediaErrorEvent,
    type MediaProviderChangeEvent,
    type MediaTimeUpdateEvent,
    type VideoQuality,
  } from "vidstack";
  import type { MediaPlayerElement } from "vidstack/elements";
  import {
    subtitleDisplayStyles,
    type SubtitleAppearance,
    type VideoSubtitleTrackDto,
  } from "@obscura/contracts";
  import {
    HLS_RETRY_AFTER_SECONDS,
    type HlsStatus,
  } from "@obscura/contracts/media";
  import type { SubtitleCueDto } from "$lib/api/types";
  import { fetchVideoSubtitleCues } from "$lib/api/videos";
  import {
    enterMediaFullscreen,
    exitDocumentFullscreen,
    isDocumentFullscreen,
  } from "$lib/fullscreen";
  import {
    adaptiveHlsBufferConfig,
    canUseDirectPlayback,
    hlsStatusUrlForSrc,
  } from "$lib/player/video-player-load";
  import {
    captionClassName,
    pickPreferredSubtitleTrack,
    readLocalSubtitleAppearance,
    resolveSubtitleAppearance,
    writeLocalSubtitleAppearance,
  } from "$lib/player/subtitle-appearance";
  import AssSubtitleOverlay from "./AssSubtitleOverlay.svelte";
  import FilmStrip from "./FilmStrip.svelte";

  interface Props {
    src?: string;
    directSrc?: string;
    codec?: string | null;
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
    showCastControls?: boolean;
    onEnded?: () => void;
    autoPlay?: boolean;
    handle?: VideoPlayerHandle;
  }

  type PlaybackMode = "direct" | "hls";
  type QualityMode = "direct" | "auto" | number;
  type SettingsView = "root" | "quality" | "speed" | "audio" | "captions" | "subtitle-style";

  interface QualityOption {
    value: QualityMode;
    label: string;
  }

  interface AudioTrackOption {
    id: string;
    index: number;
    label: string;
    selected: boolean;
  }

  let {
    src,
    directSrc,
    codec,
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
    showCastControls = true,
    onEnded,
    autoPlay = false,
    handle = $bindable(),
  }: Props = $props();

  const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

  let containerEl: HTMLDivElement | undefined = $state();
  let player: MediaPlayerElement | undefined = $state();
  let videoEl: HTMLVideoElement | null = $state(null);
  let directCapabilityProbe: HTMLVideoElement | null = $state(null);
  let mediaMounted = $state(false);
  let controlsTimeout: number | null = null;
  let playTracked = false;
  let isDraggingRef = false;
  let lastSourceKey = "";
  let pendingSeekTime: number | null = null;
  let pendingAutoPlay = false;
  let hlsReadySrc: string | undefined = $state();

  let playbackMode = $state<PlaybackMode>("hls");
  let qualityMode = $state<QualityMode>("auto");
  let currentTime = $state(0);
  let duration = $state(0);
  let playing = $state(false);
  let buffering = $state(false);
  let muted = $state(false);
  let volume = $state(1);
  let playbackRate = $state(1);
  let showControls = $state(true);
  let isDragging = $state(false);
  let bufferedProgress = $state(0);
  let bufferAhead = $state(0);
  let bandwidthEstimate = $state<number | null>(null);
  let droppedFrames = $state<number | null>(null);
  let qualityOptions = $state<QualityOption[]>([{ value: "auto", label: "Auto" }]);
  let activeQualityLabel = $state<string | null>(null);
  let audioTracks = $state<AudioTrackOption[]>([]);
  let selectedAudioTrackLabel = $state<string | null>(null);
  let playerNotice = $state<string | null>(null);
  let timelineHover = $state<{
    markerTitles: string[];
    percent: number;
    time: number;
  } | null>(null);

  let settingsMenuRendered = $state(false);
  let settingsMenuClosing = $state(false);
  let settingsView = $state<SettingsView>("root");
  let settingsCloseTimer: number | null = null;

  let internalSubtitleId = $state<string | null>(null);
  let activeTrackCues = $state<SubtitleCueDto[]>([]);
  let activeCueText = $state<string | null>(null);
  let localAppearance = $state<Partial<SubtitleAppearance> | null>(null);
  let autoSelected = false;

  const directPlayable = $derived.by(() => {
    const video = (videoEl ?? directCapabilityProbe) as HTMLVideoElement | null;
    return canUseDirectPlayback({
      directSrc,
      codec,
      canPlayType: video ? video.canPlayType.bind(video) : undefined,
    });
  });
  const effectiveMode = $derived<PlaybackMode>(
    playbackMode === "direct" && directSrc && directPlayable ? "direct" : "hls",
  );
  const requestedPlayerSrc = $derived(effectiveMode === "direct" ? directSrc : src);
  const playerSrc = $derived(requestedPlayerSrc === hlsReadySrc ? requestedPlayerSrc : undefined);
  const progress = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
  const hasFilmStrip = $derived(Boolean(trickplaySprite && trickplayVtt && duration > 0));
  const activeSubtitleId = $derived(
    controlledSubtitleId !== undefined ? controlledSubtitleId : internalSubtitleId,
  );
  const appearance = $derived(
    resolveSubtitleAppearance(subtitleDefaults?.appearance ?? null, localAppearance),
  );
  const selectedQualityLabel = $derived(
    effectiveMode === "direct"
      ? "Direct"
      : qualityMode === "auto"
        ? `Auto${activeQualityLabel ? ` · ${activeQualityLabel}` : ""}`
        : activeQualityLabel ?? "Quality",
  );
  const activePlaybackLabel = $derived(
    effectiveMode === "direct" ? "Direct Playback" : "Adaptive HLS",
  );
  const displayedAudioTracks = $derived<AudioTrackOption[]>(
    audioTracks.length > 0
      ? audioTracks
      : [{ id: "default-audio", index: -1, label: "Default audio", selected: true }],
  );
  const displayedAudioTrackLabel = $derived(
    selectedAudioTrackLabel ?? displayedAudioTracks.find((track) => track.selected)?.label ?? "Audio",
  );
  const activeSubtitleLabel = $derived.by(() => {
    if (!activeSubtitleId) return "Off";
    const track = subtitleTracks.find((candidate) => candidate.id === activeSubtitleId);
    if (!track) return "On";
    const lang = languageLabel(track.language);
    return track.label ? `${lang} - ${track.label}` : lang;
  });

  const assTrackForRender = $derived.by(() => {
    if (!activeSubtitleId) return null;
    const track = subtitleTracks.find((t) => t.id === activeSubtitleId);
    if (!track) return null;
    if (track.sourceFormat !== "ass" && track.sourceFormat !== "ssa") return null;
    if (!track.sourceUrl) return null;
    return track;
  });

  function initialPlaybackMode(): PlaybackMode {
    if (defaultPlaybackMode === "hls") return "hls";
    return directSrc && directPlayable ? "direct" : "hls";
  }

  function formatTime(seconds: number) {
    const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = Math.floor(safe % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function formatBandwidth(bps: number | null) {
    if (!bps || !Number.isFinite(bps)) return "—";
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
    return `${Math.round(bps / 1_000)} Kbps`;
  }

  function languageLabel(language: string): string {
    if (!language || language === "und") return "Unknown";
    try {
      const displayNames = new Intl.DisplayNames(undefined, { type: "language" });
      return displayNames.of(language) ?? language.toUpperCase();
    } catch {
      return language.toUpperCase();
    }
  }

  function isAssTrackActive(
    id: string | null | undefined,
    tracks: readonly VideoSubtitleTrackDto[],
  ): boolean {
    if (!id) return false;
    const track = tracks.find((x) => x.id === id);
    if (!track) return false;
    return (track.sourceFormat === "ass" || track.sourceFormat === "ssa") && !!track.sourceUrl;
  }

  function syncVideoElement() {
    videoEl = player?.querySelector("video") ?? null;
  }

  function closeMenus() {
    closeSettings();
  }

  function clearControlsTimer() {
    if (controlsTimeout) {
      window.clearTimeout(controlsTimeout);
      controlsTimeout = null;
    }
  }

  function clearSettingsCloseTimer() {
    if (settingsCloseTimer) {
      window.clearTimeout(settingsCloseTimer);
      settingsCloseTimer = null;
    }
  }

  function scheduleControlsHide() {
    clearControlsTimer();
    if (!playing) return;
    controlsTimeout = window.setTimeout(() => {
      showControls = false;
      closeMenus();
    }, 2400);
  }

  function surfaceControls() {
    showControls = true;
    scheduleControlsHide();
  }

  function updateBuffered() {
    const video = videoEl;
    if (!video || duration <= 0) {
      bufferedProgress = 0;
      bufferAhead = 0;
      return;
    }
    let bufferedEnd = 0;
    for (let i = 0; i < video.buffered.length; i += 1) {
      const start = video.buffered.start(i);
      const end = video.buffered.end(i);
      if (video.currentTime >= start && video.currentTime <= end) {
        bufferedEnd = end;
        break;
      }
      bufferedEnd = Math.max(bufferedEnd, end);
    }
    bufferedProgress = Math.min(100, (bufferedEnd / duration) * 100);
    bufferAhead = Math.max(0, bufferedEnd - video.currentTime);
  }

  function qualityLabel(quality: VideoQuality, index: number) {
    if (quality.height > 0) return `${quality.height}p`;
    if (quality.bitrate) return formatBandwidth(quality.bitrate);
    return `Level ${index + 1}`;
  }

  function refreshQualities() {
    if (!player || effectiveMode === "direct") {
      qualityOptions = [
        ...(directSrc && directPlayable ? [{ value: "direct" as const, label: "Direct" }] : []),
        { value: "auto" as const, label: "Auto" },
      ];
      activeQualityLabel = null;
      return;
    }
    const qualities = player.qualities?.toArray?.() ?? [];
    const options = qualities
      .map((quality, index) => ({
        value: index,
        label: qualityLabel(quality, index),
        height: quality.height,
      }))
      .sort((a, b) => b.height - a.height);
    qualityOptions = [
      ...(directSrc && directPlayable ? [{ value: "direct" as const, label: "Direct" }] : []),
      { value: "auto" as const, label: "Auto" },
      ...options.map(({ value, label }) => ({ value, label })),
    ];
    const selected = qualities.find((quality) => quality.selected);
    activeQualityLabel = selected
      ? qualityLabel(selected, qualities.indexOf(selected))
      : activeQualityLabel;
    if (player.qualities?.auto) qualityMode = "auto";
  }

  function audioTrackLabel(track: AudioTrack, index: number): string {
    const label = track.label || track.language || track.kind || `Track ${index + 1}`;
    return track.language && !label.toLowerCase().includes(track.language.toLowerCase())
      ? `${label} · ${track.language}`
      : label;
  }

  function refreshAudioTracks() {
    const tracks = player?.audioTracks?.toArray?.() ?? [];
    audioTracks = tracks.map((track, index) => ({
      id: track.id,
      index,
      label: audioTrackLabel(track, index),
      selected: track.selected,
    }));
    selectedAudioTrackLabel =
      audioTracks.find((track) => track.selected)?.label ?? audioTracks[0]?.label ?? null;
  }

  function selectAudioTrack(index: number) {
    if (index < 0) {
      selectedAudioTrackLabel = displayedAudioTrackLabel;
      closeMenus();
      return;
    }
    const track = player?.audioTracks?.toArray?.()[index];
    if (!track) return;
    track.selected = true;
    selectedAudioTrackLabel = audioTrackLabel(track, index);
    refreshAudioTracks();
    closeMenus();
  }

  function requestPlaybackMode(nextQualityMode: QualityMode) {
    pendingSeekTime = currentTime > 0.25 ? currentTime : null;
    pendingAutoPlay = playing;
    if (nextQualityMode === "direct") {
      playbackMode = "direct";
      qualityMode = "direct";
      closeMenus();
      return;
    }
    playbackMode = "hls";
    qualityMode = nextQualityMode;
    closeMenus();
    if (!player || typeof nextQualityMode === "string") {
      if (nextQualityMode === "auto") player?.qualities?.autoSelect?.();
      return;
    }
    const quality = player.qualities?.toArray?.()[nextQualityMode];
    const remote = (player as unknown as {
      remoteControl?: { changeQuality?: (index: number, trigger?: Event) => void };
    }).remoteControl;
    remote?.changeQuality?.(nextQualityMode);
    if (quality) quality.selected = true;
    activeQualityLabel = quality ? qualityLabel(quality, nextQualityMode) : activeQualityLabel;
  }

  function selectSubtitle(id: string | null) {
    if (controlledSubtitleId === undefined) internalSubtitleId = id;
    onActiveSubtitleTrackIdChange?.(id);
    closeMenus();
  }

  function toggleSubtitles() {
    if (activeSubtitleId) {
      selectSubtitle(null);
      return;
    }
    const preferred = subtitleDefaults
      ? pickPreferredSubtitleTrack(
          subtitleTracks.map((track) => ({ id: track.id, language: track.language })),
          subtitleDefaults.preferredLanguages,
        )
      : null;
    selectSubtitle(preferred ?? subtitleTracks[0]?.id ?? null);
  }

  function handleAppearanceChange(next: SubtitleAppearance) {
    localAppearance = next;
    writeLocalSubtitleAppearance(next);
  }

  function handleAppearanceReset() {
    localAppearance = null;
    writeLocalSubtitleAppearance(null);
  }

  function togglePlay() {
    if (!player) return;
    if (player.paused) void player.play();
    else void player.pause();
  }

  function seek(delta: number) {
    seekTo(currentTime + delta);
  }

  function seekTo(time: number) {
    if (!player) return;
    const target = Math.max(0, Math.min(duration || time, time));
    player.currentTime = target;
    currentTime = target;
    onTimeUpdate?.(target);
  }

  function toggleMute() {
    if (!player) return;
    player.muted = !player.muted;
    if (!player.muted && player.volume === 0) player.volume = 1;
    muted = player.muted;
    volume = player.volume;
  }

  function handleVolumeChange(next: number) {
    if (!player) return;
    player.volume = next;
    player.muted = next === 0;
    volume = next;
    muted = next === 0;
  }

  function applyPlaybackRate(nextRate: number) {
    if (!player) return;
    player.playbackRate = nextRate;
    playbackRate = nextRate;
    closeMenus();
  }

  function requestCast(event: MouseEvent) {
    if (!player) return;
    const remote = (player as unknown as {
      remoteControl?: {
        requestAirPlay?: (trigger?: Event) => void;
        requestGoogleCast?: (trigger?: Event) => void;
      };
    }).remoteControl;
    if (!remote) {
      playerNotice = "Casting is not available for this player.";
      return;
    }
    if ("WebKitPlaybackTargetAvailabilityEvent" in window) {
      remote.requestAirPlay?.(event);
      return;
    }
    remote.requestGoogleCast?.(event);
  }

  function openSettings(view: SettingsView = "root") {
    clearSettingsCloseTimer();
    settingsView = view;
    settingsMenuRendered = true;
    settingsMenuClosing = false;
  }

  function closeSettings() {
    if (!settingsMenuRendered || settingsMenuClosing) return;
    clearSettingsCloseTimer();
    settingsMenuClosing = true;
    settingsCloseTimer = window.setTimeout(() => {
      settingsMenuRendered = false;
      settingsMenuClosing = false;
      settingsView = "root";
      settingsCloseTimer = null;
    }, 180);
  }

  function toggleSettings() {
    if (settingsMenuRendered && !settingsMenuClosing) {
      closeSettings();
      return;
    }
    openSettings();
  }

  function toggleFullscreen() {
    if (isDocumentFullscreen()) {
      exitDocumentFullscreen();
      return;
    }
    if (!containerEl) return;
    enterMediaFullscreen(containerEl, videoEl);
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
      .filter((marker) => Math.abs(marker.time - time) <= windowSec)
      .map((marker) => marker.title);
    timelineHover = { markerTitles, percent: percent * 100, time };
  }

  function handleFilmStripInteraction(active: boolean) {
    if (active) {
      clearControlsTimer();
      showControls = false;
      closeMenus();
    } else {
      surfaceControls();
    }
  }

  function wait(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function updateActiveCue() {
    if (!activeSubtitleId || activeTrackCues.length === 0) {
      if (activeCueText !== null) {
        activeCueText = null;
        onActiveCueChange?.(null);
      }
      return;
    }
    const cue = activeTrackCues.find((candidate) => (
      currentTime >= candidate.start && currentTime < candidate.end
    ));
    const text = cue?.text.replace(/<[^>]+>/g, "") || null;
    if (text === activeCueText) return;
    activeCueText = text;
    onActiveCueChange?.(cue && text ? { start: cue.start, end: cue.end, text } : null);
  }

  $effect(() => {
    handle = {
      seekTo,
    };
  });

  $effect(() => {
    const nextKey = `${src ?? ""}|${directSrc ?? ""}|${defaultPlaybackMode ?? ""}|${directPlayable ? "direct" : "adaptive"}`;
    if (nextKey === lastSourceKey) return;
    lastSourceKey = nextKey;
    playbackMode = initialPlaybackMode();
    qualityMode = playbackMode === "direct" ? "direct" : "auto";
    currentTime = 0;
    duration = propDuration ?? 0;
    bufferedProgress = 0;
    bufferAhead = 0;
    playerNotice = null;
    activeQualityLabel = null;
    playTracked = false;
    autoSelected = false;
  });

  $effect(() => {
    const nextSrc = requestedPlayerSrc;
    if (!nextSrc) {
      hlsReadySrc = undefined;
      return;
    }

    const statusUrl = effectiveMode === "hls" ? hlsStatusUrlForSrc(nextSrc) : null;
    if (!statusUrl) {
      hlsReadySrc = nextSrc;
      return;
    }

    let cancelled = false;
    hlsReadySrc = undefined;
    buffering = true;
    playerNotice = "Preparing adaptive stream...";

    const poll = async () => {
      while (!cancelled) {
        try {
          const response = await fetch(statusUrl, { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`HLS status failed (${response.status})`);
          }
          const status = (await response.json()) as HlsStatus;
          if (status.state === "ready") {
            if (!cancelled) {
              hlsReadySrc = nextSrc;
              playerNotice = null;
            }
            return;
          }
          if (status.state === "error") {
            throw new Error(status.error ?? "HLS generation failed");
          }
        } catch (error) {
          if (!cancelled) {
            playerNotice = error instanceof Error ? error.message : String(error);
            buffering = false;
          }
          return;
        }
        await wait(HLS_RETRY_AFTER_SECONDS * 1000);
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    if (propDuration && propDuration > duration) duration = propDuration;
  });

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
      subtitleTracks.map((track) => ({ id: track.id, language: track.language })),
      subtitleDefaults.preferredLanguages,
    );
    if (picked) {
      autoSelected = true;
      selectSubtitle(picked);
    }
  });

  $effect(() => {
    if (!activeSubtitleId) {
      activeTrackCues = [];
      activeCueText = null;
      onActiveCueChange?.(null);
      return;
    }
    const track = subtitleTracks.find((candidate) => candidate.id === activeSubtitleId);
    if (!track || track.sourceFormat === "ass" || track.sourceFormat === "ssa") {
      activeTrackCues = [];
      activeCueText = null;
      onActiveCueChange?.(null);
      return;
    }

    let cancelled = false;
    fetchVideoSubtitleCues(track.videoId, track.id)
      .then(({ cues }) => {
        if (!cancelled) activeTrackCues = cues;
      })
      .catch(() => {
        if (!cancelled) activeTrackCues = [];
      });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    currentTime;
    activeTrackCues;
    activeSubtitleId;
    updateActiveCue();
  });

  $effect(() => {
    const el = player;
    if (!el) return;

    const listeners: Array<[string, EventListener]> = [
      ["provider-change", handleProviderChange],
      ["can-play", handleCanPlay],
      ["time-update", handleTimeUpdate],
      ["play", handlePlay],
      ["playing", handlePlaying],
      ["pause", handlePause],
      ["ended", handleEnded],
      ["waiting", handleWaiting],
      ["seeking", handleWaiting],
      ["seeked", handlePlaying],
      ["volume-change", handleVolumeChangeEvent],
      ["rate-change", handleRateChange],
      ["progress", handleProgress],
      ["audio-tracks-change", handleAudioTracksChange],
      ["audio-track-change", handleAudioTrackChange],
      ["qualities-change", handleQualitiesChange],
      ["quality-change", handleQualityChange],
      ["error", handleError],
    ];

    for (const [type, listener] of listeners) el.addEventListener(type, listener);
    return () => {
      for (const [type, listener] of listeners) el.removeEventListener(type, listener);
    };
  });

  $effect(() => {
    const video = videoEl;
    if (!video) return;
    const onProgress = () => updateBuffered();
    const onLoadedMetadata = () => {
      duration = Math.max(video.duration || 0, propDuration ?? 0);
      updateBuffered();
    };
    video.addEventListener("progress", onProgress);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => {
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  });

  onMount(() => {
    mediaMounted = true;
    directCapabilityProbe = document.createElement("video");
    localAppearance = readLocalSubtitleAppearance();
    syncVideoElement();

    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) break;
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
    return () => {
      clearControlsTimer();
      clearSettingsCloseTimer();
      window.removeEventListener("keydown", handleKey);
      onActiveCueChange?.(null);
    };
  });

  function handleProviderChange(event: Event) {
    const provider = (event as MediaProviderChangeEvent).detail;
    if (isHLSProvider(provider)) {
      provider.config = {
        ...adaptiveHlsBufferConfig(),
        capLevelToPlayerSize: true,
      };
    }
    syncVideoElement();
  }

  function handleCanPlay(event: Event) {
    const detail = (event as MediaCanPlayEvent).detail;
    duration = Math.max(detail.duration || 0, propDuration ?? 0);
    buffering = false;
    syncVideoElement();
    refreshQualities();
    refreshAudioTracks();
    updateBuffered();
    if (pendingSeekTime !== null) {
      player!.currentTime = Math.min(duration || pendingSeekTime, pendingSeekTime);
      pendingSeekTime = null;
    }
    if ((pendingAutoPlay || autoPlay) && player?.paused) {
      pendingAutoPlay = false;
      void player.play();
    }
  }

  function handleTimeUpdate(event: Event) {
    const detail = (event as MediaTimeUpdateEvent).detail;
    currentTime = detail.currentTime;
    onTimeUpdate?.(detail.currentTime);
    updateBuffered();
  }

  function handlePlay(_event: Event) {
    playing = true;
    if (!playTracked) {
      playTracked = true;
      onPlayStarted?.();
    }
    scheduleControlsHide();
  }

  function handlePlaying(_event: Event) {
    buffering = false;
    playing = true;
    scheduleControlsHide();
  }

  function handlePause(_event: Event) {
    playing = false;
    showControls = true;
    clearControlsTimer();
  }

  function handleEnded(_event: Event) {
    playing = false;
    showControls = true;
    clearControlsTimer();
    onEnded?.();
  }

  function handleWaiting(_event: Event) {
    buffering = true;
  }

  function handleVolumeChangeEvent(_event: Event) {
    if (!player) return;
    muted = player.muted || player.volume === 0;
    volume = player.volume;
  }

  function handleRateChange(_event: Event) {
    if (player) playbackRate = player.playbackRate;
  }

  function handleProgress(_event: Event) {
    updateBuffered();
  }

  function handleAudioTracksChange(_event: Event) {
    refreshAudioTracks();
  }

  function handleAudioTrackChange(_event: Event) {
    refreshAudioTracks();
  }

  function handleQualitiesChange(_event: Event) {
    refreshQualities();
  }

  function handleQualityChange(_event: Event) {
    refreshQualities();
  }

  function handleError(event: Event) {
    const detail = (event as MediaErrorEvent).detail;
    const message = detail instanceof Error ? detail.message : "Playback failed.";
    playerNotice = `${effectiveMode === "direct" ? "Direct" : "Adaptive"} playback error: ${message}`;
    buffering = false;
  }
</script>

<div class="space-y-1" data-testid="vidstack-video-player">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={containerEl}
    class="relative surface-media-well bg-black"
    onmousemove={surfaceControls}
    onmouseleave={() => {
      if (playing) showControls = false;
    }}
    ontouchstart={surfaceControls}
  >
    {#if playerSrc && mediaMounted}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <media-player
        class="obscura-media-engine"
        title="Obscura video"
        src={playerSrc}
        poster={poster}
        streamType="on-demand"
        crossOrigin
        playsInline
        autoPlay={autoPlay}
        bind:this={player}
        onclick={(event) => {
          if (event.target === event.currentTarget || event.target instanceof HTMLVideoElement) {
            togglePlay();
          }
        }}
      >
        <media-provider>
          {#if poster}
            <media-poster class="vds-poster" src={poster} alt="Video poster"></media-poster>
          {/if}
        </media-provider>
      </media-player>
    {:else if requestedPlayerSrc}
      <div class="obscura-media-engine flex items-center justify-center">
        <Loader class="h-5 w-5 animate-spin text-white/40" />
      </div>
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

    <div
      class={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 bg-gradient-to-b from-black/75 via-black/30 to-transparent px-3 sm:px-4 pb-8 sm:pb-12 pt-3 sm:pt-4 transition-opacity duration-normal",
        showControls ? "opacity-100" : "opacity-0",
      )}
    >
      <div class="flex flex-wrap gap-1.5 sm:gap-2">
        <span class="pointer-events-auto player-chip border-accent-500/40 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-accent-100 sm:px-2.5 sm:py-1 sm:text-[0.62rem]">
          {activePlaybackLabel}
        </span>
        {#if playerNotice}
          <span class="player-chip border-warning/20 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[0.6rem] sm:text-[0.7rem] text-white/80">
            {playerNotice}
          </span>
        {/if}
      </div>

      <div
        class={cn(
          "hidden sm:grid gap-2 text-right text-[0.68rem] text-white/70",
          effectiveMode === "direct" ? "min-w-[120px] grid-cols-2" : "min-w-[184px] grid-cols-3",
        )}
      >
        {#if effectiveMode !== "direct"}
          <div class="player-chip px-2 py-1.5">
            <div class="mb-0.5 flex items-center justify-end gap-1 text-white/50">
              <Wifi class="h-3.5 w-3.5" />
              <span class="text-[0.58rem] uppercase tracking-[0.16em]">ABR</span>
            </div>
            <div class="truncate text-mono-tabular text-glow-phosphor text-[0.72rem] font-medium">
              {formatBandwidth(bandwidthEstimate)}
            </div>
          </div>
        {/if}
        <div class="player-chip px-2 py-1.5">
          <div class="mb-0.5 flex items-center justify-end gap-1 text-white/50">
            <Gauge class="h-3.5 w-3.5" />
            <span class="text-[0.58rem] uppercase tracking-[0.16em]">Buffer</span>
          </div>
          <div class="truncate text-mono-tabular text-glow-phosphor text-[0.72rem] font-medium">
            {bufferAhead.toFixed(1)}s
          </div>
        </div>
        <div class="player-chip px-2 py-1.5">
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

    <div
      class={cn(
        "pointer-events-none absolute inset-0 z-30 flex items-center justify-center transition-opacity duration-normal sm:hidden",
        showControls ? "opacity-100" : "opacity-0",
      )}
    >
      <div class="pointer-events-auto flex items-center gap-3">
        <button
          type="button"
          onclick={(event) => {
            event.stopPropagation();
            seek(-10);
          }}
          class="relative flex h-7 w-7 items-center justify-center text-white/72 transition-colors hover:text-white"
          title="Skip back 10s"
          aria-label="Skip back 10s"
        >
          <RotateCcw class="h-4 w-4" />
          <span class="absolute mt-[1px] text-[0.42rem] font-bold">10</span>
        </button>
        <button
          type="button"
          onclick={(event) => {
            event.stopPropagation();
            togglePlay();
          }}
          class="flex h-8 w-8 items-center justify-center bg-gradient-to-b from-accent-400 to-accent-500 text-accent-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_0_12px_rgba(199,155,92,0.2)] transition-all hover:from-accent-300 hover:to-accent-400 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_16px_rgba(199,155,92,0.28)]"
          aria-label={playing ? "Pause" : "Play"}
        >
          {#if buffering}
            <Loader class="h-3.5 w-3.5 animate-spin" />
          {:else if playing}
            <Pause class="h-3.5 w-3.5" fill="currentColor" />
          {:else}
            <span class="play-glyph" aria-hidden="true"></span>
          {/if}
        </button>
        <button
          type="button"
          onclick={(event) => {
            event.stopPropagation();
            seek(10);
          }}
          class="relative flex h-7 w-7 items-center justify-center text-white/72 transition-colors hover:text-white"
          title="Skip forward 10s"
          aria-label="Skip forward 10s"
        >
          <RotateCw class="h-4 w-4" />
          <span class="absolute mt-[1px] text-[0.42rem] font-bold">10</span>
        </button>
      </div>
    </div>

    <div
      class={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/92 via-black/58 to-transparent px-3 pb-1.5 pt-8 transition-opacity duration-normal sm:px-4 sm:pb-4 sm:pt-20",
        showControls ? "opacity-100" : "opacity-0",
      )}
    >
      <div class="flex flex-col gap-2">
        <div class="pointer-events-auto order-2 py-2 sm:order-1 sm:py-2.5">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="video-progress-track mobile-video-progress group/track"
          data-dragging={isDragging}
          onpointerdown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            isDraggingRef = true;
            isDragging = true;
            const rect = event.currentTarget.getBoundingClientRect();
            updateTimelineHover(event.clientX, rect);
            const nextPercent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            seekTo(nextPercent * duration);
          }}
          onpointermove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            updateTimelineHover(event.clientX, rect);
            if (!isDraggingRef) return;
            const nextPercent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            seekTo(nextPercent * duration);
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
                seekTo(marker.time);
                onMarkerClick?.(marker);
              }}
              title={marker.title}
              aria-label={marker.title}
            ></button>
          {/each}
        </div>
        </div>

        {#if markers.length > 0}
          <div class="order-3 hidden flex-wrap gap-1.5 sm:flex">
            {#each markers as marker (marker.id)}
              <button
                type="button"
                onclick={() => {
                  seekTo(marker.time);
                  onMarkerClick?.(marker);
                }}
                class="player-chip px-2.5 py-1 text-[0.68rem] text-white/72 transition-colors hover:border-accent-400/35 hover:text-white"
              >
                {marker.title}
              </button>
            {/each}
          </div>
        {/if}

        <div class="pointer-events-auto order-1 flex flex-col gap-2 sm:order-2 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex w-full items-center justify-end gap-2 sm:w-auto sm:justify-start sm:gap-2.5">
            <div class="hidden items-center gap-2.5 sm:flex">
              <button
                type="button"
                onclick={() => seek(-10)}
                class="relative flex h-9 w-7 items-center justify-center text-white/70 transition-colors hover:text-white"
                title="Skip back 10s"
                aria-label="Skip back 10s"
              >
                <RotateCcw class="h-4 w-4" />
                <span class="absolute mt-[1px] text-[0.45rem] font-bold">10</span>
              </button>
              <button
                type="button"
                onclick={togglePlay}
                class="flex h-9 w-9 items-center justify-center bg-gradient-to-b from-accent-400 to-accent-500 text-accent-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_0_14px_rgba(199,155,92,0.2)] transition-all hover:from-accent-300 hover:to-accent-400 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_20px_rgba(199,155,92,0.28)]"
                aria-label={playing ? "Pause" : "Play"}
              >
                {#if buffering}
                  <Loader class="h-3.5 w-3.5 animate-spin" />
                {:else if playing}
                  <Pause class="h-3.5 w-3.5" fill="currentColor" />
                {:else}
                  <span class="play-glyph" aria-hidden="true"></span>
                {/if}
              </button>
              <button
                type="button"
                onclick={() => seek(10)}
                class="relative flex h-9 w-7 items-center justify-center text-white/70 transition-colors hover:text-white"
                title="Skip forward 10s"
                aria-label="Skip forward 10s"
              >
                <RotateCw class="h-4 w-4" />
                <span class="absolute mt-[1px] text-[0.45rem] font-bold">10</span>
              </button>
            </div>

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
                oninput={(event) => handleVolumeChange(Number(event.currentTarget.value))}
                class="obscura-range h-1.5 w-20"
              />
            </div>

            <span class="shrink-0 whitespace-nowrap text-mono-tabular text-glow-phosphor text-[0.7rem] sm:text-xs">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div class="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
            <div class="flex min-w-0 shrink items-center gap-2">
              {#if subtitleTracks.length > 0}
                <button
                  type="button"
                  onclick={toggleSubtitles}
                  aria-label={activeSubtitleId ? "Turn captions off" : "Turn captions on"}
                  class={cn(
                    "player-control-button subtitle-control-button text-[0.56rem] transition-colors hover:border-white/20 hover:text-white sm:text-[0.72rem]",
                    activeSubtitleId ? "text-accent-100" : "text-white/82",
                  )}
                >
                  <Captions class="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
              {/if}
            </div>

            <div class="relative flex min-w-0 items-center justify-end gap-2">
              <button
                type="button"
                onclick={toggleSettings}
                class={cn(
                  "player-control-button justify-center p-0 text-white/80 transition-colors hover:border-white/20 hover:text-white",
                  settingsMenuRendered &&
                    !settingsMenuClosing &&
                    "border-accent-500/40 text-accent-100 shadow-[var(--shadow-glow-accent)]",
                )}
                aria-label="Player settings"
                aria-expanded={settingsMenuRendered && !settingsMenuClosing}
              >
                <Settings2 class="h-3 w-3 sm:h-4 sm:w-4" />
              </button>

              {#if showCastControls}
                <button
                  type="button"
                  onclick={requestCast}
                  class="player-control-button justify-center p-0 text-white/80 transition-colors hover:border-white/20 hover:text-white"
                  aria-label="Cast"
                  title="Cast"
                >
                  <Cast class="h-3 w-3 sm:h-4 sm:w-4" />
                </button>
              {/if}

              <button
                type="button"
                onclick={toggleFullscreen}
                class="player-control-button justify-center p-0 text-white/80 transition-colors hover:border-white/20 hover:text-white"
                aria-label="Fullscreen"
              >
                <Maximize class="h-3 w-3 sm:h-4 sm:w-4" />
              </button>

              {#if settingsMenuRendered}
                <button
                  type="button"
                  class={cn("player-settings-backdrop", settingsMenuClosing && "is-closing")}
                  aria-label="Close player settings"
                  onclick={(event) => {
                    event.stopPropagation();
                    closeSettings();
                  }}
                ></button>
                <div
                  class={cn("player-settings-menu player-dropdown", settingsMenuClosing && "is-closing")}
                  role="menu"
                  aria-label="Player settings menu"
                >
                  {#if settingsView !== "root"}
                    <button
                      type="button"
                      class="player-settings-back"
                      onclick={() => (settingsView = "root")}
                    >
                      <ChevronLeft class="h-4 w-4" />
                      <span>
                        {settingsView === "quality"
                          ? "Quality"
                          : settingsView === "speed"
                            ? "Speed"
                            : settingsView === "audio"
                              ? "Audio"
                              : settingsView === "captions"
                                ? "Captions"
                                : "Subtitle style"}
                      </span>
                    </button>
                  {/if}

                  {#if settingsView === "root"}
                    <button type="button" class="player-settings-row" onclick={() => openSettings("quality")}>
                      <Gauge class="h-4 w-4" />
                      <span>Quality</span>
                      <span class="player-settings-value">{selectedQualityLabel ?? "Auto"}</span>
                      <ChevronDown class="h-3.5 w-3.5 -rotate-90" />
                    </button>
                    <button type="button" class="player-settings-row" onclick={() => openSettings("speed")}>
                      <RotateCw class="h-4 w-4" />
                      <span>Speed</span>
                      <span class="player-settings-value">{playbackRate === 1 ? "Normal" : `${playbackRate}x`}</span>
                      <ChevronDown class="h-3.5 w-3.5 -rotate-90" />
                    </button>
                    <button type="button" class="player-settings-row" onclick={() => openSettings("audio")}>
                      <Volume2 class="h-4 w-4" />
                      <span>Audio</span>
                      <span class="player-settings-value">{displayedAudioTrackLabel}</span>
                      <ChevronDown class="h-3.5 w-3.5 -rotate-90" />
                    </button>
                    {#if subtitleTracks.length > 0}
                      <button type="button" class="player-settings-row" onclick={() => openSettings("captions")}>
                        <Captions class="h-4 w-4" />
                        <span>Captions</span>
                        <span class="player-settings-value">{activeSubtitleLabel}</span>
                        <ChevronDown class="h-3.5 w-3.5 -rotate-90" />
                      </button>
                      <button type="button" class="player-settings-row" onclick={() => openSettings("subtitle-style")}>
                        <Sliders class="h-4 w-4" />
                        <span>Subtitle style</span>
                        <span class="player-settings-value">Custom</span>
                        <ChevronDown class="h-3.5 w-3.5 -rotate-90" />
                      </button>
                    {/if}
                  {:else if settingsView === "quality"}
                    {#each qualityOptions as option (String(option.value))}
                      <button
                        type="button"
                        onclick={() => requestPlaybackMode(option.value)}
                        class={cn("player-settings-option", qualityMode === option.value && "is-active")}
                      >
                        <span>{option.label}</span>
                        {#if qualityMode === option.value}<span>On</span>{/if}
                      </button>
                    {/each}
                  {:else if settingsView === "speed"}
                    {#each PLAYBACK_RATES as rate (rate)}
                      <button
                        type="button"
                        onclick={() => applyPlaybackRate(rate)}
                        class={cn("player-settings-option", playbackRate === rate && "is-active")}
                      >
                        <span>{rate === 1 ? "Normal" : `${rate}x`}</span>
                        {#if playbackRate === rate}<span>On</span>{/if}
                      </button>
                    {/each}
                  {:else if settingsView === "audio"}
                    {#each displayedAudioTracks as track (track.id)}
                      <button
                        type="button"
                        onclick={() => selectAudioTrack(track.index)}
                        class={cn("player-settings-option", track.selected && "is-active")}
                      >
                        <span class="min-w-0 truncate">{track.label}</span>
                        {#if track.selected}<span>On</span>{/if}
                      </button>
                    {/each}
                  {:else if settingsView === "captions"}
                    <button
                      type="button"
                      onclick={() => selectSubtitle(null)}
                      class={cn("player-settings-option", !activeSubtitleId && "is-active")}
                    >
                      <span>Off</span>
                      {#if !activeSubtitleId}<span>On</span>{/if}
                    </button>
                    {#each subtitleTracks as track (track.id)}
                      {@const isActive = activeSubtitleId === track.id}
                      {@const lang = languageLabel(track.language)}
                      {@const displayName = track.label ? `${lang} - ${track.label}` : lang}
                      <button
                        type="button"
                        onclick={() => selectSubtitle(track.id)}
                        class={cn("player-settings-option", isActive && "is-active")}
                      >
                        <span class="min-w-0 flex-1 truncate">{displayName}</span>
                        <span>{isActive ? "On" : track.source}</span>
                      </button>
                    {/each}
                  {:else if settingsView === "subtitle-style"}
                    <div class="space-y-3 p-2">
                      <div class="grid gap-1.5">
                        {#each subtitleDisplayStyles as style (style)}
                          <button
                            type="button"
                            onclick={() => handleAppearanceChange({ ...appearance, style })}
                            class={cn("player-settings-option", appearance.style === style && "is-active")}
                          >
                            <span class="capitalize">{style}</span>
                            {#if appearance.style === style}<span>On</span>{/if}
                          </button>
                        {/each}
                      </div>

                      <label class="player-settings-slider">
                        <span>Text size</span>
                        <span>{appearance.fontScale.toFixed(2)}x</span>
                        <input
                          type="range"
                          min="0.5"
                          max="3"
                          step="0.05"
                          value={appearance.fontScale}
                          oninput={(event) =>
                            handleAppearanceChange({ ...appearance, fontScale: Number(event.currentTarget.value) })}
                        />
                      </label>

                      <label class="player-settings-slider">
                        <span>Position</span>
                        <span>{Math.round(appearance.positionPercent)}%</span>
                        <input
                          type="range"
                          min="10"
                          max="98"
                          step="1"
                          value={appearance.positionPercent}
                          oninput={(event) =>
                            handleAppearanceChange({
                              ...appearance,
                              positionPercent: Number(event.currentTarget.value),
                            })}
                        />
                      </label>

                      <label class="player-settings-slider">
                        <span>Opacity</span>
                        <span>{Math.round(appearance.opacity * 100)}%</span>
                        <input
                          type="range"
                          min="0.2"
                          max="1"
                          step="0.05"
                          value={appearance.opacity}
                          oninput={(event) =>
                            handleAppearanceChange({ ...appearance, opacity: Number(event.currentTarget.value) })}
                        />
                      </label>

                      <button
                        type="button"
                        onclick={handleAppearanceReset}
                        disabled={localAppearance == null}
                        class={cn("player-settings-reset", localAppearance == null && "is-disabled")}
                      >
                        Reset to library defaults
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
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
        currentTime={currentTime}
        {duration}
        onSeek={seekTo}
        {markers}
        onStripInteractionChange={handleFilmStripInteraction}
      />
    </div>
  {/if}
</div>

<style>
  .obscura-media-engine {
    aspect-ratio: 16 / 9;
    background: #000;
    color: #f2eee7;
    display: block;
    margin-inline: auto;
    max-width: calc((100dvh - 14rem) * 16 / 9);
    width: 100%;
  }

  .obscura-media-engine :global(video),
  .obscura-media-engine :global(media-poster) {
    background: #000;
    border-radius: 0;
    height: 100%;
    object-fit: contain;
    width: 100%;
  }

  .obscura-range {
    appearance: none;
    background: rgba(255, 255, 255, 0.18);
    border-radius: 0;
    cursor: pointer;
  }

  .obscura-range::-webkit-slider-thumb {
    appearance: none;
    width: 0.72rem;
    height: 0.72rem;
    border-radius: 0;
    background: var(--color-accent-300);
    box-shadow: 0 0 10px rgba(199, 155, 92, 0.65);
  }

  .obscura-range::-moz-range-thumb {
    width: 0.72rem;
    height: 0.72rem;
    border: 0;
    border-radius: 0;
    background: var(--color-accent-300);
    box-shadow: 0 0 10px rgba(199, 155, 92, 0.65);
  }

  .player-control-button {
    align-items: center;
    background: rgba(17, 21, 28, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.06),
      inset 0 0 0 0.5px rgba(255, 255, 255, 0.04),
      0 2px 8px rgba(0, 0, 0, 0.3);
    display: flex;
    height: 1.75rem;
    min-height: 1.75rem;
    min-width: 1.75rem;
  }

  .play-glyph {
    display: block;
    height: 0.875rem;
    position: relative;
    width: 0.875rem;
  }

  .play-glyph::before {
    border-bottom: 0.36rem solid transparent;
    border-left: 0.56rem solid currentColor;
    border-top: 0.36rem solid transparent;
    content: "";
    left: 50%;
    position: absolute;
    top: 50%;
    transform: translate(-42%, -50%);
  }

  .play-glyph-lg {
    height: 1rem;
    width: 1rem;
  }

  .play-glyph-lg::before {
    border-bottom-width: 0.42rem;
    border-left-width: 0.64rem;
    border-top-width: 0.42rem;
  }

  .subtitle-control-button {
    justify-content: center;
    padding-left: 0.125rem;
    padding-right: 0.25rem;
    width: 2.125rem;
  }

  .subtitle-control-glyph {
    align-items: center;
    display: grid;
    gap: 0.12rem;
    grid-template-columns: 1fr 1fr;
    justify-items: center;
    margin-left: 0.02rem;
    width: 1.24rem;
  }

  .player-settings-menu {
    animation: player-settings-sheet-in 180ms ease-out;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 5rem);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: min(64dvh, 28rem);
    min-width: min(25rem, calc(100vw - 1.5rem));
    overflow-y: auto;
    padding: 0.35rem;
    position: fixed;
    right: 0.75rem;
    z-index: 210;
  }

  .player-settings-menu.is-closing {
    animation: player-settings-sheet-out 160ms ease-in forwards;
  }

  .player-settings-backdrop {
    background: rgba(0, 0, 0, 0.38);
    border: 0;
    bottom: 0;
    left: 0;
    position: fixed;
    right: 0;
    top: 0;
    z-index: 205;
  }

  .player-settings-backdrop.is-closing {
    animation: player-settings-backdrop-out 160ms ease-in forwards;
  }

  .player-settings-row,
  .player-settings-option,
  .player-settings-back {
    align-items: center;
    border: 1px solid transparent;
    color: rgba(255, 255, 255, 0.82);
    display: grid;
    gap: 0.75rem;
    min-height: 2.5rem;
    padding: 0.55rem 0.7rem;
    text-align: left;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
    width: 100%;
  }

  .player-settings-row {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
  }

  .player-settings-option {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .player-settings-back {
    border-bottom-color: rgba(255, 255, 255, 0.1);
    font-size: 0.75rem;
    font-weight: 600;
    grid-template-columns: auto minmax(0, 1fr);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .player-settings-row:hover,
  .player-settings-option:hover,
  .player-settings-back:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .player-settings-option.is-active {
    background: rgba(196, 154, 90, 0.16);
    border-color: rgba(196, 154, 90, 0.42);
    color: var(--color-accent-100);
  }

  .player-settings-value {
    color: rgba(255, 255, 255, 0.58);
    font-size: 0.7rem;
    min-width: 0;
    overflow: hidden;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .player-settings-slider {
    color: rgba(255, 255, 255, 0.78);
    display: grid;
    font-size: 0.72rem;
    gap: 0.45rem;
    grid-template-columns: 1fr auto;
  }

  .player-settings-slider input {
    accent-color: var(--color-accent-500);
    grid-column: 1 / -1;
    width: 100%;
  }

  .player-settings-reset {
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.78);
    padding: 0.55rem 0.75rem;
    transition:
      border-color 120ms ease,
      color 120ms ease;
    width: 100%;
  }

  .player-settings-reset:hover {
    border-color: rgba(255, 255, 255, 0.3);
    color: #fff;
  }

  .player-settings-reset.is-disabled {
    border-color: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.3);
    cursor: not-allowed;
  }

  @keyframes player-settings-sheet-in {
    from {
      opacity: 0;
      transform: translateY(calc(100% + 1.25rem));
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes player-settings-sheet-out {
    from {
      opacity: 1;
      transform: translateY(0);
    }

    to {
      opacity: 0;
      transform: translateY(calc(100% + 1.25rem));
    }
  }

  @keyframes player-settings-backdrop-out {
    from {
      opacity: 1;
    }

    to {
      opacity: 0;
    }
  }

  @keyframes player-settings-flyout-in {
    from {
      opacity: 0;
      transform: translateY(0.45rem) scaleY(0.96);
    }

    to {
      opacity: 1;
      transform: translateY(0) scaleY(1);
    }
  }

  @keyframes player-settings-flyout-out {
    from {
      opacity: 1;
      transform: translateY(0) scaleY(1);
    }

    to {
      opacity: 0;
      transform: translateY(0.45rem) scaleY(0.96);
    }
  }

  .mobile-video-progress {
    height: 5px;
  }

  .mobile-video-progress:hover,
  .mobile-video-progress[data-dragging="true"] {
    height: 6px;
  }

  @media (min-width: 640px) {
    .mobile-video-progress {
      height: 8px;
    }

    .mobile-video-progress:hover,
    .mobile-video-progress[data-dragging="true"] {
      height: 10px;
    }

    .player-control-button {
      height: 2.25rem;
      min-height: 2.25rem;
      min-width: 2.25rem;
    }

    .subtitle-control-button {
      padding-left: 0.5rem;
      padding-right: 0.55rem;
      width: 3rem;
    }

    .subtitle-control-glyph {
      gap: 0.28rem;
      width: 2rem;
    }

    .player-settings-menu {
      animation: player-settings-flyout-in 160ms ease-out;
      bottom: 3rem;
      min-width: 19rem;
      transform-origin: bottom right;
      position: absolute;
      right: 0;
      width: 22rem;
    }

    .player-settings-menu.is-closing {
      animation: player-settings-flyout-out 140ms ease-in forwards;
    }

    .player-settings-backdrop {
      display: none;
    }
  }
</style>
