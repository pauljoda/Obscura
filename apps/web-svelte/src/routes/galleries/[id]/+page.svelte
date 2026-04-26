<script lang="ts">
  import { onMount } from "svelte";
  import { invalidate } from "$app/navigation";
  import { Images, Pencil } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import { fetchGalleryImages, updateGallery } from "$lib/api/media";
  import type { ImageListItemDto } from "@obscura/contracts";
  import ImageLightbox from "$lib/components/ImageLightbox.svelte";
  import GalleryThumbnail from "$lib/components/thumbnails/GalleryThumbnail.svelte";
  import ImageThumbnail from "$lib/components/thumbnails/ImageThumbnail.svelte";
  import GalleryEdit from "$lib/components/GalleryEdit.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import ImportButton from "$lib/components/ImportButton.svelte";
  import InlineRating from "$lib/components/InlineRating.svelte";
  import ThumbSizeSlider from "$lib/media-surface/toolbar/ThumbSizeSlider.svelte";
  import UploadDropZone from "$lib/components/UploadDropZone.svelte";
  import { createServerPrefs } from "$lib/server-prefs.svelte";

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
  let loadingMore = $state(false);
  let syncedGalleryId = $state<string | null>(null);

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);
  let editing = $state(false);

  // svelte-ignore state_referenced_locally
  const viewPrefs = createServerPrefs<{ cols: number }>(
    "galleries:interiorView",
    { cols: 3 },
    data.viewPrefs,
  );

  onMount(() => {
    void viewPrefs.load();
  });

  function openAt(i: number) {
    lightboxIndex = i;
    lightboxOpen = true;
  }

  async function refreshGallery() {
    await invalidate(`galleries:${data.gallery.id}`);
    editing = false;
  }

  async function loadMore() {
    if (loadingMore || images.length >= imageTotal) return;
    loadingMore = true;
    try {
      const result = await fetchGalleryImages(g.id, {
        limit: 60,
        offset: images.length,
      });
      const existing = new Set(images.map((i) => i.id));
      images = [...images, ...result.images.filter((i) => !existing.has(i.id))];
    } finally {
      loadingMore = false;
    }
  }

  const visibleChildGalleries = $derived(g.children ?? []);

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
            <div class="flex justify-end -mt-1 mb-1.5">
              <div class="surface-well flex items-center">
                <ThumbSizeSlider
                  value={viewPrefs.current.cols}
                  min={3}
                  max={12}
                  onChange={(n) => viewPrefs.update({ cols: n })}
                  label="Thumbnail size"
                />
              </div>
            </div>
            <div
              class="gallery-masonry"
              style:--col-count={viewPrefs.current.cols}
            >
              {#each images as img, i (img.id)}
                {@const aspect =
                  img.width && img.height && img.height > 0
                    ? img.width / img.height
                    : 1}
                <button
                  type="button"
                  onclick={() => openAt(i)}
                  class="gallery-masonry-item block hover:ring-1 hover:ring-border-accent transition-all duration-fast"
                  aria-label={img.title}
                  title={img.title}
                  style:aspect-ratio="{aspect}"
                >
                  <ImageThumbnail
                    title={img.title}
                    thumbnailPath={img.thumbnailPath}
                    previewPath={img.previewPath}
                    isNsfw={img.isNsfw}
                    isVideo={img.isVideo}
                    width={img.width}
                    height={img.height}
                    size="grid"
                    aspectClass="h-full w-full"
                    showChips={false}
                  />
                </button>
              {/each}
            </div>
            {#if images.length < imageTotal}
              <div class="flex justify-center mt-3">
                <button
                  type="button"
                  onclick={() => void loadMore()}
                  disabled={loadingMore}
                  class="surface-well px-4 py-1.5 text-[0.78rem] text-text-muted hover:text-text-primary hover:border-border-accent transition-colors disabled:opacity-50"
                >
                  {loadingMore
                    ? "Loading…"
                    : `Load more (${imageTotal - images.length} remaining)`}
                </button>
              </div>
            {/if}
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
            <h2 class="text-kicker">Performers</h2>
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

{#if lightboxOpen}
  <ImageLightbox
    {images}
    initialIndex={lightboxIndex}
    onClose={() => (lightboxOpen = false)}
  />
{/if}

<style>
  .gallery-masonry {
    column-count: max(2, min(var(--col-count, 6), 3));
    column-gap: 0.375rem;
  }
  @media (min-width: 640px) {
    .gallery-masonry {
      column-count: max(3, min(var(--col-count, 6), 5));
    }
  }
  @media (min-width: 768px) {
    .gallery-masonry {
      column-count: max(3, min(var(--col-count, 6), 8));
    }
  }
  @media (min-width: 1024px) {
    .gallery-masonry {
      column-count: var(--col-count, 6);
    }
  }
  .gallery-masonry-item {
    display: block;
    width: 100%;
    break-inside: avoid;
    margin-bottom: 0.375rem;
    background-color: var(--color-surface-1, #16161a);
    overflow: hidden;
  }
</style>
