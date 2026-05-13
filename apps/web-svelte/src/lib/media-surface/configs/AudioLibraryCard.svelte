<script lang="ts">
  import { Badge, Checkbox } from "@obscura/ui-svelte";
  import type { AudioLibraryListItemDto } from "@obscura/contracts";
  import type { CardProps } from "$lib/media-surface/config";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";

  let {
    item,
    index,
    selected = false,
    onToggleSelect,
    layout = "grid",
  }: CardProps<AudioLibraryListItemDto> = $props();
</script>

{#if layout === "list"}
  <div class="flex items-center gap-3 px-3 py-2 surface-panel">
    {#if onToggleSelect}
      <Checkbox checked={selected} onchange={() => onToggleSelect?.()} />
    {/if}
    <a href={`/audio/${item.id}`} class="w-14 shrink-0">
      <EntityThumbnail
        kind="audio-library"
        library={item}
        gradientIndex={index}
        size="list"
        showChips={false}
        showPlayOverlay={false}
      />
    </a>
    <a
      href={`/audio/${item.id}`}
      class="min-w-0 flex-1 text-[0.82rem] font-medium text-text-primary hover:text-text-accent"
    >
      {item.title}
    </a>
    {#if item.studioName}
      <span class="hidden text-[0.68rem] text-text-accent sm:inline">{item.studioName}</span>
    {:else}
      <span class="hidden text-[0.68rem] text-text-muted sm:inline">
        {item.trackCount} track{item.trackCount === 1 ? "" : "s"}
      </span>
    {/if}
    {#if item.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
  </div>
{:else}
  <a
    href={`/audio/${item.id}`}
    class="group/card surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
  >
    <EntityThumbnail kind="audio-library" library={item} gradientIndex={index} />
    <div class="p-2 space-y-0.5">
      <h4 class="truncate text-body-sm font-medium text-text-primary transition-colors group-hover/card:text-text-accent">
        {item.title}
      </h4>
      <div class="flex items-center gap-1.5 text-[0.62rem] text-text-muted">
        {#if item.studioName}
          <span class="truncate text-text-accent">{item.studioName}</span>
        {:else}
          <span>{item.trackCount} track{item.trackCount === 1 ? "" : "s"}</span>
        {/if}
        {#if item.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
      </div>
    </div>
  </a>
{/if}
