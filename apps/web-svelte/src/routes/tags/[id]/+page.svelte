<script lang="ts">
  import { Tag as TagIcon, Star, Film, Images, Image as ImageIcon } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import type { VideoListItem } from "$lib/api/types";
  import type { GalleryListItemDto, ImageListItemDto } from "@obscura/contracts";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import { videoListItemToCardData } from "$lib/video-card-data";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";

  let { data } = $props();
  const t = data.tag;
  const videos = $derived(data.videos as VideoListItem[]);
  const galleries = $derived(data.galleries as GalleryListItemDto[]);
  const images = $derived(data.images as ImageListItemDto[]);
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-col sm:flex-row gap-4 items-start">
    {#if t.imagePath}
      <div class="w-24 h-24 shrink-0 bg-surface-1 border border-border-subtle overflow-hidden">
        <img src={toApiUrl(t.imagePath)} alt="" class="h-full w-full object-cover" />
      </div>
    {/if}
    <div class="flex-1 min-w-0 space-y-2">
      <h1 class="flex items-center gap-2.5 text-text-primary flex-wrap">
        <TagIcon class="h-5 w-5 text-text-accent" />
        {t.name}
        {#if t.favorite}
          <Star class="h-4 w-4 text-accent-500 fill-current" />
        {/if}
      </h1>

      <div class="flex flex-wrap gap-1">
        {#if (t.videoCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {t.videoCount} {t.videoCount === 1 ? "video" : "videos"}
            {/snippet}
          </Badge>
        {/if}
        {#if (t.imageCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {t.imageCount} {t.imageCount === 1 ? "image" : "images"}
            {/snippet}
          </Badge>
        {/if}
        {#if t.isNsfw}
          <Badge variant="warning">
            {#snippet children()}NSFW{/snippet}
          </Badge>
        {/if}
      </div>

      {#if t.description}
        <p class="mt-2 text-[0.82rem] text-text-secondary leading-relaxed whitespace-pre-wrap max-w-2xl">
          {t.description}
        </p>
      {/if}

      {#if t.aliases && t.aliases.length > 0}
        <p class="text-[0.72rem] text-text-muted">Aliases: {t.aliases.join(", ")}</p>
      {/if}
    </div>
  </div>

  {#if videos.length > 0}
    <HierarchySection title={`${data.totalVideos} ${data.totalVideos === 1 ? "video" : "videos"}`}>
      {#snippet children()}
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {#each videos as v, i (v.id)}
            <VideoCard
              video={videoListItemToCardData(v, `/tags/${encodeURIComponent(t.name)}`)}
              variant="grid"
              index={i}
              imageLoading={i < 6 ? "eager" : "lazy"}
            />
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {/if}

  {#if galleries.length > 0}
    <HierarchySection title="Galleries">
      {#snippet children()}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {#each galleries as g (g.id)}
            <a
              href={`/galleries/${g.id}`}
              class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
            >
              <NsfwBlur isNsfw={g.isNsfw} class="block">
                <div class="aspect-[3/4] bg-surface-1 relative">
                  {#if g.coverImagePath}
                    <img src={toApiUrl(g.coverImagePath)} alt="" loading="lazy" class="h-full w-full object-cover" />
                  {:else}
                    <div class="flex h-full items-center justify-center">
                      <Images class="h-8 w-8 text-text-disabled" />
                    </div>
                  {/if}
                </div>
              </NsfwBlur>
              <div class="p-2.5">
                <h3 class="truncate text-sm font-medium">{g.title}</h3>
                <p class="text-xs text-text-muted mt-0.5">
                  {g.imageCount} image{g.imageCount === 1 ? "" : "s"}
                </p>
              </div>
            </a>
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {/if}

  {#if images.length > 0}
    <HierarchySection title="Images">
      {#snippet children()}
        <div class="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5">
          {#each images as img (img.id)}
            <a
              href={`/images/${img.id}`}
              class="aspect-square bg-surface-1 overflow-hidden block hover:ring-1 hover:ring-border-accent transition-all duration-fast"
            >
              <NsfwBlur isNsfw={img.isNsfw} class="block h-full w-full">
                {#if img.thumbnailPath}
                  <img
                    src={toApiUrl(img.thumbnailPath)}
                    alt={img.title}
                    loading="lazy"
                    class="h-full w-full object-cover"
                  />
                {:else}
                  <div class="flex h-full w-full items-center justify-center">
                    <ImageIcon class="h-6 w-6 text-text-disabled" />
                  </div>
                {/if}
              </NsfwBlur>
            </a>
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {/if}

  {#if videos.length === 0 && galleries.length === 0 && images.length === 0}
    <div class="surface-panel p-8 text-center">
      <Film class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">
        Nothing tagged with “{t.name}” yet.
      </p>
    </div>
  {/if}
</div>
