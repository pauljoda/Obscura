<script lang="ts">
  import { Building2, Star, ExternalLink, Film, Images, Music } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import type { VideoListItem } from "$lib/api/types";
  import type {
    VideoSeriesListItemDto,
    GalleryListItemDto,
    AudioLibraryListItemDto,
  } from "@obscura/contracts";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import { videoListItemToCardData } from "$lib/video-card-data";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import SeriesCard from "$lib/components/SeriesCard.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";

  let { data } = $props();
  const s = data.studio;

  const videos = $derived(data.videos as VideoListItem[]);
  const series = $derived(data.series as VideoSeriesListItemDto[]);
  const galleries = $derived(data.galleries as GalleryListItemDto[]);
  const audioLibraries = $derived(data.audioLibraries as AudioLibraryListItemDto[]);
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-col sm:flex-row gap-4 items-start">
    <div class="w-48 aspect-video shrink-0 bg-surface-1 border border-border-subtle overflow-hidden">
      {#if s.imagePath || s.imageUrl}
        <img
          src={toApiUrl(s.imagePath) ?? s.imageUrl ?? undefined}
          alt=""
          class="h-full w-full object-contain"
        />
      {:else}
        <div class="flex h-full items-center justify-center">
          <Building2 class="h-10 w-10 text-text-disabled" />
        </div>
      {/if}
    </div>
    <div class="flex-1 min-w-0 space-y-2">
      <h1 class="flex items-center gap-2.5 text-text-primary">
        <Building2 class="h-5 w-5 text-text-accent" />
        {s.name}
        {#if s.favorite}
          <Star class="h-4 w-4 text-accent-500 fill-current" />
        {/if}
      </h1>

      {#if s.url}
        <a
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-[0.78rem] text-text-accent hover:text-accent-400 transition-colors duration-fast"
        >
          <ExternalLink class="h-3 w-3" />
          {s.url}
        </a>
      {/if}

      <div class="flex flex-wrap gap-1 pt-1">
        {#if (s.videoCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {s.videoCount} {s.videoCount === 1 ? "video" : "videos"}
            {/snippet}
          </Badge>
        {/if}
        {#if (s.imageAppearanceCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {s.imageAppearanceCount} {s.imageAppearanceCount === 1 ? "image" : "images"}
            {/snippet}
          </Badge>
        {/if}
        {#if (s.audioLibraryCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {s.audioLibraryCount} {s.audioLibraryCount === 1 ? "album" : "albums"}
            {/snippet}
          </Badge>
        {/if}
        {#if s.isNsfw}
          <Badge variant="warning">
            {#snippet children()}NSFW{/snippet}
          </Badge>
        {/if}
      </div>

      {#if s.description}
        <p class="mt-3 text-[0.82rem] text-text-secondary leading-relaxed whitespace-pre-wrap max-w-2xl">
          {s.description}
        </p>
      {/if}
      {#if s.aliases}
        <p class="text-[0.72rem] text-text-muted">Aliases: {s.aliases}</p>
      {/if}
    </div>
  </div>

  {#if series.length > 0}
    <HierarchySection title="Series">
      {#snippet children()}
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {#each series as sItem (sItem.id)}
            <SeriesCard series={sItem} href={`/videos?view=series&series=${sItem.id}`} compact />
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {/if}

  {#if videos.length > 0}
    <HierarchySection title={`${data.totalVideos} ${data.totalVideos === 1 ? "video" : "videos"}`}>
      {#snippet children()}
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {#each videos as v, i (v.id)}
            <VideoCard
              video={videoListItemToCardData(v, `/studios/${encodeURIComponent(s.name)}`)}
              variant="grid"
              index={i}
              imageLoading={i < 6 ? "eager" : "lazy"}
            />
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {:else if !series.length && !galleries.length && !audioLibraries.length}
    <HierarchySection title="Videos">
      {#snippet children()}
        <div class="surface-panel p-8 text-center">
          <Film class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
          <p class="text-body text-text-muted">
            Nothing from this studio yet — run Identify to hydrate.
          </p>
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
                    <img
                      src={toApiUrl(g.coverImagePath)}
                      alt=""
                      loading="lazy"
                      class="h-full w-full object-cover"
                    />
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

  {#if audioLibraries.length > 0}
    <HierarchySection title="Audio">
      {#snippet children()}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {#each audioLibraries as a (a.id)}
            <a
              href={`/audio/${a.id}`}
              class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
            >
              <NsfwBlur isNsfw={a.isNsfw} class="block">
                <div class="aspect-square bg-surface-1">
                  {#if a.coverImagePath}
                    <img
                      src={toApiUrl(a.coverImagePath)}
                      alt=""
                      loading="lazy"
                      class="h-full w-full object-cover"
                    />
                  {:else}
                    <div class="flex h-full items-center justify-center">
                      <Music class="h-8 w-8 text-text-disabled" />
                    </div>
                  {/if}
                </div>
              </NsfwBlur>
              <div class="p-2.5">
                <h3 class="truncate text-sm font-medium">{a.title}</h3>
                <p class="text-xs text-text-muted mt-0.5">
                  {a.trackCount} track{a.trackCount === 1 ? "" : "s"}
                </p>
              </div>
            </a>
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {/if}
</div>
