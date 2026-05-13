<script module lang="ts">
  export type ImageThumbnailSize = "grid" | "list" | "compact" | "hero";
</script>

<script lang="ts">
  import { Image as ImageIcon, Video as VideoIcon } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/v1/api/core-v1";
  import NsfwBlur from "$lib/components/nsfw/NsfwBlur.svelte";
  import NsfwShowModeChip from "$lib/components/nsfw/NsfwShowModeChip.svelte";
  import ThumbnailRatingChip from "./ThumbnailRatingChipV1.svelte";

  interface Props {
    title?: string;
    thumbnailPath?: string | null;
    previewPath?: string | null;
    isNsfw?: boolean;
    isVideo?: boolean;
    width?: number | null;
    height?: number | null;
    updatedAt?: string | null;
    size?: ImageThumbnailSize;
    aspectClass?: string;
    loading?: "eager" | "lazy";
    rating?: number | null;
    class?: string;
    showChips?: boolean;
  }

  let {
    title = "",
    thumbnailPath = null,
    previewPath = null,
    isNsfw = false,
    isVideo = false,
    width = null,
    height = null,
    updatedAt = null,
    size = "grid",
    aspectClass,
    loading = "lazy",
    rating = null,
    class: className,
    showChips = true,
  }: Props = $props();

  const thumbSrc = $derived(toApiUrl(thumbnailPath, updatedAt ?? undefined));
  const previewSrc = $derived(toApiUrl(previewPath, updatedAt ?? undefined));
  const hasVideoPreview = $derived(isVideo && !!previewSrc);

  const aspect = $derived.by(() => {
    if (aspectClass) return aspectClass;
    switch (size) {
      case "compact":
        return "aspect-square";
      case "list":
        return "aspect-square";
      case "hero":
        return "aspect-[4/3]";
      case "grid":
      default:
        return "aspect-square";
    }
  });

  const iconSize = $derived.by(() => {
    switch (size) {
      case "compact":
        return "h-3.5 w-3.5";
      case "list":
        return "h-4 w-4";
      case "hero":
        return "h-10 w-10";
      case "grid":
      default:
        return "h-5 w-5";
    }
  });

  let hovering = $state(false);
  let videoEl = $state<HTMLVideoElement | undefined>();

  function startHover() {
    hovering = true;
    if (hasVideoPreview && videoEl) {
      videoEl.currentTime = 0;
      void videoEl.play().catch(() => {});
    }
  }

  function endHover() {
    hovering = false;
    if (videoEl) {
      videoEl.pause();
    }
  }

  const resolutionLabel = $derived.by(() => {
    if (!width || !height) return null;
    return `${width}×${height}`;
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class={cn("relative overflow-hidden bg-surface-1 select-none", aspect, className)}
  onpointerenter={startHover}
  onpointerleave={endHover}
  onpointercancel={endHover}
  onfocusin={startHover}
  onfocusout={endHover}
>
  <NsfwBlur {isNsfw} class="block h-full w-full">
    {#if thumbSrc}
      <img
        src={thumbSrc}
        alt={title}
        {loading}
        decoding="async"
        class="absolute inset-0 h-full w-full object-cover"
      />
    {:else}
      <div class="flex h-full w-full items-center justify-center text-text-disabled">
        <ImageIcon class={iconSize} />
      </div>
    {/if}

    {#if hasVideoPreview}
      <video
        bind:this={videoEl}
        src={previewSrc}
        muted
        loop
        playsinline
        preload="none"
        class={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-fast",
          hovering ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      ></video>
    {/if}
  </NsfwBlur>

  {#if showChips}
    {#if isVideo && (size === "grid" || size === "hero")}
      <span
        class="pointer-events-none absolute left-1 top-1 z-10 inline-flex items-center gap-0.5 bg-black/70 px-1 py-0.5 text-[0.55rem] font-mono uppercase tracking-[0.12em] text-accent-100 border border-accent-500/30"
        title="Animated image"
      >
        <VideoIcon class="h-2.5 w-2.5" />
      </span>
    {/if}
    {#if resolutionLabel && (size === "grid" || size === "hero") && thumbSrc}
      <span
        class="pointer-events-none absolute bottom-1 left-1 z-10 bg-black/70 px-1 py-0.5 text-[0.55rem] font-mono text-white/80"
      >
        {resolutionLabel}
      </span>
    {/if}
    <NsfwShowModeChip
      {isNsfw}
      class="pointer-events-none absolute bottom-1 right-1 z-10"
    />
  {/if}
  <ThumbnailRatingChip {rating} class="absolute top-1 right-1" />
</div>
