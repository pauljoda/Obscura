<script module lang="ts">
  export type GalleryThumbnailSize = "grid" | "list" | "compact" | "hero";
</script>

<script lang="ts">
  import { Images, Layers } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";
  import NsfwBlur from "../nsfw/NsfwBlur.svelte";
  import NsfwShowModeChip from "../nsfw/NsfwShowModeChip.svelte";

  interface Props {
    title?: string;
    coverImagePath?: string | null;
    previewImagePaths?: string[] | null;
    imageCount?: number | null;
    isNsfw?: boolean;
    updatedAt?: string | null;
    size?: GalleryThumbnailSize;
    aspectClass?: string;
    loading?: "eager" | "lazy";
    class?: string;
    gradientFallback?: string;
    showCount?: boolean;
    stacked?: boolean;
    gradientIndex?: number;
  }

  let {
    title = "",
    coverImagePath = null,
    previewImagePaths = [],
    imageCount = null,
    isNsfw = false,
    updatedAt = null,
    size = "grid",
    aspectClass,
    loading = "lazy",
    class: className,
    gradientFallback,
    showCount = true,
    stacked = false,
    gradientIndex,
  }: Props = $props();

  const coverSrc = $derived(toApiUrl(coverImagePath, updatedAt ?? undefined));
  const previews = $derived(
    (previewImagePaths ?? [])
      .map((p) => toApiUrl(p, updatedAt ?? undefined))
      .filter(Boolean) as string[],
  );

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
        return "h-5 w-5";
      case "hero":
        return "h-10 w-10";
      case "grid":
      default:
        return "h-8 w-8";
    }
  });

  let hovering = $state(false);
  let hoverIndex = $state(0);

  function startHover() {
    hovering = true;
  }

  function endHover() {
    hovering = false;
    hoverIndex = 0;
  }

  function onMove(e: MouseEvent) {
    if (!hovering || previews.length === 0) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    hoverIndex = Math.min(
      previews.length - 1,
      Math.max(0, Math.floor(ratio * previews.length)),
    );
  }

  const hoverSrc = $derived(
    hovering && previews.length > 0 ? (previews[hoverIndex] ?? previews[0]) : null,
  );

  const showStackedPreview = $derived(
    stacked && (size === "grid" || size === "hero") && previews.length >= 2,
  );

  function fallbackGradient(titleValue: string) {
    if (gradientFallback) return gradientFallback;
    if (gradientIndex != null) {
      return VIDEO_CARD_GRADIENTS[gradientIndex % VIDEO_CARD_GRADIENTS.length];
    }
    let hash = 0;
    for (let i = 0; i < titleValue.length; i += 1) {
      hash = (hash * 31 + titleValue.charCodeAt(i)) >>> 0;
    }
    return VIDEO_CARD_GRADIENTS[hash % VIDEO_CARD_GRADIENTS.length];
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class={cn(
    "relative",
    showStackedPreview ? "pt-1.5 pr-1.5" : "",
    className,
  )}
>
  {#if showStackedPreview}
    {#each previews.slice(1, 3) as preview, i}
      <div
        class={cn(
          "pointer-events-none absolute bg-surface-2 overflow-hidden border border-border-subtle",
          aspect,
        )}
        style:top="{(2 - i) * 3}px"
        style:left="{(2 - i) * 4}px"
        style:right="{-(2 - i) * 4 + 6}px"
        style:opacity={0.55 - i * 0.12}
      >
        <img
          src={preview}
          alt=""
          class="h-full w-full object-cover blur-[0.5px]"
          {loading}
        />
      </div>
    {/each}
  {/if}

  <div
    class={cn(
      "relative overflow-hidden bg-surface-1",
      aspect,
      !coverSrc && previews.length === 0 && fallbackGradient(title),
    )}
    onmouseenter={startHover}
    onmouseleave={endHover}
    onmousemove={onMove}
  >
    <NsfwBlur {isNsfw} class="block h-full w-full">
      {#if coverSrc}
        <img
          src={coverSrc}
          alt={title}
          {loading}
          decoding="async"
          class="absolute inset-0 h-full w-full object-cover"
        />
      {:else if previews.length > 0}
        <img
          src={previews[0]}
          alt={title}
          {loading}
          decoding="async"
          class="absolute inset-0 h-full w-full object-cover"
        />
      {:else}
        <div class="flex h-full w-full items-center justify-center text-white/25">
          <Layers class={iconSize} />
        </div>
      {/if}

      {#if hoverSrc}
        <img
          src={hoverSrc}
          alt=""
          class="absolute inset-0 h-full w-full object-cover transition-opacity duration-fast"
          style:opacity={hovering ? 1 : 0}
          loading="eager"
        />
      {/if}
    </NsfwBlur>

    {#if showCount && imageCount != null && (size === "grid" || size === "hero" || size === "list")}
      <div
        class="pointer-events-none absolute top-1 left-1 z-10 flex items-center gap-1 bg-black/70 px-1.5 py-0.5 text-[0.6rem] font-mono text-white/85"
      >
        <Images class="h-2.5 w-2.5" />
        {imageCount}
      </div>
    {/if}

    <NsfwShowModeChip
      {isNsfw}
      class="pointer-events-none absolute top-1 right-1 z-10"
    />

    {#if previews.length > 1 && (size === "grid" || size === "hero" || size === "list")}
      <!-- Scrub hint: segmented dots at the bottom. Visible at low opacity
           even before hover so the user sees that scrubbing is available,
           and lights up in brass as the cursor moves across the thumb. -->
      <div
        class={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 transition-opacity duration-fast",
          hovering ? "opacity-100" : "opacity-70",
        )}
      >
        <div
          class="flex items-center gap-[2px] px-1.5 pb-1 pt-4 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
        >
          {#each previews as _preview, i (i)}
            <div
              class={cn(
                "h-[2px] flex-1 transition-colors duration-fast",
                hovering
                  ? i === hoverIndex
                    ? "bg-accent-400 shadow-[0_0_6px_rgba(196,154,90,0.55)]"
                    : i < hoverIndex
                      ? "bg-accent-700/70"
                      : "bg-white/25"
                  : "bg-white/30",
              )}
            ></div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
