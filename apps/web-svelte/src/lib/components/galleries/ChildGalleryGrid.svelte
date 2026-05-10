<script lang="ts">
  import { Images, Layers } from "@lucide/svelte";
  import GalleryThumbnail from "$lib/components/thumbnails/GalleryThumbnail.svelte";
  import ThumbSizeSlider from "$lib/media-surface/toolbar/ThumbSizeSlider.svelte";

  export interface ChildGalleryGridItem {
    id: string;
    title: string;
    coverImagePath?: string | null;
    previewImagePaths?: string[];
    imageCount?: number | null;
    childCount?: number | null;
    isNsfw?: boolean;
    isComic?: boolean;
    coverAspectRatio?: number | null;
  }

  interface Props {
    galleries: ChildGalleryGridItem[];
    cols: number;
    onColsChange: (cols: number) => void;
  }

  let { galleries, cols, onColsChange }: Props = $props();
  const displayCols = $derived(Math.max(2, Math.min(8, Math.round(cols))));
  const minCardWidth = $derived(`${Math.round(760 / displayCols)}px`);
</script>

<div class="space-y-2.5">
  <div class="flex justify-end">
    <ThumbSizeSlider
      value={displayCols}
      min={2}
      max={8}
      label="Sub-gallery size"
      onChange={onColsChange}
    />
  </div>

  <div
    class="sub-gallery-grid"
    style:--sub-gallery-cols={displayCols}
    style:--sub-gallery-card-min={minCardWidth}
  >
    {#each galleries as child, i (child.id)}
      <a
        href={`/galleries/${child.id}`}
        class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
      >
        <GalleryThumbnail
          title={child.title}
          coverImagePath={child.coverImagePath ?? null}
          previewImagePaths={child.previewImagePaths ?? []}
          imageCount={child.imageCount ?? 0}
          isNsfw={child.isNsfw === true}
          isComic={child.isComic === true}
          size="grid"
          aspectRatio={child.isComic ? null : (child.coverAspectRatio ?? null)}
          aspectClass={child.isComic ? undefined : "aspect-[4/3]"}
          fit={child.isComic ? "contain" : child.coverAspectRatio ? "cover" : "contain"}
          showCount={false}
          gradientIndex={i}
        />
        <div class="p-2.5">
          <h3 class="truncate text-sm font-medium">{child.title}</h3>
          <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
            {#if (child.imageCount ?? 0) > 0}
              <span class="inline-flex items-center gap-1">
                <Images class="h-3 w-3" />
                {child.imageCount} image{child.imageCount === 1 ? "" : "s"}
              </span>
            {/if}
            {#if (child.childCount ?? 0) > 0}
              <span class="inline-flex items-center gap-1">
                <Layers class="h-3 w-3" />
                {child.childCount} {child.childCount === 1 ? "sub-gallery" : "sub-galleries"}
              </span>
            {/if}
          </div>
        </div>
      </a>
    {/each}
  </div>
</div>

<style>
  .sub-gallery-grid {
    display: grid;
    gap: 0.625rem;
    grid-template-columns: repeat(
      auto-fit,
      minmax(min(100%, var(--sub-gallery-card-min)), 1fr)
    );
  }
</style>
