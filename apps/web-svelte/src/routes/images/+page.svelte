<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { Image as ImageIcon } from "@lucide/svelte";
  import { cn, dur } from "@obscura/ui-svelte";
  import type { ImageListItemDto } from "@obscura/contracts";
  import type { PageData } from "./$types";
  import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte";
  import FilterSection from "$lib/media-surface/toolbar/FilterSection.svelte";
  import ImageLightbox from "$lib/components/ImageLightbox.svelte";
  import ImportButton from "$lib/components/ImportButton.svelte";
  import UploadDropZone from "$lib/components/UploadDropZone.svelte";
  import { deleteImage } from "$lib/v1/api/media-v1";
  import MediaSurface from "$lib/media-surface/MediaSurface.svelte";
  import { imagesSurfaceConfig } from "$lib/media-surface/configs/images";

  let { data }: { data: PageData } = $props();

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);
  let lightboxSourceId = $state<string | null>(null);
  let deleteDialogOpen = $state(false);
  let pendingDelete = $state<ImageListItemDto[]>([]);
  let bulkBusy = $state(false);

  // The lightbox needs the loaded items list. We reflect a working copy
  // via the surface's onItemActivate callback so the lightbox can drive
  // its index off the same list the surface is rendering.
  // svelte-ignore state_referenced_locally
  let surfaceItems = $state.raw<ImageListItemDto[]>(data.images);

  function closeLightbox() {
    lightboxOpen = false;
    window.setTimeout(() => {
      if (!lightboxOpen) lightboxSourceId = null;
    }, dur.moderate + 40);
  }

  function patchImageRating(imageId: string, rating: number | null) {
    surfaceItems = surfaceItems.map((image) =>
      image.id === imageId ? { ...image, rating } : image,
    );
  }

  const fileTypeFilters = [
    { value: "jpg", label: "JPG" },
    { value: "png", label: "PNG" },
    { value: "webp", label: "WebP" },
    { value: "gif", label: "GIF" },
    { value: "avif", label: "AVIF" },
    { value: "bmp", label: "BMP" },
    { value: "tiff", label: "TIFF" },
    { value: "mp4", label: "MP4" },
    { value: "webm", label: "WebM" },
    { value: "mov", label: "MOV" },
    { value: "mkv", label: "MKV" },
  ];
  const animatedFilters = [
    { value: "true", label: "Animated" },
    { value: "false", label: "Static" },
  ];
  const dimensionFilters = [
    { value: "landscape", label: "Landscape" },
    { value: "portrait", label: "Portrait" },
    { value: "square", label: "Square" },
    { value: "hd", label: "HD+" },
    { value: "4k", label: "4K+" },
  ];

  type DrawerCtx = {
    panelFilters: Array<{ type?: string; label: string; value: string }>;
    onAddFilter: (
      type:
        | "format"
        | "animated"
        | "dimension"
        | "rating"
        | "ratingMin"
        | "ratingMax"
        | "date"
        | "dateFrom"
        | "dateTo"
        | "resolution"
        | "organized"
        | "tag"
        | "performer"
        | "studio",
      label: string,
      value: string,
    ) => void;
  };

  const config = $derived(
    imagesSurfaceConfig({
      initial: { items: data.images, total: data.total },
      pageSize: data.pageSize,
      page: data.page,
      nsfwMode: data.nsfwMode,
      onMutated: () => invalidateAll(),
      onConfirmDelete: (selected) => {
        pendingDelete = selected;
        deleteDialogOpen = true;
      },
      onItemActivate: (item) => {
        const index = surfaceItems.findIndex((i) => i.id === item.id);
        if (index < 0) return;
        lightboxIndex = index;
        lightboxSourceId = item.id;
        lightboxOpen = true;
      },
      onItemsChange: (items) => {
        surfaceItems = items;
      },
      decorateItem: (image) =>
        image.id === lightboxSourceId && lightboxOpen
          ? { ...image, __lightboxSource: true }
          : image,
    }),
  );

  // Keep our snapshot in sync with the SSR payload.
  // eslint-disable-next-line svelte/no-untracked-state
  $effect(() => {
    surfaceItems = data.images;
  });

  async function confirmDelete(deleteFromDisk: boolean) {
    if (bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(pendingDelete.map((i) => deleteImage(i.id, deleteFromDisk)));
      deleteDialogOpen = false;
      pendingDelete = [];
      await invalidateAll();
    } finally {
      bulkBusy = false;
    }
  }
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<UploadDropZone target={{ kind: "image" }}>
  <div class="space-y-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="flex items-center gap-2.5">
          <ImageIcon class="h-5 w-5 text-text-accent" />
          Images
        </h1>
        <p class="text-text-muted text-[0.78rem] mt-1">
          Browse images in your library
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ImportButton target={{ kind: "image" }} />
        <span class="text-mono-sm text-text-disabled mt-1">
          {data.total.toLocaleString()} total
        </span>
      </div>
    </div>

    {#snippet drawerSections({ panelFilters, onAddFilter }: DrawerCtx)}
      <FilterSection title="File type">
        {#snippet children()}
          <div class="flex flex-wrap gap-1">
            {#each fileTypeFilters as item (item.value)}
              <button
                type="button"
                onclick={() => onAddFilter("format", "File Type", item.value)}
                class={cn(
                  "tag-chip cursor-pointer transition-colors duration-fast",
                  panelFilters.some((f) => f.type === "format" && f.value === item.value)
                    ? "tag-chip-accent"
                    : "tag-chip-default hover:tag-chip-accent",
                )}
              >
                {item.label}
              </button>
            {/each}
          </div>
        {/snippet}
      </FilterSection>

      <FilterSection title="Animation">
        {#snippet children()}
          <div class="flex flex-wrap gap-1">
            {#each animatedFilters as item (item.value)}
              <button
                type="button"
                onclick={() => onAddFilter("animated", "Animated", item.value)}
                class={cn(
                  "tag-chip cursor-pointer transition-colors duration-fast",
                  panelFilters.some((f) => f.type === "animated" && f.value === item.value)
                    ? "tag-chip-accent"
                    : "tag-chip-default hover:tag-chip-accent",
                )}
              >
                {item.label}
              </button>
            {/each}
          </div>
        {/snippet}
      </FilterSection>

      <FilterSection title="Dimensions">
        {#snippet children()}
          <div class="flex flex-wrap gap-1">
            {#each dimensionFilters as item (item.value)}
              <button
                type="button"
                onclick={() => onAddFilter("dimension", "Dimensions", item.value)}
                class={cn(
                  "tag-chip cursor-pointer transition-colors duration-fast",
                  panelFilters.some((f) => f.type === "dimension" && f.value === item.value)
                    ? "tag-chip-accent"
                    : "tag-chip-default hover:tag-chip-accent",
                )}
              >
                {item.label}
              </button>
            {/each}
          </div>
        {/snippet}
      </FilterSection>
    {/snippet}

    <MediaSurface
      config={{
        ...config,
        extraFilterSections: drawerSections,
      }}
      initialPrefsByFormFactor={data.surfacePrefs}
      legacyPrefsKey="images:filterPresets"
    />
  </div>
</UploadDropZone>

<ConfirmDeleteDialog
  open={deleteDialogOpen}
  entityType="image"
  count={pendingDelete.length}
  loading={bulkBusy}
  allowDeleteFromDisk
  onClose={() => (deleteDialogOpen = false)}
  onDeleteFromLibrary={() => void confirmDelete(false)}
  onDeleteFromDisk={() => void confirmDelete(true)}
/>

{#if lightboxOpen}
  <ImageLightbox
    images={surfaceItems}
    initialIndex={lightboxIndex}
    sharedKey={lightboxSourceId ?? undefined}
    onClose={closeLightbox}
    onIndexChange={(index) => (lightboxIndex = index)}
    onRatingChange={patchImageRating}
  />
{/if}
