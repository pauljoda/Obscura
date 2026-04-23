<script lang="ts">
  import { Users, Star, Film, Images, Music, FolderOpen } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import { updatePerformer } from "$lib/api/entities";
  import type { VideoListItem } from "$lib/api/types";
  import type {
    VideoSeriesListItemDto,
    GalleryListItemDto,
    AudioLibraryListItemDto,
  } from "@obscura/contracts";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import { videoListItemToCardData } from "$lib/video-card-data";
  import InlineRating from "$lib/components/InlineRating.svelte";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import SeriesCard from "$lib/components/SeriesCard.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import { formatVideoCount } from "$lib/terminology";

  let { data } = $props();
  let overrideRating = $state<number | null | undefined>(undefined);
  const p = $derived((overrideRating === undefined
    ? data.performer
    : { ...(data.performer as Record<string, unknown>), rating: overrideRating }) as {
    id: string;
    name: string;
    disambiguation?: string | null;
    aliases?: string | null;
    gender?: string | null;
    birthdate?: string | null;
    country?: string | null;
    ethnicity?: string | null;
    height?: string | null;
    weight?: string | null;
    eyeColor?: string | null;
    hairColor?: string | null;
    imagePath?: string | null;
    favorite?: boolean;
    rating?: number | null;
    isNsfw?: boolean;
    videoCount?: number;
    imageAppearanceCount?: number;
    audioLibraryCount?: number;
    details?: string | null;
    knownFor?: Array<{
      entityType: "video_movie" | "video_episode" | "video_series";
      entityId: string;
      title: string;
      character: string | null;
      thumbnailPath: string | null;
    }>;
  });

  const videos = $derived(data.videos as VideoListItem[]);
  const series = $derived(data.series as VideoSeriesListItemDto[]);
  const galleries = $derived(data.galleries as GalleryListItemDto[]);
  const audioLibraries = $derived(data.audioLibraries as AudioLibraryListItemDto[]);

  async function handleRatingSave(next: number | null) {
    const previous = (data.performer as { rating?: number | null }).rating ?? null;
    overrideRating = next;
    try {
      await updatePerformer(p.id, { rating: next });
    } catch {
      overrideRating = previous;
      throw new Error("Failed to update rating");
    }
  }
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-col sm:flex-row gap-4 items-start">
    <div class="w-32 sm:w-40 aspect-[3/4] shrink-0 bg-surface-1 border border-border-subtle overflow-hidden">
      {#if p.imagePath}
        <NsfwBlur isNsfw={p.isNsfw ?? false} class="block h-full w-full">
          <img src={toApiUrl(p.imagePath)} alt={p.name} class="h-full w-full object-cover" />
        </NsfwBlur>
      {:else}
        <div class="flex h-full items-center justify-center">
          <Users class="h-10 w-10 text-text-disabled" />
        </div>
      {/if}
    </div>
    <div class="flex-1 min-w-0 space-y-2">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="flex items-center gap-2.5 text-text-primary flex-wrap">
            <Users class="h-5 w-5 text-text-accent" />
            {p.name}
            {#if p.disambiguation}
              <span class="text-text-muted text-sm">({p.disambiguation})</span>
            {/if}
            {#if p.favorite}
              <Star class="h-4 w-4 text-accent-500 fill-current" />
            {/if}
          </h1>

          {#if p.aliases}
            <p class="text-[0.72rem] text-text-muted mt-1">Aliases: {p.aliases}</p>
          {/if}
        </div>

        <div class="shrink-0 pt-1">
          <InlineRating
            value={p.rating ?? null}
            onSave={handleRatingSave}
            ariaLabelPrefix="Rate performer with"
          />
        </div>
      </div>

      <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[0.78rem] text-text-secondary mt-2">
        {#if p.gender}
          <div class="flex gap-2">
            <dt class="text-text-muted">Gender:</dt>
            <dd>{p.gender.replaceAll("_", " ")}</dd>
          </div>
        {/if}
        {#if p.country}
          <div class="flex gap-2">
            <dt class="text-text-muted">Country:</dt>
            <dd>{p.country}</dd>
          </div>
        {/if}
        {#if p.birthdate}
          <div class="flex gap-2">
            <dt class="text-text-muted">Born:</dt>
            <dd>{p.birthdate}</dd>
          </div>
        {/if}
        {#if p.ethnicity}
          <div class="flex gap-2">
            <dt class="text-text-muted">Ethnicity:</dt>
            <dd>{p.ethnicity}</dd>
          </div>
        {/if}
        {#if p.height}
          <div class="flex gap-2">
            <dt class="text-text-muted">Height:</dt>
            <dd>{p.height}</dd>
          </div>
        {/if}
        {#if p.weight}
          <div class="flex gap-2">
            <dt class="text-text-muted">Weight:</dt>
            <dd>{p.weight}</dd>
          </div>
        {/if}
        {#if p.eyeColor}
          <div class="flex gap-2">
            <dt class="text-text-muted">Eyes:</dt>
            <dd>{p.eyeColor}</dd>
          </div>
        {/if}
        {#if p.hairColor}
          <div class="flex gap-2">
            <dt class="text-text-muted">Hair:</dt>
            <dd>{p.hairColor}</dd>
          </div>
        {/if}
      </dl>

      <div class="flex flex-wrap gap-1 pt-1">
        {#if (p.videoCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {p.videoCount} {p.videoCount === 1 ? "video" : "videos"}
            {/snippet}
          </Badge>
        {/if}
        {#if (p.imageAppearanceCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {p.imageAppearanceCount} {p.imageAppearanceCount === 1 ? "image" : "images"}
            {/snippet}
          </Badge>
        {/if}
        {#if (p.audioLibraryCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {p.audioLibraryCount} {p.audioLibraryCount === 1 ? "album" : "albums"}
            {/snippet}
          </Badge>
        {/if}
        {#if p.isNsfw}
          <Badge variant="warning">
            {#snippet children()}NSFW{/snippet}
          </Badge>
        {/if}
      </div>

      {#if p.details}
        <p class="mt-3 text-[0.82rem] text-text-secondary leading-relaxed max-w-2xl">
          {p.details}
        </p>
      {/if}
    </div>
  </div>

  {#if p.knownFor && p.knownFor.length > 0}
    <HierarchySection title="Known For">
      {#snippet children()}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {#each p.knownFor as entry (entry.entityType + entry.entityId)}
            {@const href =
              entry.entityType === "video_series"
                ? `/series?series=${entry.entityId}`
                : `/videos/${entry.entityId}`}
            <a
              {href}
              class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
            >
              <div class="aspect-[2/3] bg-surface-2">
                {#if entry.thumbnailPath}
                  <img
                    src={toApiUrl(entry.thumbnailPath)}
                    alt=""
                    loading="lazy"
                    class="h-full w-full object-cover"
                  />
                {:else}
                  <div class="flex h-full w-full items-center justify-center text-text-disabled">
                    <FolderOpen class="h-8 w-8" />
                  </div>
                {/if}
              </div>
              <div class="p-2 space-y-0.5">
                <h4 class="truncate text-[0.78rem] font-medium text-text-primary">{entry.title}</h4>
                {#if entry.character}
                  <p class="truncate text-[0.65rem] text-text-muted">as {entry.character}</p>
                {/if}
              </div>
            </a>
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
              video={videoListItemToCardData(v, `/performers/${p.id}`)}
              variant="grid"
              index={i}
              imageLoading={i < 6 ? "eager" : "lazy"}
            />
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {:else}
    <HierarchySection title="Videos">
      {#snippet children()}
        <div class="surface-panel p-8 text-center">
          <Film class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
          <p class="text-body text-text-muted">No videos yet.</p>
        </div>
      {/snippet}
    </HierarchySection>
  {/if}

  {#if series.length > 0}
    <HierarchySection title={`Series — ${formatVideoCount(data.totalSeries)}`}>
      {#snippet children()}
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {#each series as s (s.id)}
            <SeriesCard series={s} href={`/series?series=${s.id}`} compact />
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
