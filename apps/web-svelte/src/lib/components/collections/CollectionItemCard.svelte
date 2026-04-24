<script lang="ts">
  import { Film, Images, Layers, Music, Hand, Zap } from "@lucide/svelte";
  import type { CollectionItemDto, CollectionEntityType } from "@obscura/contracts";
  import { toApiUrl } from "$lib/api/core";
  import {
    getEntityHref,
    getEntityTitle,
    getEntityThumbnail,
    getEntityMeta,
  } from "./collection-item-helpers";

  interface Props {
    item: CollectionItemDto;
    selectable?: boolean;
    selected?: boolean;
    onSelect?: (itemId: string) => void;
    from?: string;
  }

  let { item, selectable = false, selected = false, onSelect, from }: Props = $props();

  const typeIcons: Record<CollectionEntityType, typeof Film> = {
    video: Film,
    gallery: Images,
    image: Layers,
    "audio-track": Music,
  };
  const typeColors: Record<CollectionEntityType, string> = {
    video: "bg-blue-500/20 text-blue-300",
    gallery: "bg-green-500/20 text-green-300",
    image: "bg-purple-500/20 text-purple-300",
    "audio-track": "bg-amber-500/20 text-amber-300",
  };

  const Icon = $derived(typeIcons[item.entityType]);
  const colorClass = $derived(typeColors[item.entityType]);
  const title = $derived(getEntityTitle(item));
  const thumbnailPath = $derived(getEntityThumbnail(item));
  const meta = $derived(getEntityMeta(item));
  const href = $derived(getEntityHref(item, from));
  const thumbnailUrl = $derived(toApiUrl(thumbnailPath));
  const isManual = $derived(item.source === "manual");
  const sourceLabel = $derived(isManual ? "Direct" : "Scoped");
</script>

{#snippet card()}
  <div class="surface-card media-card-shell group relative h-full overflow-hidden">
    <div class="relative aspect-video overflow-hidden bg-surface-2">
      {#if thumbnailUrl}
        <img src={thumbnailUrl} alt={title} class="h-full w-full object-cover" />
      {:else}
        <div class="flex h-full w-full items-center justify-center">
          <Icon class="h-8 w-8 text-text-disabled" />
        </div>
      {/if}
      <div
        class={`absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 px-1 py-0.5 text-[0.6rem] font-mono uppercase ${colorClass}`}
      >
        <Icon class="h-2.5 w-2.5" />
        {item.entityType === "audio-track" ? "audio" : item.entityType}
      </div>
      <div
        class={`absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[0.6rem] font-mono uppercase tracking-wider backdrop-blur-md ${
          isManual
            ? "bg-surface-1/90 text-accent-400 border border-accent-brass/30"
            : "bg-surface-1/90 text-text-secondary border border-border-default"
        }`}
      >
        {#if isManual}
          <Hand class="h-2.5 w-2.5" />
        {:else}
          <Zap class="h-2.5 w-2.5" />
        {/if}
        {sourceLabel}
      </div>
      {#if selectable && isManual}
        <div
          class={`absolute top-1.5 left-1.5 h-5 w-5 flex items-center justify-center border pointer-events-none transition-colors ${
            selected
              ? "border-accent-brass/50 bg-accent-brass/30"
              : "border-border-default bg-surface-1/60"
          }`}
        >
          {#if selected}
            <svg class="h-3 w-3 text-text-accent" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 6l3 3 5-5" />
            </svg>
          {/if}
        </div>
      {/if}
      {#if meta}
        <div class="absolute bottom-1.5 right-1.5 px-1 py-0.5 text-[0.6rem] font-mono bg-surface-1/80 backdrop-blur-sm text-text-secondary">
          {meta}
        </div>
      {/if}
    </div>
    <div class="p-2">
      <h3 class="font-heading text-[0.78rem] font-medium text-text-primary truncate leading-tight">
        {title}
      </h3>
    </div>
  </div>
{/snippet}

{#if selectable}
  <button
    type="button"
    onclick={() => isManual && onSelect?.(item.id)}
    class={`h-full w-full text-left transition-shadow ${
      isManual ? "cursor-pointer" : "cursor-default opacity-60"
    } ${selected ? "ring-2 ring-accent-brass/40" : ""}`}
  >
    {@render card()}
  </button>
{:else}
  <a href={href} class="block h-full">
    {@render card()}
  </a>
{/if}
