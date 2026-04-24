<script module lang="ts">
  export type VideoThumbnailSize = "grid" | "list" | "compact" | "hero";
</script>

<script lang="ts">
  import { Captions, Clock, Film } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import NsfwShowModeChip from "./NsfwShowModeChip.svelte";
  import type { VideoCardData } from "$lib/video-card-data";
  import { createTrickplayScrub } from "./trickplay-scrub.svelte";

  interface Props {
    video: VideoCardData;
    size?: VideoThumbnailSize;
    imageLoading?: "eager" | "lazy";
    gradient?: string;
    class?: string;
  }

  let {
    video,
    size = "grid",
    imageLoading = "lazy",
    gradient,
    class: className,
  }: Props = $props();

  const scrub = createTrickplayScrub(() => ({
    trickplaySprite: video.trickplaySprite,
    trickplayVtt: video.trickplayVtt,
    scrubDurationSeconds: video.scrubDurationSeconds,
  }));

  let failedSources = $state<string[]>([]);
  const candidate = $derived(video.cardThumbnail || video.thumbnail || null);
  const thumbnailSrc = $derived.by(() => {
    if (!candidate) return null;
    return failedSources.includes(candidate) ? null : candidate;
  });
  const showThumbnail = $derived(thumbnailSrc !== null);

  function markFailed() {
    if (!candidate || failedSources.includes(candidate)) return;
    failedSources = [...failedSources, candidate];
  }

  let thumbEl: HTMLDivElement | undefined = $state();

  // Layout per size
  const containerClass = $derived.by(() => {
    switch (size) {
      case "list":
        return "relative w-28 flex-shrink-0 aspect-video overflow-hidden bg-surface-1";
      case "compact":
        return "relative shrink-0 overflow-hidden bg-surface-1 h-8 w-12";
      case "hero":
        return "relative aspect-video w-full overflow-hidden bg-surface-1";
      case "grid":
      default:
        return "relative aspect-video overflow-hidden bg-surface-1";
    }
  });

  const fallbackFrame = $derived.by(() => {
    switch (size) {
      case "compact":
        return { frame: "h-6 w-6", icon: "h-3.5 w-3.5" };
      case "list":
        return { frame: "h-11 w-11", icon: "h-5 w-5" };
      default:
        return { frame: "h-14 w-14", icon: "h-7 w-7" };
    }
  });

  const showChips = $derived(size === "grid" || size === "hero");
  const showListOverlays = $derived(size === "list");

  function formatHoverTime(seconds: number) {
    const total = Math.max(0, Math.floor(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={thumbEl}
  class={cn(containerClass, !showThumbnail && gradient, className)}
  onpointerenter={scrub.handlePointerEnter}
  onpointermove={(e) => scrub.handlePointerMove(e, thumbEl)}
  onpointerleave={scrub.handlePointerLeave}
  ontouchstart={scrub.handleTouchStart}
  ontouchmove={(e) => scrub.handleTouchMove(e, thumbEl)}
  ontouchend={scrub.handleTouchEnd}
>
  {#if showThumbnail}
    <img
      src={thumbnailSrc}
      alt={video.title}
      loading={imageLoading}
      decoding="async"
      class={cn(
        "h-full w-full object-cover transition-transform duration-normal",
        scrub.activeFrame
          ? "scale-[1.01] opacity-0"
          : size === "grid" || size === "hero"
            ? "group-hover:scale-[1.03]"
            : "",
      )}
      onerror={markFailed}
    />
  {:else}
    <div
      class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,239,213,0.16),transparent_38%),linear-gradient(180deg,rgba(7,8,11,0.06)_0%,rgba(7,8,11,0.55)_100%)]"
      aria-hidden="true"
    ></div>
    <div class="relative flex h-full w-full items-center justify-center">
      <div
        class={cn(
          "flex items-center justify-center border border-accent-500/25 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_24px_rgba(0,0,0,0.35)] backdrop-blur-sm",
          fallbackFrame.frame,
        )}
      >
        <Film
          class={cn(
            "text-accent-100 drop-shadow-[0_0_14px_rgba(196,154,90,0.24)]",
            fallbackFrame.icon,
          )}
        />
      </div>
    </div>
  {/if}

  {#if scrub.activeFrame && video.trickplaySprite && scrub.spriteDims.spriteWidth > 0 && scrub.spriteDims.spriteHeight > 0}
    {@const frame = scrub.activeFrame}
    {@const { spriteWidth, spriteHeight } = scrub.spriteDims}
    <div class="absolute inset-0 overflow-hidden">
      <div
        aria-hidden="true"
        class="absolute inset-0"
        style:background-image="url({video.trickplaySprite})"
        style:background-size="{(spriteWidth / frame.width) * 100}% {(spriteHeight / frame.height) * 100}%"
        style:background-position="{spriteWidth <= frame.width
          ? 0
          : (frame.x / (spriteWidth - frame.width)) * 100}% {spriteHeight <= frame.height
          ? 0
          : (frame.y / (spriteHeight - frame.height)) * 100}%"
        style:background-repeat="no-repeat"
      ></div>
      {#if size === "grid" || size === "hero"}
        <div
          class="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none"
        ></div>
      {/if}
    </div>
  {/if}

  {#if showChips}
    <div
      class="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent pointer-events-none"
    ></div>

    {#if video.duration}
      <span
        class="absolute bottom-1.5 left-1.5 flex items-center gap-1 media-chip px-1.5 py-0.5 text-[0.65rem] font-mono text-white/90"
      >
        <Clock class="h-2.5 w-2.5 text-white/60" />
        {video.duration}
      </span>
    {/if}

    <div class="absolute top-1.5 right-1.5 flex items-center gap-1">
      {#if video.hasSubtitles}
        <span
          class="media-chip flex items-center gap-0.5 px-1.5 py-0.5 text-[0.58rem] font-mono text-accent-100 border-accent-500/40"
          title="Closed captions available"
        >
          <Captions class="h-2.5 w-2.5" />
          CC
        </span>
      {/if}
      {#if video.resolution}
        <span class="pill-accent px-1.5 py-0.5 text-[0.58rem] font-semibold tracking-wide">
          {video.resolution}
        </span>
      {/if}
      {#if video.codec}
        <span class="media-chip px-1.5 py-0.5 text-[0.58rem] font-mono text-white/70">
          {video.codec}
        </span>
      {/if}
    </div>

    <div class="pointer-events-none absolute right-2 bottom-2 z-[25]">
      <NsfwShowModeChip isNsfw={video.isNsfw} />
    </div>

    {#if video.episodeNumber != null}
      <div class="pointer-events-none absolute left-1.5 top-1.5 z-[25]">
        <span class="bg-bg/80 px-1 py-0.5 font-mono text-[0.55rem] text-text-muted">
          {video.seasonNumber != null
            ? `S${String(video.seasonNumber).padStart(2, "0")}E${String(video.episodeNumber).padStart(2, "0")}`
            : `E${String(video.episodeNumber).padStart(2, "0")}`}
        </span>
      </div>
    {/if}
  {:else if showListOverlays}
    <div
      class="pointer-events-none absolute bottom-1 right-1 z-10 flex flex-col items-end gap-0.5"
    >
      <NsfwShowModeChip isNsfw={video.isNsfw} />
      {#if video.hasSubtitles}
        <span
          class="inline-flex items-center gap-0.5 bg-black/70 text-accent-100 border border-accent-500/40 px-1 py-px text-[0.5rem] font-mono uppercase tracking-[0.12em]"
          title="Closed captions available"
        >
          <Captions class="h-2.5 w-2.5" />
          CC
        </span>
      {/if}
      {#if video.duration}
        <span class="text-[0.55rem] font-mono bg-black/70 text-white/80 px-1">
          {video.duration}
        </span>
      {/if}
    </div>
  {/if}

  {#if scrub.enabled && (size === "grid" || size === "hero" || size === "list")}
    {@const progressPct =
      scrub.activeFrame && video.scrubDurationSeconds
        ? Math.min(100, (scrub.activeFrame.start / video.scrubDurationSeconds) * 100)
        : 0}
    {#if scrub.activeFrame && (size === "grid" || size === "hero")}
      <div
        class="pointer-events-none absolute bottom-2 z-[30] -translate-x-1/2"
        style:left="clamp(1.75rem, {progressPct}%, calc(100% - 1.75rem))"
      >
        <span
          class="media-chip-accent px-1.5 py-0.5 text-[0.6rem] font-mono tracking-[0.08em] text-accent-100 whitespace-nowrap"
        >
          {formatHoverTime(scrub.activeFrame.start)}
        </span>
      </div>
    {/if}
    <div class="pointer-events-none absolute inset-x-0 bottom-0 flex items-center">
      <div class="h-1 flex-1 overflow-hidden bg-black/55">
        <div
          class="h-full bg-gradient-to-r from-accent-700 via-accent-500 to-accent-300 shadow-[0_0_6px_rgba(199,155,92,0.3)] transition-[width] duration-75"
          style:width="{progressPct}%"
        ></div>
      </div>
    </div>
  {/if}
</div>
