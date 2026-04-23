<script lang="ts">
  import { Image as ImageIcon, FileText, HardDrive, Calendar } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import { updateImage } from "$lib/api/media";
  import InlineRating from "$lib/components/InlineRating.svelte";

  let { data } = $props();
  let overrideRating = $state<number | null | undefined>(undefined);
  const img = $derived((overrideRating === undefined
    ? data.image
    : { ...(data.image as unknown as Record<string, unknown>), rating: overrideRating }) as {
    id: string;
    title: string;
    details: string | null;
    date: string | null;
    rating: number | null;
    organized: boolean;
    isNsfw: boolean;
    width: number | null;
    height: number | null;
    format: string | null;
    fileSize: number | null;
    thumbnailPath: string | null;
    previewPath: string | null;
    fullPath: string | null;
    galleryId: string | null;
    filePath: string;
    studio: { id: string; name: string } | null;
    performers: { id: string; name: string }[];
    tags: { id: string; name: string; isNsfw: boolean }[];
  });

  async function handleRatingSave(next: number | null) {
    const previous = (data.image as { rating: number | null }).rating ?? null;
    overrideRating = next;
    try {
      await updateImage(img.id, { rating: next });
    } catch {
      overrideRating = previous;
      throw new Error("Failed to update rating");
    }
  }

  function formatSize(bytes: number | null): string {
    if (bytes == null || bytes <= 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit++;
    }
    return `${size.toFixed(size < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
  }
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div class="min-w-0 space-y-1.5">
      <h1 class="flex items-center gap-2.5 text-text-primary">
        <ImageIcon class="h-5 w-5 text-text-accent" />
        <span class="truncate max-w-[60ch]">{img.title}</span>
      </h1>
      <div class="flex flex-wrap items-center gap-2 text-[0.78rem] text-text-muted">
        {#if img.width && img.height}
          <span>{img.width} × {img.height}</span>
        {/if}
        {#if img.format}
          <span class="font-mono uppercase">{img.format}</span>
        {/if}
        {#if img.fileSize}
          <span>{formatSize(img.fileSize)}</span>
        {/if}
        {#if img.date}
          <span class="inline-flex items-center gap-1">
            <Calendar class="h-3 w-3" />{img.date}
          </span>
        {/if}
        {#if img.isNsfw}
          <Badge variant="warning">
            {#snippet children()}NSFW{/snippet}
          </Badge>
        {/if}
      </div>
    </div>
    <div class="shrink-0 pt-1">
      <InlineRating
        value={img.rating}
        onSave={handleRatingSave}
        ariaLabelPrefix="Rate image with"
      />
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
    <!-- Main preview -->
    <div
      class="surface-panel p-2 bg-surface-1 flex items-center justify-center min-h-[60vh]"
    >
      {#if img.fullPath || img.previewPath || img.thumbnailPath}
        <img
          src={toApiUrl(img.fullPath ?? img.previewPath ?? img.thumbnailPath)}
          alt={img.title}
          class="max-h-[80vh] max-w-full object-contain"
        />
      {:else}
        <div class="flex flex-col items-center justify-center text-text-disabled py-24">
          <ImageIcon class="h-12 w-12 mb-2" />
          <p class="text-sm">No preview available</p>
        </div>
      {/if}
    </div>

    <!-- Metadata sidebar -->
    <aside class="space-y-4 lg:sticky lg:top-5 lg:self-start">
      <div class="surface-well p-4 space-y-4">
        {#if img.details}
          <div class="space-y-1.5">
            <h2 class="text-kicker flex items-center gap-1.5">
              <FileText class="h-3 w-3" /> Details
            </h2>
            <p class="text-[0.82rem] text-text-secondary whitespace-pre-wrap">
              {img.details}
            </p>
          </div>
        {/if}

        {#if img.studio}
          <div class="space-y-1">
            <h2 class="text-kicker">Studio</h2>
            <a
              href={`/studios/${encodeURIComponent(img.studio.name)}`}
              class="text-[0.82rem] text-text-accent hover:text-text-accent-bright transition-colors"
            >
              {img.studio.name}
            </a>
          </div>
        {/if}

        {#if img.performers && img.performers.length > 0}
          <div class="space-y-2">
            <h2 class="text-kicker">Performers</h2>
            <div class="flex flex-wrap gap-1.5">
              {#each img.performers as p (p.id)}
                <a
                  href={`/performers/${p.id}`}
                  class="tag-chip tag-chip-default hover:tag-chip-accent transition-colors cursor-pointer"
                >
                  {p.name}
                </a>
              {/each}
            </div>
          </div>
        {/if}

        {#if img.tags && img.tags.length > 0}
          <div class="space-y-2">
            <h2 class="text-kicker">Tags</h2>
            <div class="flex flex-wrap gap-1.5">
              {#each img.tags as t (t.id)}
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

        {#if img.galleryId}
          <div class="space-y-1">
            <h2 class="text-kicker">Gallery</h2>
            <a
              href={`/galleries/${img.galleryId}`}
              class="inline-flex items-center gap-1.5 text-[0.82rem] text-text-accent hover:text-text-accent-bright transition-colors"
            >
              View gallery →
            </a>
          </div>
        {/if}

        <div class="space-y-1">
          <h2 class="text-kicker flex items-center gap-1.5">
            <HardDrive class="h-3 w-3" /> File
          </h2>
          <p class="text-[0.7rem] text-text-disabled break-all font-mono" title={img.filePath}>
            {img.filePath}
          </p>
        </div>
      </div>
    </aside>
  </div>
</div>
