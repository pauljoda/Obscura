<script lang="ts">
  import { invalidate, invalidateAll } from "$app/navigation";
  import { BookOpen, Images, LayoutGrid, LayoutList, Pencil, Rows3 } from "@lucide/svelte";
  import { Badge, dur } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import { deleteImage, updateGallery } from "$lib/api/media";
  import type { ImageListItemDto } from "@obscura/contracts";
  import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte";
  import ImageLightbox from "$lib/components/ImageLightbox.svelte";
  import GalleryThumbnail from "$lib/components/thumbnails/GalleryThumbnail.svelte";
  import GalleryEdit from "$lib/components/GalleryEdit.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import ImportButton from "$lib/components/ImportButton.svelte";
  import InlineRating from "$lib/components/InlineRating.svelte";
  import MediaSurface from "$lib/media-surface/MediaSurface.svelte";
  import { imagesSurfaceConfig } from "$lib/media-surface/configs/images";
  import UploadDropZone from "$lib/components/UploadDropZone.svelte";

  let { data } = $props();
  let overrideRating = $state<number | null | undefined>(undefined);
  const g = $derived(
    overrideRating === undefined
      ? data.gallery
      : { ...data.gallery, rating: overrideRating },
  );

  async function handleRatingSave(next: number | null) {
    const previous = data.gallery.rating ?? null;
    overrideRating = next;
    try {
      await updateGallery(data.gallery.id, { rating: next });
    } catch {
      overrideRating = previous;
      throw new Error("Failed to update rating");
    }
  }

  let images = $state.raw<ImageListItemDto[]>([]);
  let imageTotal = $state(0);
  let syncedGalleryId = $state<string | null>(null);

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);
  let lightboxSourceId = $state<string | null>(null);
  let editing = $state(false);
  let deleteDialogOpen = $state(false);
  let pendingDelete = $state<ImageListItemDto[]>([]);
  let bulkBusy = $state(false);

  function openAt(i: number) {
    lightboxIndex = i;
    lightboxSourceId = images[i]?.id ?? null;
    lightboxOpen = true;
  }

  function openImage(item: ImageListItemDto) {
    const existingIndex = images.findIndex((image) => image.id === item.id);
    if (existingIndex < 0) {
      images = [...images, item];
      lightboxIndex = images.length - 1;
    } else {
      lightboxIndex = existingIndex;
    }
    lightboxSourceId = item.id;
    lightboxOpen = true;
  }

  function closeLightbox() {
    lightboxOpen = false;
    window.setTimeout(() => {
      if (!lightboxOpen) lightboxSourceId = null;
    }, dur.moderate + 40);
  }

  function patchImageRating(imageId: string, rating: number | null) {
    images = images.map((image) =>
      image.id === imageId ? { ...image, rating } : image,
    );
  }

  async function refreshGallery() {
    await invalidate(`galleries:${data.gallery.id}`);
    editing = false;
  }

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

  const visibleChildGalleries = $derived(g.children ?? []);
  const performerLabel = $derived(g.isComic ? "Authors" : "Performers");
  const galleryImageSurface = $derived(
    imagesSurfaceConfig({
      initial: { items: images, total: imageTotal },
      pageSize: data.pageSize,
      page: 1,
      nsfwMode: data.nsfwMode,
      galleryId: g.id,
      surfaceId: `gallery:${g.id}:images`,
      defaultViewMode: "masonry",
      defaultSortBy: g.isComic ? "natural" : "recent",
      defaultSortDir: g.isComic ? "asc" : "desc",
      layoutByViewMode: { masonry: "masonry", grid: "grid", list: "list" },
      viewModes: [
        { mode: "masonry", icon: Rows3, label: "Masonry view" },
        { mode: "grid", icon: LayoutGrid, label: "Grid view" },
        { mode: "list", icon: LayoutList, label: "List view" },
      ],
      onMutated: () => invalidateAll(),
      onConfirmDelete: (selected) => {
        pendingDelete = selected;
        deleteDialogOpen = true;
      },
      onItemActivate: (item) => openImage(item),
    }),
  );
  const annotatedImages = $derived(
    images.map((image) =>
      image.id === lightboxSourceId && lightboxOpen
        ? { ...image, __lightboxSource: true }
        : image,
    ),
  );

  $effect(() => {
    if (syncedGalleryId !== data.gallery.id) {
      images = data.gallery.images;
      imageTotal = data.gallery.imageTotal;
      syncedGalleryId = data.gallery.id;
    }
  });
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<UploadDropZone target={{ kind: "image", galleryId: g.id }} enabled={Boolean(g.folderPath)}>
<div class="space-y-4">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div class="space-y-1.5">
      <h1 class="flex items-center gap-2.5 text-text-primary">
        <Images class="h-5 w-5 text-text-accent" />
        {g.title}
      </h1>
      <div class="flex flex-wrap items-center gap-2 text-[0.78rem] text-text-muted">
        <span>{g.imageCount} image{g.imageCount === 1 ? "" : "s"}</span>
        {#if g.studio}
          <a
            href={`/studios/${encodeURIComponent(g.studio.name)}`}
            class="text-text-accent hover:text-text-accent-bright transition-colors"
          >
            · {g.studio.name}
          </a>
        {/if}
        {#if g.date}<span>· {g.date}</span>{/if}
        {#if g.isNsfw}
          <Badge variant="warning">
            {#snippet children()}NSFW{/snippet}
          </Badge>
        {/if}
      </div>
      <InlineRating
        value={g.rating}
        onSave={handleRatingSave}
        ariaLabelPrefix="Rate gallery with"
      />
      {#if g.details}
        <p class="mt-2 text-[0.82rem] text-text-secondary leading-relaxed whitespace-pre-wrap max-w-2xl">
          {g.details}
        </p>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      {#if g.isComic && images.length > 0}
        <button
          type="button"
          onclick={() => openAt(0)}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.78rem] border border-border-accent text-text-accent shadow-[0_0_18px_rgba(196,154,90,0.18)] hover:text-text-accent-bright transition-colors"
        >
          <BookOpen class="h-3.5 w-3.5" />
          Read
        </button>
      {/if}
      {#if !editing}
        <button
          type="button"
          onclick={() => (editing = true)}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.78rem] border border-border-default hover:border-border-accent hover:text-text-accent transition-colors"
        >
          <Pencil class="h-3.5 w-3.5" />
          Edit
        </button>
      {/if}
    </div>
  </div>

  {#if editing}
    <GalleryEdit
      gallery={data.gallery}
      onSaved={() => void refreshGallery()}
      onCancel={() => (editing = false)}
    />
  {/if}

  <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
    <div class="space-y-6 min-w-0">
      {#if visibleChildGalleries.length > 0}
        <HierarchySection title="Sub-galleries">
          {#snippet children()}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {#each visibleChildGalleries as child, i (child.id)}
                <a
                  href={`/galleries/${child.id}`}
                  class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
                >
                  <GalleryThumbnail
                    title={child.title}
                    coverImagePath={child.coverImagePath}
                    previewImagePaths={child.previewImagePaths}
                    imageCount={child.imageCount}
                    isNsfw={child.isNsfw}
                    isComic={g.isComic}
                    size="hero"
                    gradientIndex={i}
                  />
                  <div class="p-2.5">
                    <h3 class="truncate text-sm font-medium">{child.title}</h3>
                    <p class="text-xs text-text-muted mt-0.5">
                      {child.imageCount} image{child.imageCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </a>
              {/each}
            </div>
          {/snippet}
        </HierarchySection>
      {/if}

      {#if images.length > 0}
        <HierarchySection title={visibleChildGalleries.length > 0 ? "Images" : ""}>
          {#snippet action()}
            {#if g.folderPath}
              <ImportButton target={{ kind: "image", galleryId: g.id }} onUploaded={refreshGallery} />
            {/if}
          {/snippet}
          {#snippet children()}
            <MediaSurface
              config={{
                ...galleryImageSurface,
                initial: {
                  items: annotatedImages,
                  total: imageTotal,
                  loadedStart: 0,
                },
              }}
              legacyPrefsKey={`gallery:${g.id}:imageFilterPresets`}
            />
          {/snippet}
        </HierarchySection>
      {:else if visibleChildGalleries.length === 0}
        <div class="surface-well flex flex-col items-center justify-center py-16 text-center">
          <Images class="h-8 w-8 text-text-disabled mb-2" />
          <p class="text-text-muted text-sm">This gallery is empty</p>
        </div>
      {/if}
    </div>

    <!-- Metadata sidebar -->
    <aside class="space-y-4 lg:sticky lg:top-5 lg:self-start">
      <div class="surface-well p-4 space-y-4">
        {#if g.performers && g.performers.length > 0}
          <div class="space-y-2">
            <h2 class="text-kicker">{performerLabel}</h2>
            <div class="flex flex-wrap gap-1.5">
              {#each g.performers as p (p.id)}
                <a
                  href={`/performers/${p.id}`}
                  class="inline-flex items-center gap-1.5 tag-chip tag-chip-default hover:tag-chip-accent transition-colors cursor-pointer"
                >
                  {#if p.imagePath}
                    <img
                      src={toApiUrl(p.imagePath)}
                      alt=""
                      class="h-4 w-3 object-cover flex-shrink-0"
                      loading="lazy"
                    />
                  {/if}
                  {p.name}
                </a>
              {/each}
            </div>
          </div>
        {/if}

        {#if g.tags && g.tags.length > 0}
          <div class="space-y-2">
            <h2 class="text-kicker">Tags</h2>
            <div class="flex flex-wrap gap-1.5">
              {#each g.tags as t (t.id)}
                <a
                  href={`/tags/${encodeURIComponent(t.name)}`}
                  class="tag-chip tag-chip-default hover:tag-chip-accent transition-colors cursor-pointer"
                >
                  {t.name}
                </a>
              {/each}
            </div>
          </div>
        {/if}

        <div class="space-y-2">
          <h2 class="text-kicker">Info</h2>
          <dl class="text-[0.78rem] space-y-1">
            <div class="flex justify-between gap-2">
              <dt class="text-text-muted">Type</dt>
              <dd class="text-text-primary">{g.galleryType}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-text-muted">Images</dt>
              <dd class="text-text-primary">{g.imageCount}</dd>
            </div>
            {#if g.photographer}
              <div class="flex justify-between gap-2">
                <dt class="text-text-muted">Photographer</dt>
                <dd class="text-text-primary truncate">{g.photographer}</dd>
              </div>
            {/if}
            {#if g.folderPath}
              <div class="flex justify-between gap-2">
                <dt class="text-text-muted">Path</dt>
                <dd class="text-text-primary truncate font-mono text-[0.7rem]" title={g.folderPath}>
                  {g.folderPath.split("/").slice(-2).join("/")}
                </dd>
              </div>
            {/if}
          </dl>
        </div>
      </div>
    </aside>
  </div>
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
    {images}
    initialIndex={lightboxIndex}
    sharedKey={lightboxSourceId ?? undefined}
    onClose={closeLightbox}
    onIndexChange={(index) => (lightboxIndex = index)}
    onRatingChange={patchImageRating}
  />
{/if}
