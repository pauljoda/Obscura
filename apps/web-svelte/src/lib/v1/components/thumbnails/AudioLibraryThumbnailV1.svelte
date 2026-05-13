<script module lang="ts">
  export type AudioLibraryThumbnailSize = "grid" | "list" | "compact" | "hero";
</script>

<script lang="ts">
  import { Disc3, Music, Play } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";
  import NsfwBlur from "$lib/components/nsfw/NsfwBlur.svelte";
  import NsfwShowModeChip from "$lib/components/nsfw/NsfwShowModeChip.svelte";
  import ThumbnailRatingChip from "./ThumbnailRatingChipV1.svelte";

  interface AudioLibraryThumbLike {
    id?: string | null;
    title: string;
    coverImagePath?: string | null;
    iconPath?: string | null;
    isNsfw?: boolean | null;
    trackCount?: number | null;
    rating?: number | null;
  }

  interface Props {
    library: AudioLibraryThumbLike;
    size?: AudioLibraryThumbnailSize;
    aspectClass?: string;
    loading?: "eager" | "lazy";
    class?: string;
    showChips?: boolean;
    /** Show the hover-reveal play button (only meaningful inside anchor/group). */
    showPlayOverlay?: boolean;
    /** Index used to pick a deterministic gradient fallback. */
    gradientIndex?: number;
  }

  let {
    library,
    size = "grid",
    aspectClass,
    loading = "lazy",
    class: className,
    showChips = true,
    showPlayOverlay = true,
    gradientIndex = 0,
  }: Props = $props();

  const coverSrc = $derived(toApiUrl(library.coverImagePath));
  const gradient = $derived(
    VIDEO_CARD_GRADIENTS[Math.abs(gradientIndex) % VIDEO_CARD_GRADIENTS.length] ?? "",
  );

  const aspect = $derived.by(() => {
    if (aspectClass) return aspectClass;
    switch (size) {
      case "compact":
        return "aspect-square";
      case "list":
        return "aspect-square";
      case "hero":
        return "aspect-square";
      case "grid":
      default:
        return "aspect-square";
    }
  });

  const fallbackIconSize = $derived.by(() => {
    switch (size) {
      case "compact":
        return { disc: "h-5 w-5", music: "h-2.5 w-2.5" };
      case "list":
        return { disc: "h-8 w-8", music: "h-3.5 w-3.5" };
      case "hero":
        return { disc: "h-20 w-20", music: "h-8 w-8" };
      case "grid":
      default:
        return { disc: "h-16 w-16", music: "h-6 w-6" };
    }
  });

  const showFullChrome = $derived(size === "grid" || size === "hero" || size === "list");
</script>

<div class={cn("relative overflow-hidden bg-surface-1 group/audio-thumb", aspect, className)}>
  <NsfwBlur isNsfw={library.isNsfw ?? false} class="block h-full w-full">
    {#if coverSrc}
      <img
        src={coverSrc}
        alt={library.title}
        {loading}
        decoding="async"
        class="absolute inset-0 h-full w-full object-cover transition-transform duration-normal group-hover/audio-thumb:scale-[1.03]"
      />
    {:else}
      <div
        class={cn(
          gradient,
          "flex h-full w-full items-center justify-center relative overflow-hidden",
        )}
      >
        <Disc3
          class={cn(
            fallbackIconSize.disc,
            "text-white/15 animate-[spin_12s_linear_infinite]",
          )}
        />
        <Music class={cn("absolute", fallbackIconSize.music, "text-white/40")} />
      </div>
    {/if}
  </NsfwBlur>

  {#if showFullChrome}
    <div
      class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent opacity-60 transition-opacity duration-normal group-hover/audio-thumb:opacity-90"
    ></div>

    {#if showPlayOverlay}
      <div
        class="pointer-events-none absolute bottom-1.5 right-1.5 z-20 translate-y-1 opacity-0 transition-all duration-normal group-hover/audio-thumb:translate-y-0 group-hover/audio-thumb:opacity-100"
      >
        <span
          class="inline-flex h-9 w-9 items-center justify-center border border-border-accent bg-gradient-to-br from-accent-500 to-accent-700 text-bg shadow-[var(--shadow-glow-accent-strong)]"
        >
          <Play class="h-4 w-4 ml-0.5" fill="currentColor" />
        </span>
      </div>
    {/if}

    {#if showChips && library.trackCount != null && library.trackCount > 0}
      <div
        class="pointer-events-none absolute bottom-1 left-1 z-10 inline-flex items-center gap-1 bg-black/55 px-1.5 py-0.5 text-[0.6rem] font-mono text-white/90 backdrop-blur-sm"
      >
        <Music class="h-2.5 w-2.5" />
        {library.trackCount}
      </div>
    {/if}

    <ThumbnailRatingChip rating={library.rating} class="absolute top-1 left-1" />
  {/if}

  <NsfwShowModeChip
    isNsfw={library.isNsfw ?? false}
    class={cn(
      "pointer-events-none absolute bottom-1 right-1 z-10",
      showPlayOverlay && "group-hover/audio-thumb:opacity-0 transition-opacity",
    )}
  />
</div>
