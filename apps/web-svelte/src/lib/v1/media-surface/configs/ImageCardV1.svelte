<script lang="ts">
  import { Checkbox } from "@obscura/ui-svelte";
  import { receiveThumb, sendThumb } from "@obscura/ui-svelte";
  import type { ImageListItemDto } from "@obscura/contracts";
  import type { CardProps } from "$lib/v1/media-surface/config-v1";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";

  interface ImageCardItem extends ImageListItemDto {
    /** Set when this card is the source of an open lightbox so the
     *  shared-element transition can hide it during the open flight. */
    __lightboxSource?: boolean;
  }

  let {
    item,
    index,
    selected = false,
    onToggleSelect,
    onActivate,
    layout = "masonry",
  }: CardProps<ImageCardItem> = $props();

  function aspectRatio(): number {
    if (!item.width || !item.height || item.height <= 0) return 1;
    return Math.max(0.25, Math.min(4, item.width / item.height));
  }

  const feedHasNaturalSize = $derived(
    !!item.width && !!item.height && item.height > 0,
  );
</script>

{#if layout === "list"}
  <div class="flex items-center gap-3 px-3 py-2 surface-panel">
    {#if onToggleSelect}
      <Checkbox checked={selected} onchange={() => onToggleSelect?.()} />
    {/if}
    <button
      type="button"
      onclick={() => onActivate?.()}
      class="w-14 shrink-0 border-0 bg-transparent p-0"
    >
      <EntityThumbnail
        kind="image"
        title={item.title}
        thumbnailPath={item.thumbnailPath}
        previewPath={item.previewPath}
        isNsfw={item.isNsfw}
        isVideo={item.isVideo}
        width={item.width}
        height={item.height}
        rating={item.rating}
        size="list"
        showChips={false}
      />
    </button>
    <button
      type="button"
      onclick={() => onActivate?.()}
      class="min-w-0 flex-1 border-0 bg-transparent p-0 text-left text-[0.82rem] font-medium text-text-primary hover:text-text-accent"
    >
      {item.title}
    </button>
    {#if item.width && item.height}
      <span class="hidden text-[0.68rem] text-text-muted sm:inline">
        {item.width}x{item.height}
      </span>
    {/if}
  </div>
{:else if layout === "feed"}
  <button
    type="button"
    onclick={() => onActivate?.()}
    class="block w-full border-0 p-0 hover:ring-1 hover:ring-border-accent transition-all duration-fast"
    style:aspect-ratio={feedHasNaturalSize ? aspectRatio() : undefined}
  >
    <EntityThumbnail
      kind="image"
      title={item.title}
      thumbnailPath={item.thumbnailPath}
      previewPath={item.previewPath}
      isNsfw={item.isNsfw}
      isVideo={item.isVideo}
      width={item.width}
      height={item.height}
      rating={item.rating}
      size="grid"
      aspectClass={feedHasNaturalSize ? "h-full w-full" : undefined}
    />
  </button>
{:else}
  <!-- masonry / grid: aspect-ratio preserves natural shape -->
  <div class="block" style:aspect-ratio={aspectRatio()}>
    {#if !item.__lightboxSource}
      <button
        type="button"
        onclick={() => onActivate?.()}
        class="block h-full w-full border-0 p-0 hover:ring-1 hover:ring-border-accent transition-all duration-fast"
        title={item.title}
        in:receiveThumb={{ key: item.id }}
        out:sendThumb={{ key: item.id }}
      >
        <EntityThumbnail
          kind="image"
          title={item.title}
          thumbnailPath={item.thumbnailPath}
          previewPath={item.previewPath}
          isNsfw={item.isNsfw}
          isVideo={item.isVideo}
          width={item.width}
          height={item.height}
          rating={item.rating}
          size="grid"
          aspectClass="h-full w-full"
        />
      </button>
    {/if}
  </div>
{/if}
