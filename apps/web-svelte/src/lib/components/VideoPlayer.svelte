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
  import "vidstack/player/styles/default/theme.css";
  import "vidstack/player/styles/default/layouts/video.css";
  import "vidstack/player";
  import "vidstack/player/layouts";
  import "vidstack/player/ui";

  import { onMount } from "svelte";
  import {
    isHLSProvider,
    type AudioTrack,
    type MediaCanPlayEvent,
    type MediaErrorEvent,
    type MediaProviderChangeEvent,
    type MediaTimeUpdateEvent,
  } from "vidstack";
  import type { MediaPlayerElement } from "vidstack/elements";
  import type { SubtitleAppearance, VideoSubtitleTrackDto } from "@obscura/contracts";
  import FilmStrip from "./FilmStrip.svelte";
  import { adaptiveHlsBufferConfig } from "$lib/player/video-player-load";
  import { pickPreferredSubtitleTrack } from "$lib/player/subtitle-appearance";

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
    onEnded?: () => void;
    autoPlay?: boolean;
    handle?: VideoPlayerHandle;
  }

  type PlaybackMode = "direct" | "hls";

  interface AudioTrackOption {
    id: string;
    label: string;
    language: string;
    selected: boolean;
  }

  let {
    src,
    directSrc,
    codec,
    poster,
    markers = [],
    duration: propDuration,
    onPlayStarted,
    onTimeUpdate,
    trickplaySprite,
    trickplayVtt,
    subtitleTracks = [],
    activeSubtitleTrackId,
    onActiveSubtitleTrackIdChange,
    onActiveCueChange,
    subtitleChoiceLocked = false,
    subtitleDefaults,
    defaultPlaybackMode,
    onEnded,
    autoPlay = false,
    handle = $bindable(),
  }: Props = $props();

  let player: MediaPlayerElement | undefined = $state();
  let videoEl: HTMLVideoElement | null = $state(null);
  let currentTime = $state(0);
  let discoveredDuration = $state(0);
  let playbackMode = $state<PlaybackMode>("hls");
  let sourceKey = $state("");
  let audioTracks = $state<AudioTrackOption[]>([]);
  let selectedAudioTrackId = $state("");
  let providerLabel = $state("Vidstack");
  let playerNotice = $state<string | null>(null);

  const effectiveMode = $derived<PlaybackMode>(
    playbackMode === "direct" && directSrc ? "direct" : "hls",
  );
  const playerSrc = $derived(effectiveMode === "direct" ? directSrc : src);
  const displayDuration = $derived(propDuration ?? discoveredDuration);
  const hasFilmStrip = $derived(Boolean(trickplaySprite && trickplayVtt && displayDuration > 0));
  const supportedSubtitleTracks = $derived(
    subtitleTracks.filter((track) => track.sourceFormat !== "ass" && track.sourceFormat !== "ssa"),
  );

  function initialPlaybackMode(): PlaybackMode {
    if (defaultPlaybackMode === "hls") return "hls";
    return directSrc ? "direct" : "hls";
  }

  function syncVideoElement() {
    videoEl = player?.querySelector("video") ?? null;
  }

  function refreshAudioTracks() {
    const tracks = player?.audioTracks?.toArray?.() ?? [];
    audioTracks = tracks.map((track, index) => ({
      id: track.id,
      label: audioTrackLabel(track, index),
      language: track.language,
      selected: track.selected,
    }));
    selectedAudioTrackId =
      tracks.find((track) => track.selected)?.id ?? tracks[0]?.id ?? "";
  }

  function audioTrackLabel(track: AudioTrack, index: number): string {
    const label = track.label || track.language || track.kind || `Track ${index + 1}`;
    return track.language && !label.toLowerCase().includes(track.language.toLowerCase())
      ? `${label} · ${track.language}`
      : label;
  }

  function selectAudioTrack(id: string) {
    const track = player?.audioTracks?.getById(id);
    if (!track) return;
    track.selected = true;
    selectedAudioTrackId = id;
    refreshAudioTracks();
  }

  function seekTo(time: number) {
    if (!player) return;
    const target = Math.max(0, Math.min(displayDuration || Number.MAX_SAFE_INTEGER, time));
    player.currentTime = target;
    currentTime = target;
    onTimeUpdate?.(target);
  }

  $effect(() => {
    handle = {
      seekTo,
    };
  });

  $effect(() => {
    const nextKey = `${src ?? ""}|${directSrc ?? ""}|${defaultPlaybackMode ?? ""}`;
    if (nextKey === sourceKey) return;
    sourceKey = nextKey;
    playbackMode = initialPlaybackMode();
    playerNotice = null;
    currentTime = 0;
    audioTracks = [];
    selectedAudioTrackId = "";
  });

  $effect(() => {
    if (!subtitleDefaults?.autoEnable || subtitleChoiceLocked || activeSubtitleTrackId) return;
    const next = pickPreferredSubtitleTrack(
      supportedSubtitleTracks.map((track) => ({
        id: track.id,
        language: track.language,
      })),
      subtitleDefaults.preferredLanguages,
    );
    if (next) onActiveSubtitleTrackIdChange?.(next);
  });

  onMount(() => {
    syncVideoElement();
    return () => {
      onActiveCueChange?.(null);
    };
  });

  $effect(() => {
    const el = player;
    if (!el) return;

    const listeners: Array<[string, EventListener]> = [
      ["provider-change", handleProviderChange as EventListener],
      ["can-play", handleCanPlay as EventListener],
      ["time-update", handleTimeUpdate as EventListener],
      ["play", handlePlay],
      ["ended", handleEnded],
      ["audio-tracks-change", handleAudioTracksChange as EventListener],
      ["audio-track-change", handleAudioTrackChange as EventListener],
      ["error", handleError],
    ];

    for (const [type, listener] of listeners) {
      el.addEventListener(type, listener);
    }

    return () => {
      for (const [type, listener] of listeners) {
        el.removeEventListener(type, listener);
      }
    };
  });

  function handleProviderChange(event: Event) {
    const provider = (event as MediaProviderChangeEvent).detail;
    providerLabel = provider?.type ? provider.type.toUpperCase() : "Vidstack";
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
    discoveredDuration = detail.duration || player?.duration || 0;
    syncVideoElement();
    refreshAudioTracks();
  }

  function handleTimeUpdate(event: Event) {
    const detail = (event as MediaTimeUpdateEvent).detail;
    currentTime = detail.currentTime;
    onTimeUpdate?.(detail.currentTime);
  }

  function handlePlay(_event: Event) {
    onPlayStarted?.();
  }

  function handleEnded(_event: Event) {
    onEnded?.();
  }

  function handleAudioTracksChange(_event: Event) {
    refreshAudioTracks();
  }

  function handleAudioTrackChange(_event: Event) {
    refreshAudioTracks();
  }

  function handleError(event: Event) {
    const detail = (event as MediaErrorEvent).detail;
    const message =
      detail instanceof Error ? detail.message : "Playback failed.";
    playerNotice = `${effectiveMode === "direct" ? "Direct" : "Adaptive"} playback error: ${message}`;
  }
</script>

<div class="relative surface-media-well bg-black" data-testid="vidstack-video-player">
  <div class="absolute left-4 right-4 top-4 z-20 flex flex-wrap items-center gap-2">
    <button
      type="button"
      class:active-mode={effectiveMode === "hls"}
      class="player-chip"
      aria-pressed={effectiveMode === "hls"}
      onclick={() => (playbackMode = "hls")}
    >
      Adaptive HLS
    </button>
    {#if directSrc}
      <button
        type="button"
        class:active-mode={effectiveMode === "direct"}
        class="player-chip"
        aria-pressed={effectiveMode === "direct"}
        onclick={() => (playbackMode = "direct")}
      >
        Direct
      </button>
    {/if}
    <span class="player-chip player-chip-muted">{providerLabel}</span>
    {#if codec}
      <span class="player-chip player-chip-muted">{codec}</span>
    {/if}
    {#if audioTracks.length > 1}
      <label class="player-chip player-audio-select">
        <span>Audio</span>
        <select
          aria-label="Audio track"
          value={selectedAudioTrackId}
          onchange={(event) => selectAudioTrack(event.currentTarget.value)}
        >
          {#each audioTracks as track (track.id)}
            <option value={track.id}>{track.label}</option>
          {/each}
        </select>
      </label>
    {/if}
  </div>

  {#if playerNotice}
    <div class="absolute left-4 right-4 top-16 z-20 border border-border-subtle bg-surface-2/95 px-3 py-2 text-sm text-text-muted backdrop-blur">
      {playerNotice}
    </div>
  {/if}

  {#if playerSrc}
    <media-player
      class="obscura-vidstack-player"
      title="Obscura video"
      src={playerSrc}
      poster={poster}
      streamType="on-demand"
      crossOrigin
      playsInline
      controls
      hideControlsOnMouseLeave={false}
      autoPlay={autoPlay}
      bind:this={player}
    >
      <media-provider>
        {#if poster}
          <media-poster class="vds-poster" src={poster} alt="Video poster"></media-poster>
        {/if}
        {#each supportedSubtitleTracks as track (track.id)}
          <track
            src={track.url}
            kind="subtitles"
            label={track.label ?? track.language ?? "Subtitles"}
            srclang={track.language ?? "und"}
            default={track.id === activeSubtitleTrackId}
          />
        {/each}
      </media-provider>

      <media-video-layout thumbnails={trickplayVtt}></media-video-layout>
    </media-player>
  {:else}
    <div class="flex aspect-video items-center justify-center border border-border-subtle bg-black text-sm uppercase tracking-[0.24em] text-text-muted">
      No playable source
    </div>
  {/if}

  {#if hasFilmStrip}
    <div class="border-t border-border-subtle bg-black">
      <FilmStrip
        spriteUrl={trickplaySprite!}
        vttUrl={trickplayVtt!}
        {videoEl}
        currentTime={currentTime}
        duration={displayDuration}
        onSeek={seekTo}
        {markers}
      />
    </div>
  {/if}
</div>

<style>
  .obscura-vidstack-player {
    --media-brand: #c49a5a;
    --media-focus-ring-color: rgba(196, 154, 90, 0.9);
    --media-focus-ring: 0 0 0 2px var(--media-focus-ring-color);
    --media-border-radius: 0;
    --video-brand: #c49a5a;
    --video-focus-ring-color: rgba(196, 154, 90, 0.9);
    --video-border-radius: 0;
    --video-controls-bg: linear-gradient(
      to top,
      rgba(4, 6, 10, 0.96),
      rgba(4, 6, 10, 0.64) 62%,
      transparent
    );
    --video-menu-bg: rgba(12, 16, 24, 0.96);
    --video-menu-border: 1px solid rgba(196, 154, 90, 0.24);
    --video-slider-track-bg: rgba(255, 255, 255, 0.18);
    --video-slider-track-fill-bg: linear-gradient(90deg, #c49a5a, #e2bd79);
    --video-slider-thumb-bg: #d7ad67;
    --video-tooltip-bg: rgba(12, 16, 24, 0.96);
    --video-tooltip-color: #f2eee7;
    aspect-ratio: 16 / 9;
    background: #000;
    color: #f2eee7;
    contain: layout;
    display: block;
    margin-inline: auto;
    max-width: calc((100dvh - 14rem) * 16 / 9);
    width: 100%;
  }

  .obscura-vidstack-player :global(video),
  .obscura-vidstack-player :global(media-poster) {
    border-radius: 0;
  }

  .obscura-vidstack-player :global(.vds-controls) {
    font-family: var(--font-body, Inter, sans-serif);
  }

  .player-chip {
    border: 1px solid rgba(148, 163, 184, 0.22);
    background: rgba(13, 18, 28, 0.82);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.36);
    color: rgba(241, 245, 249, 0.78);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    line-height: 1;
    min-height: 2.55rem;
    padding: 0 0.9rem;
    text-transform: uppercase;
    transition:
      border-color 160ms ease,
      box-shadow 160ms ease,
      color 160ms ease;
  }

  .player-chip:hover,
  .player-chip:focus-visible,
  .player-chip.active-mode {
    border-color: rgba(196, 154, 90, 0.72);
    box-shadow:
      0 0 0 1px rgba(196, 154, 90, 0.18),
      0 0 24px rgba(196, 154, 90, 0.24),
      0 16px 36px rgba(0, 0, 0, 0.38);
    color: #fff5df;
    outline: none;
  }

  .player-chip-muted {
    align-items: center;
    display: inline-flex;
    opacity: 0.76;
  }

  .player-audio-select {
    align-items: center;
    display: inline-flex;
    gap: 0.65rem;
    padding-right: 0.45rem;
  }

  .player-audio-select select {
    border: 1px solid rgba(196, 154, 90, 0.32);
    background: rgba(0, 0, 0, 0.46);
    color: #fff5df;
    font: inherit;
    letter-spacing: 0;
    min-height: 1.75rem;
    padding: 0 1.7rem 0 0.55rem;
  }
</style>
