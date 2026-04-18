<script lang="ts">
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";

  let { data } = $props();
  const img = data.image;
</script>

<svelte:head>
  <title>{img.title} — Image — Obscura</title>
</svelte:head>

<div class="space-y-4">
  <header class="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <p class="text-kicker text-text-muted">Image</p>
      <h1 class="text-h1 text-text-primary truncate max-w-[60ch]">{img.title}</h1>
      <div class="flex flex-wrap items-center gap-2 text-body-sm text-text-muted mt-1">
        {#if img.width && img.height}<span>{img.width} × {img.height}</span>{/if}
        {#if img.format}<span class="font-mono">{img.format}</span>{/if}
        {#if img.date}<span>{img.date}</span>{/if}
        {#if img.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
      </div>
    </div>
  </header>

  <div class="surface-panel p-2 bg-surface-1 flex items-center justify-center">
    {#if img.previewPath || img.fullPath || img.thumbnailPath}
      <img
        src={toApiUrl(img.previewPath ?? img.fullPath ?? img.thumbnailPath)}
        alt={img.title}
        class="max-h-[80vh] object-contain"
      />
    {/if}
  </div>

  {#if img.galleryId}
    <p class="text-body-sm text-text-muted">
      From <a href={`/galleries/${img.galleryId}`} class="text-text-accent hover:text-accent-300">gallery</a>
    </p>
  {/if}
</div>
