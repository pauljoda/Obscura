<script lang="ts">
  import { Badge, Checkbox } from "@obscura/ui-svelte";
  import type { GalleryListItemDto } from "@obscura/contracts";
  import type { CardProps } from "$lib/media-surface/config";
  import GalleryThumbnail from "$lib/components/thumbnails/GalleryThumbnail.svelte";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";

  let {
    item,
    index,
    selected = false,
    onToggleSelect,
    layout = "grid",
  }: CardProps<GalleryListItemDto> = $props();

  const gradient = $derived(VIDEO_CARD_GRADIENTS[index % VIDEO_CARD_GRADIENTS.length]);
</script>

{#if layout === "list"}
  <div class="relative">
    {#if onToggleSelect}
      <button
        type="button"
        class="absolute left-2 top-1/2 z-10 -translate-y-1/2 glass-2 border border-border-subtle p-1"
        onclick={() => onToggleSelect?.()}
        aria-label={`Select ${item.title}`}
      >
        <Checkbox checked={selected} />
      </button>
    {/if}
    <a
      href={`/galleries/${item.id}`}
      class="flex items-center gap-3 py-2 pl-11 pr-3 text-body-sm hover:bg-surface-2 transition-colors duration-fast"
    >
      <div class="w-20 shrink-0">
        <GalleryThumbnail
          title={item.title}
          coverImagePath={item.coverImagePath}
          previewImagePaths={item.previewImagePaths}
          imageCount={item.imageCount}
          isNsfw={item.isNsfw}
          size="list"
          gradientFallback={gradient}
          showCount={false}
        />
      </div>
      <div class="flex-1 min-w-0">
        <div class="truncate text-text-primary">{item.title}</div>
        <div class="flex items-center gap-2 text-[0.7rem] text-text-muted mt-0.5">
          <span>{item.imageCount} image{item.imageCount === 1 ? "" : "s"}</span>
          {#if item.studioName}<span class="text-text-accent truncate">· {item.studioName}</span>{/if}
          {#if item.date}<span>· {item.date}</span>{/if}
        </div>
      </div>
      {#if item.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
    </a>
  </div>
{:else}
  <a
    href={`/galleries/${item.id}`}
    class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
  >
    <GalleryThumbnail
      title={item.title}
      coverImagePath={item.coverImagePath}
      previewImagePaths={item.previewImagePaths}
      imageCount={item.imageCount}
      isNsfw={item.isNsfw}
      size="grid"
      gradientFallback={gradient}
    />
    <div class="p-2.5 space-y-1">
      <h4 class="truncate text-body font-medium text-text-primary">{item.title}</h4>
      <div class="flex items-center gap-1.5 text-[0.65rem] text-text-muted">
        <span>{item.imageCount} image{item.imageCount === 1 ? "" : "s"}</span>
        {#if item.studioName}<span class="text-text-accent truncate">· {item.studioName}</span>{/if}
      </div>
    </div>
  </a>
{/if}
