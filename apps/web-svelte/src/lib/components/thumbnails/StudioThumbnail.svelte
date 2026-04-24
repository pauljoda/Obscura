<script module lang="ts">
  export type StudioThumbnailSize = "grid" | "list" | "compact" | "hero";
</script>

<script lang="ts">
  import { Building2, Film, Images, Music, Star } from "@lucide/svelte";
  import type { Component } from "svelte";
  import { cn } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";
  import NsfwBlur from "../NsfwBlur.svelte";
  import NsfwShowModeChip from "../NsfwShowModeChip.svelte";

  interface StudioThumbLike {
    name: string;
    imagePath?: string | null;
    imageUrl?: string | null;
    favorite?: boolean | null;
    isNsfw?: boolean | null;
    videoCount?: number | null;
    imageAppearanceCount?: number | null;
    audioLibraryCount?: number | null;
  }

  interface Props {
    studio: StudioThumbLike;
    size?: StudioThumbnailSize;
    aspectClass?: string;
    loading?: "eager" | "lazy";
    class?: string;
    showChips?: boolean;
    gradientIndex?: number;
  }

  let {
    studio,
    size = "grid",
    aspectClass,
    loading = "lazy",
    class: className,
    showChips = true,
    gradientIndex,
  }: Props = $props();

  const imageSrc = $derived(toApiUrl(studio.imagePath) ?? studio.imageUrl ?? null);

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
        return "aspect-[4/3]";
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

  type Chip = { key: string; count: number; icon: Component; label: string };
  const chips = $derived.by<Chip[]>(() => {
    return [
      { key: "videos", count: studio.videoCount ?? 0, icon: Film, label: "Videos" },
      {
        key: "images",
        count: studio.imageAppearanceCount ?? 0,
        icon: Images,
        label: "Images",
      },
      {
        key: "audio",
        count: studio.audioLibraryCount ?? 0,
        icon: Music,
        label: "Albums",
      },
    ].filter((chip) => chip.count > 0);
  });

  const showChipRow = $derived(showChips && (size === "grid" || size === "hero"));

  function fallbackGradient(name: string) {
    if (gradientIndex != null) {
      return VIDEO_CARD_GRADIENTS[gradientIndex % VIDEO_CARD_GRADIENTS.length];
    }
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    return VIDEO_CARD_GRADIENTS[hash % VIDEO_CARD_GRADIENTS.length];
  }
</script>

<div class={cn("relative overflow-hidden bg-surface-1", aspect, className)}>
  <NsfwBlur isNsfw={studio.isNsfw ?? false} class="block h-full w-full">
    {#if imageSrc}
      <img
        src={imageSrc}
        alt={studio.name}
        {loading}
        decoding="async"
        class="absolute inset-0 h-full w-full object-cover"
      />
    {:else}
      <div
        class={cn(
          fallbackGradient(studio.name),
          "flex h-full w-full items-center justify-center text-white/25",
        )}
      >
        <Building2 class={iconSize} />
      </div>
    {/if}
  </NsfwBlur>

  {#if imageSrc}
    <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
  {/if}

  {#if studio.favorite}
    <Star
      class="pointer-events-none absolute right-1.5 top-1.5 h-3.5 w-3.5 fill-current text-accent-500 drop-shadow-[0_0_6px_rgba(199,155,92,0.65)]"
    />
  {/if}

  {#if showChipRow && chips.length > 0}
    <div class="pointer-events-none absolute bottom-1 left-1 right-1 flex flex-wrap gap-1">
      {#each chips.slice(0, 3) as chip (chip.key)}
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
    isNsfw={studio.isNsfw ?? false}
    class="pointer-events-none absolute bottom-1 right-1 z-10"
  />
</div>
