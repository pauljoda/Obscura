<script lang="ts">
  import { Badge, Checkbox } from "@obscura/ui-svelte";
  import type { AudioTrackListItemDto } from "@obscura/contracts";
  import type { CardProps } from "$lib/media-surface/config";
  import AudioTrackThumbnail from "$lib/components/thumbnails/AudioTrackThumbnail.svelte";

  let {
    item,
    index,
    selected = false,
    onToggleSelect,
    layout = "list",
  }: CardProps<AudioTrackListItemDto> = $props();

  const artistLabel = $derived(
    item.performers.length > 0
      ? item.performers.map((performer) => performer.name).join(", ")
      : item.embeddedArtist,
  );
</script>

{#if layout === "list"}
  <div class="flex items-center gap-3 px-3 py-2 surface-panel">
    {#if onToggleSelect}
      <Checkbox checked={selected} onchange={() => onToggleSelect?.()} />
    {/if}
    <a href={`/audio/tracks/${item.id}`} class="w-14 shrink-0">
      <AudioTrackThumbnail
        track={item}
        gradientIndex={index}
        size="list"
        showChips={false}
        showPlayOverlay={false}
      />
    </a>
    <a
      href={`/audio/tracks/${item.id}`}
      class="min-w-0 flex-1 text-[0.82rem] font-medium text-text-primary hover:text-text-accent"
    >
      {item.title}
    </a>
    {#if artistLabel}
      <span class="hidden max-w-48 truncate text-[0.68rem] text-text-accent sm:inline">
        {artistLabel}
      </span>
    {:else if item.embeddedAlbum}
      <span class="hidden max-w-48 truncate text-[0.68rem] text-text-muted sm:inline">
        {item.embeddedAlbum}
      </span>
    {/if}
    {#if item.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
  </div>
{:else}
  <a
    href={`/audio/tracks/${item.id}`}
    class="group/card surface-card-sharp block overflow-hidden transition-colors duration-fast hover:border-border-accent"
  >
    <AudioTrackThumbnail track={item} gradientIndex={index} />
    <div class="space-y-0.5 p-2">
      <h4 class="truncate text-body-sm font-medium text-text-primary transition-colors group-hover/card:text-text-accent">
        {item.title}
      </h4>
      <div class="flex items-center gap-1.5 text-[0.62rem] text-text-muted">
        {#if artistLabel}
          <span class="truncate text-text-accent">{artistLabel}</span>
        {:else if item.embeddedAlbum}
          <span class="truncate">{item.embeddedAlbum}</span>
        {:else if item.duration != null}
          <span>{Math.round(item.duration / 60)} min</span>
        {/if}
        {#if item.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
      </div>
    </div>
  </a>
{/if}
