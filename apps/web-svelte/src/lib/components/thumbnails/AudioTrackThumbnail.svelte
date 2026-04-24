<script module lang="ts">
  export type AudioTrackThumbnailSize = "grid" | "list" | "compact" | "hero";
</script>

<script lang="ts">
  import { Disc3, Music, Play } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";
  import NsfwBlur from "../NsfwBlur.svelte";
  import NsfwShowModeChip from "../NsfwShowModeChip.svelte";

  interface AudioTrackThumbLike {
    id?: string | null;
    title: string;
    /** Track's own cover if one exists, otherwise fall through to the library's cover. */
    coverImagePath?: string | null;
    /** Library cover, used when the track has no dedicated cover. */
    libraryCoverImagePath?: string | null;
    trackNumber?: number | null;
    isNsfw?: boolean | null;
  }

  interface Props {
    track: AudioTrackThumbLike;
    size?: AudioTrackThumbnailSize;
    aspectClass?: string;
    loading?: "eager" | "lazy";
    class?: string;
    showChips?: boolean;
    showPlayOverlay?: boolean;
    gradientIndex?: number;
  }

  let {
    track,
    size = "grid",
    aspectClass,
    loading = "lazy",
    class: className,
    showChips = true,
    showPlayOverlay = true,
    gradientIndex = 0,
  }: Props = $props();

  const coverSrc = $derived(
    toApiUrl(track.coverImagePath) ?? toApiUrl(track.libraryCoverImagePath),
  );
  const gradient = $derived(
    VIDEO_CARD_GRADIENTS[Math.abs(gradientIndex) % VIDEO_CARD_GRADIENTS.length] ?? "",
  );

  const aspect = $derived.by(() => {
    if (aspectClass) return aspectClass;
    switch (size) {
      case "compact":
      case "list":
      case "hero":
      case "grid":
      default:
        return "aspect-square";
    }
  });

  const iconSizes = $derived.by(() => {
    switch (size) {
      case "compact":
        return { disc: "h-5 w-5", music: "h-2.5 w-2.5" };
      case "list":
        return { disc: "h-7 w-7", music: "h-3 w-3" };
      case "hero":
        return { disc: "h-16 w-16", music: "h-7 w-7" };
      case "grid":
      default:
        return { disc: "h-12 w-12", music: "h-5 w-5" };
    }
  });

  const showFullChrome = $derived(size === "grid" || size === "hero");
</script>

<div class={cn("relative overflow-hidden bg-surface-1 group/track-thumb", aspect, className)}>
  <NsfwBlur isNsfw={track.isNsfw ?? false} class="block h-full w-full">
    {#if coverSrc}
      <img
        src={coverSrc}
        alt={track.title}
        {loading}
        decoding="async"
        class="absolute inset-0 h-full w-full object-cover transition-transform duration-normal group-hover/track-thumb:scale-[1.03]"
      />
    {:else}
      <div class={cn(gradient, "flex h-full w-full items-center justify-center relative overflow-hidden")}>
        <Disc3 class={cn(iconSizes.disc, "text-white/15 animate-[spin_12s_linear_infinite]")} />
        <Music class={cn("absolute", iconSizes.music, "text-white/40")} />
      </div>
    {/if}
  </NsfwBlur>

  {#if showFullChrome}
    <div
      class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent opacity-60 transition-opacity duration-normal group-hover/track-thumb:opacity-90"
    ></div>

    {#if showPlayOverlay}
      <div
        class="pointer-events-none absolute bottom-1.5 right-1.5 z-20 translate-y-1 opacity-0 transition-all duration-normal group-hover/track-thumb:translate-y-0 group-hover/track-thumb:opacity-100"
      >
        <span
          class="inline-flex h-9 w-9 items-center justify-center border border-border-accent bg-gradient-to-br from-accent-500 to-accent-700 text-bg shadow-[var(--shadow-glow-accent-strong)]"
        >
          <Play class="h-4 w-4 ml-0.5" fill="currentColor" />
        </span>
      </div>
    {/if}

    {#if showChips && track.trackNumber != null}
      <div
        class="pointer-events-none absolute bottom-1 left-1 z-10 inline-flex items-center gap-1 bg-black/55 px-1.5 py-0.5 text-[0.6rem] font-mono text-white/90 backdrop-blur-sm"
      >
        #{track.trackNumber}
      </div>
    {/if}
  {/if}

  <NsfwShowModeChip
    isNsfw={track.isNsfw ?? false}
    class={cn(
      "pointer-events-none absolute bottom-1 right-1 z-10",
      showPlayOverlay && "group-hover/track-thumb:opacity-0 transition-opacity",
    )}
  />
</div>
