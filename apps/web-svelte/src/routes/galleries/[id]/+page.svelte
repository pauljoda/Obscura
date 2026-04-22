<script lang="ts">
  import { Images, Star, Folder } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import { fetchGalleryImages } from "$lib/api/media";
  import type { ImageListItemDto } from "@obscura/contracts";
  import ImageLightbox from "$lib/components/ImageLightbox.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";

  let { data } = $props();
  const g = $derived(data.gallery);

  const initialImages: ImageListItemDto[] = data.gallery.images;
  const initialImageTotal: number = data.gallery.imageTotal;
  let images = $state<ImageListItemDto[]>(initialImages);
  let imageTotal = $state(initialImageTotal);
  let loadingMore = $state(false);

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  function openAt(i: number) {
    lightboxIndex = i;
    lightboxOpen = true;
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
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

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
        {#if g.rating && g.rating > 0}
          <span class="inline-flex items-center gap-1 text-accent-300">
            · <Star class="h-3 w-3 fill-current" />{Math.round(g.rating / 20)}
          </span>
        {/if}
        {#if g.isNsfw}
          <Badge variant="warning">
            {#snippet children()}NSFW{/snippet}
          </Badge>
        {/if}
      </div>
      {#if g.details}
        <p class="mt-2 text-[0.82rem] text-text-secondary leading-relaxed whitespace-pre-wrap max-w-2xl">
          {g.details}
        </p>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
    <div class="space-y-6 min-w-0">
      {#if visibleChildGalleries.length > 0}
        <HierarchySection title="Sub-galleries">
          {#snippet children()}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {#each visibleChildGalleries as child (child.id)}
                <a
                  href={`/galleries/${child.id}`}
                  class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
                >
                  <NsfwBlur isNsfw={child.isNsfw} class="block">
                    <div class="aspect-[4/3] bg-surface-1">
                      {#if child.coverImagePath}
                        <img
                          src={toApiUrl(child.coverImagePath)}
                          alt=""
                          loading="lazy"
                          class="h-full w-full object-cover"
                        />
                      {:else}
                        <div class="flex h-full items-center justify-center">
                          <Folder class="h-8 w-8 text-text-disabled" />
                        </div>
                      {/if}
                    </div>
                  </NsfwBlur>
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
          {#snippet children()}
            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
              {#each images as img, i (img.id)}
                <button
                  type="button"
                  onclick={() => openAt(i)}
                  class="aspect-square bg-surface-1 overflow-hidden block hover:ring-1 hover:ring-border-accent transition-all duration-fast"
                  aria-label={img.title}
                >
                  <NsfwBlur isNsfw={img.isNsfw} class="block h-full w-full">
                    {#if img.thumbnailPath}
                      <img
                        src={toApiUrl(img.thumbnailPath)}
                        alt={img.title}
                        loading="lazy"
                        decoding="async"
                        class="h-full w-full object-cover"
                      />
                    {:else}
                      <div class="flex h-full items-center justify-center">
                        <Images class="h-5 w-5 text-text-disabled" />
                      </div>
                    {/if}
                  </NsfwBlur>
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

{#if lightboxOpen}
  <ImageLightbox
    {images}
    initialIndex={lightboxIndex}
    onClose={() => (lightboxOpen = false)}
  />
{/if}
