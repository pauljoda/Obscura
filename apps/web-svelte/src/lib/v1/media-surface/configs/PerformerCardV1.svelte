<script lang="ts">
  import { Checkbox } from "@obscura/ui-svelte";
  import type { CardProps } from "$lib/v1/media-surface/config-v1";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";
  import type { PerformerItem } from "$lib/v1/api/types-v1";

  let {
    item,
    index,
    selected = false,
    onToggleSelect,
    layout = "grid",
  }: CardProps<PerformerItem> = $props();

  const gradient = $derived(VIDEO_CARD_GRADIENTS[index % VIDEO_CARD_GRADIENTS.length]);
</script>

{#if layout === "list"}
  <div class="flex items-center gap-3 px-3 py-2 surface-panel">
    {#if onToggleSelect}
      <Checkbox checked={selected} onchange={() => onToggleSelect?.()} />
    {/if}
    <a href={`/performers/${item.id}`} class="w-12 shrink-0">
      <EntityThumbnail
        kind="performer"
        performer={item}
        gradientFallback={gradient}
        showChips={false}
        compact
      />
    </a>
    <a
      href={`/performers/${item.id}`}
      class="min-w-0 flex-1 text-[0.82rem] font-medium text-text-primary hover:text-text-accent"
    >
      {item.name}
    </a>
    {#if item.country}
      <span class="hidden text-[0.68rem] text-text-muted sm:inline">{item.country}</span>
    {/if}
  </div>
{:else}
  <a
    href={`/performers/${item.id}`}
    class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast flex flex-col block"
  >
    <EntityThumbnail kind="performer" performer={item} gradientFallback={gradient} showChips={false} />
    <div class="p-2 space-y-1">
      <h4 class="truncate text-[0.8rem] font-medium text-text-primary leading-tight">
        {item.name}
      </h4>
      {#if item.disambiguation}
        <p class="truncate text-[0.65rem] text-text-disabled">{item.disambiguation}</p>
      {/if}
      {#if item.country}
        <div class="truncate text-[0.62rem] text-text-muted">{item.country}</div>
      {/if}
    </div>
  </a>
{/if}
