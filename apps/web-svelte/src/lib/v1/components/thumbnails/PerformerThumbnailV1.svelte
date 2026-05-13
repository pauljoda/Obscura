<script lang="ts">
  import { Film, FolderOpen, Image, Images, Music, Star, Users } from "@lucide/svelte";
  import type { Component } from "svelte";
  import { cn } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import NsfwBlur from "$lib/components/nsfw/NsfwBlur.svelte";
  import NsfwShowModeChip from "$lib/components/nsfw/NsfwShowModeChip.svelte";
  import ThumbnailRatingChip from "./ThumbnailRatingChipV1.svelte";

  interface PerformerThumbLike {
    name: string;
    imagePath?: string | null;
    favorite?: boolean | null;
    isNsfw?: boolean | null;
    videoCount?: number | null;
    seriesCount?: number | null;
    galleryCount?: number | null;
    imageCount?: number | null;
    imageAppearanceCount?: number | null;
    audioLibraryCount?: number | null;
    audioTrackCount?: number | null;
    rating?: number | null;
  }

  interface Props {
    performer: PerformerThumbLike;
    gradientFallback?: string;
    loading?: "eager" | "lazy";
    class?: string;
    showChips?: boolean;
    compact?: boolean;
  }

  let {
    performer,
    gradientFallback = "bg-gradient-to-br from-surface-2 to-surface-4",
    loading = "lazy",
    class: className,
    showChips = true,
    compact = false,
  }: Props = $props();

  type Chip = { key: string; label: string; count: number; icon: Component };

  const chips = $derived.by<Chip[]>(() => {
    const galleryCount = performer.galleryCount ?? 0;
    const imageCount = performer.imageCount ?? 0;
    const imageFallback = performer.imageAppearanceCount ?? 0;
    const audioCount = (performer.audioLibraryCount ?? 0) + (performer.audioTrackCount ?? 0);
    return [
      { key: "videos", label: "Videos", count: performer.videoCount ?? 0, icon: Film },
      { key: "series", label: "Series", count: performer.seriesCount ?? 0, icon: FolderOpen },
      {
        key: "galleries",
        label: "Galleries",
        count: galleryCount,
        icon: Images,
      },
      {
        key: "images",
        label: "Images",
        count: imageCount || (!galleryCount ? imageFallback : 0),
        icon: Image,
      },
      { key: "audio", label: "Audio", count: audioCount, icon: Music },
    ].filter((chip) => chip.count > 0);
  });
</script>

<div class={cn("relative aspect-[3/4] overflow-hidden bg-surface-1", className)}>
  <NsfwBlur isNsfw={performer.isNsfw ?? false} class="block h-full w-full">
    {#if performer.imagePath}
      <img
        src={toApiUrl(performer.imagePath)}
        alt={performer.name}
        {loading}
        decoding="async"
        class="absolute inset-0 h-full w-full object-cover"
      />
    {:else}
      <div class={cn(gradientFallback, "flex h-full w-full items-center justify-center")}>
        <Users class={compact ? "h-4 w-4 text-white/25" : "h-8 w-8 text-white/20"} />
      </div>
    {/if}
  </NsfwBlur>

  <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent"></div>

  {#if performer.favorite}
    <Star
      class="pointer-events-none absolute right-1.5 top-1.5 h-3.5 w-3.5 fill-current text-accent-500 drop-shadow-[0_0_6px_rgba(199,155,92,0.65)]"
    />
  {/if}

  <ThumbnailRatingChip rating={performer.rating} class="absolute left-1.5 top-1.5" />

  {#if showChips && chips.length > 0}
    <div class="pointer-events-none absolute bottom-1 left-1 right-1 flex flex-wrap gap-1">
      {#each chips.slice(0, compact ? 2 : 5) as chip (chip.key)}
        {@const Icon = chip.icon}
        <span
          class="inline-flex items-center gap-1 border border-white/10 bg-black/65 px-1.5 py-0.5 font-mono text-[0.55rem] text-white/85 backdrop-blur-sm"
          title={`${chip.count} ${chip.label}`}
        >
          <Icon class="h-2.5 w-2.5 text-accent-300" />
          {chip.count}
        </span>
      {/each}
    </div>
  {/if}

  <NsfwShowModeChip
    isNsfw={performer.isNsfw ?? false}
    class="pointer-events-none absolute bottom-1 right-1 z-10"
  />
</div>
