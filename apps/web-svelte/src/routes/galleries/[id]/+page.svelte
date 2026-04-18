<script lang="ts">
  import { Images, Star } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";

  let { data } = $props();
  const g = data.gallery;
</script>

<svelte:head>
  <title>{g.title} — Gallery — Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header class="flex items-start justify-between gap-4 flex-wrap">
    <div class="space-y-1.5">
      <p class="text-kicker text-text-muted">Gallery</p>
      <h1 class="text-h1 text-text-primary">{g.title}</h1>
      <div class="flex flex-wrap items-center gap-2 text-body-sm text-text-muted">
        <span>{g.imageCount} image{g.imageCount === 1 ? "" : "s"}</span>
        {#if g.studio}
          <span class="text-text-accent">· {g.studio.name}</span>
        {/if}
        {#if g.date}<span>· {g.date}</span>{/if}
        {#if g.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
        {#if g.rating && g.rating > 0}
          <span class="inline-flex items-center gap-1 text-accent-300">
            <Star class="h-3 w-3 fill-current" />{Math.round(g.rating / 20)}
          </span>
        {/if}
      </div>
    </div>
  </header>

  {#if g.details}
    <section class="surface-panel p-5 space-y-2">
      <h2 class="text-label text-text-muted">Details</h2>
      <p class="text-body text-text-secondary whitespace-pre-wrap break-words">{g.details}</p>
    </section>
  {/if}

  <section class="space-y-3">
    <h2 class="text-label text-text-muted">Images</h2>
    {#if g.images.length === 0}
      <div class="surface-panel p-6 text-center text-body text-text-muted">
        No images loaded. <span class="text-text-disabled">(Lightbox lands with APP-72 deep port.)</span>
      </div>
    {:else}
      <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
        {#each g.images as img (img.id)}
          <a href={`/images/${img.id}`} class="aspect-square bg-surface-1 overflow-hidden block hover:ring-1 hover:ring-border-accent transition-all duration-fast">
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
          </a>
        {/each}
      </div>
      {#if g.imageTotal > g.images.length}
        <p class="text-body-sm text-text-muted">
          Showing {g.images.length} of {g.imageTotal}.
          <span class="text-text-disabled">Pagination + lightbox port in APP-72.</span>
        </p>
      {/if}
    {/if}
  </section>

  {#if g.performers && g.performers.length > 0}
    <section class="surface-panel p-5 space-y-3">
      <h2 class="text-label text-text-muted">Cast</h2>
      <div class="flex flex-wrap gap-2">
        {#each g.performers as p (p.id)}
          <a href={`/performers/${p.id}`} class="surface-well px-2 py-1 text-body-sm text-text-primary hover:border-border-accent">
            {p.name}
          </a>
        {/each}
      </div>
    </section>
  {/if}

  {#if g.tags && g.tags.length > 0}
    <section class="surface-panel p-5 space-y-2">
      <h2 class="text-label text-text-muted">Tags</h2>
      <div class="flex flex-wrap gap-1.5">
        {#each g.tags as t (t.id)}
          <a href={`/tags/${encodeURIComponent(t.name)}`} class="tag-chip tag-chip-default hover:border-border-accent">
            {t.name}
          </a>
        {/each}
      </div>
    </section>
  {/if}
</div>
