<script lang="ts">
  import {
    Edit,
    FolderOpen,
    Film,
    Images,
    Image as ImageIcon,
    Music,
  } from "@lucide/svelte";
  import { Badge, Button } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";

  let { data } = $props();
  const c = data.collection;
  const items = $derived(data.items);

  type ItemEntry = (typeof items)[number];

  function bucket(t: "video" | "gallery" | "image" | "audio_track"): ItemEntry[] {
    return items.filter((it) => it.entityType === t);
  }
  const videoItems = $derived(bucket("video"));
  const galleryItems = $derived(bucket("gallery"));
  const imageItems = $derived(bucket("image"));
  const trackItems = $derived(bucket("audio_track"));
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div class="flex-1 space-y-1.5 min-w-0">
      <h1 class="flex items-center gap-2.5 text-text-primary">
        <FolderOpen class="h-5 w-5 text-text-accent" />
        {c.name}
      </h1>
      <div class="flex flex-wrap items-center gap-2 text-[0.78rem] text-text-muted">
        <span>{c.itemCount} item{c.itemCount === 1 ? "" : "s"}</span>
        <Badge>
          {#snippet children()}{c.mode}{/snippet}
        </Badge>
        {#if c.slideshowAutoAdvance}
          <Badge>
            {#snippet children()}auto-advance {c.slideshowDurationSeconds}s{/snippet}
          </Badge>
        {/if}
      </div>
      {#if c.description}
        <p class="mt-2 text-[0.82rem] text-text-secondary leading-relaxed whitespace-pre-wrap max-w-2xl">
          {c.description}
        </p>
      {/if}
    </div>
    <a href={`/collections/${c.id}/edit`}>
      <Button variant="secondary" size="md">
        {#snippet children()}
          <Edit class="h-3.5 w-3.5" />
          Edit
        {/snippet}
      </Button>
    </a>
  </div>

  {#if c.coverImagePath}
    <div class="surface-panel overflow-hidden aspect-[21/9] bg-surface-1">
      <img src={toApiUrl(c.coverImagePath)} alt="" class="h-full w-full object-cover" />
    </div>
  {/if}

  {#if Object.values(c.typeCounts).some((n) => n > 0)}
    <div class="flex flex-wrap gap-2">
      {#each Object.entries(c.typeCounts) as [type, count]}
        {#if count > 0}
          <div class="surface-stat px-3 py-2">
            <span class="text-kicker !text-text-disabled capitalize">
              {type.replaceAll("_", " ")}
            </span>
            <div class="text-lg font-semibold text-text-primary leading-tight">
              {count}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  {#if items.length === 0}
    <div class="surface-well flex flex-col items-center justify-center py-16 text-center">
      <FolderOpen class="h-8 w-8 text-text-disabled mb-2" />
      <p class="text-text-muted text-sm">
        {c.mode === "manual"
          ? "This collection is empty. Add items from any entity page."
          : "No items match the current rules."}
      </p>
    </div>
  {/if}

  {#if videoItems.length > 0}
    <HierarchySection title={`Videos — ${videoItems.length}`}>
      {#snippet children()}
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {#each videoItems as item (item.id)}
            {@const e = item.entity as { title?: string; thumbnailPath?: string | null; durationFormatted?: string | null; isNsfw?: boolean } | null}
            {#if e}
              <a
                href={`/videos/${item.entityId}`}
                class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
              >
                <NsfwBlur isNsfw={e.isNsfw ?? false} class="block">
                  <div class="aspect-video bg-surface-1 relative">
                    {#if e.thumbnailPath}
                      <img
                        src={toApiUrl(e.thumbnailPath)}
                        alt=""
                        loading="lazy"
                        class="h-full w-full object-cover"
                      />
                    {:else}
                      <div class="flex h-full items-center justify-center">
                        <Film class="h-8 w-8 text-text-disabled" />
                      </div>
                    {/if}
                    {#if e.durationFormatted}
                      <span class="absolute bottom-1 right-1 bg-black/70 text-white/90 text-[0.6rem] px-1 py-0.5">
                        {e.durationFormatted}
                      </span>
                    {/if}
                  </div>
                </NsfwBlur>
                <div class="p-2">
                  <h4 class="truncate text-[0.78rem] font-medium text-text-primary">
                    {e.title ?? "Untitled"}
                  </h4>
                </div>
              </a>
            {/if}
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {/if}

  {#if galleryItems.length > 0}
    <HierarchySection title={`Galleries — ${galleryItems.length}`}>
      {#snippet children()}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {#each galleryItems as item (item.id)}
            {@const e = item.entity as { title?: string; coverImagePath?: string | null; imageCount?: number; isNsfw?: boolean } | null}
            {#if e}
              <a
                href={`/galleries/${item.entityId}`}
                class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
              >
                <NsfwBlur isNsfw={e.isNsfw ?? false} class="block">
                  <div class="aspect-[3/4] bg-surface-1">
                    {#if e.coverImagePath}
                      <img
                        src={toApiUrl(e.coverImagePath)}
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
                  <h3 class="truncate text-sm font-medium">{e.title ?? "Untitled"}</h3>
                  <p class="text-xs text-text-muted mt-0.5">
                    {e.imageCount ?? 0} image{e.imageCount === 1 ? "" : "s"}
                  </p>
                </div>
              </a>
            {/if}
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {/if}

  {#if imageItems.length > 0}
    <HierarchySection title={`Images — ${imageItems.length}`}>
      {#snippet children()}
        <div class="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5">
          {#each imageItems as item (item.id)}
            {@const e = item.entity as { title?: string; thumbnailPath?: string | null; isNsfw?: boolean } | null}
            {#if e}
              <a
                href={`/images/${item.entityId}`}
                class="aspect-square bg-surface-1 overflow-hidden block hover:ring-1 hover:ring-border-accent transition-all duration-fast"
              >
                <NsfwBlur isNsfw={e.isNsfw ?? false} class="block h-full w-full">
                  {#if e.thumbnailPath}
                    <img
                      src={toApiUrl(e.thumbnailPath)}
                      alt={e.title ?? ""}
                      loading="lazy"
                      class="h-full w-full object-cover"
                    />
                  {:else}
                    <div class="flex h-full items-center justify-center">
                      <ImageIcon class="h-5 w-5 text-text-disabled" />
                    </div>
                  {/if}
                </NsfwBlur>
              </a>
            {/if}
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {/if}

  {#if trackItems.length > 0}
    <HierarchySection title={`Tracks — ${trackItems.length}`}>
      {#snippet children()}
        <ul class="surface-panel divide-y divide-border-subtle">
          {#each trackItems as item (item.id)}
            {@const e = item.entity as { title?: string; embeddedArtist?: string | null; embeddedAlbum?: string | null } | null}
            {#if e}
              <li class="flex items-center gap-3 px-4 py-2 hover:bg-surface-2 transition-colors duration-fast">
                <Music class="h-3.5 w-3.5 text-text-disabled shrink-0" />
                <a
                  href={`/audio/tracks/${item.entityId}`}
                  class="flex-1 min-w-0 text-[0.82rem] text-text-primary hover:text-text-accent truncate"
                >
                  {e.title ?? "Untitled"}
                </a>
                {#if e.embeddedArtist}
                  <span class="text-[0.72rem] text-text-muted truncate max-w-[240px]">
                    {e.embeddedArtist}
                  </span>
                {/if}
                {#if e.embeddedAlbum}
                  <span class="text-[0.72rem] text-text-disabled truncate max-w-[200px] hidden md:inline">
                    {e.embeddedAlbum}
                  </span>
                {/if}
              </li>
            {/if}
          {/each}
        </ul>
      {/snippet}
    </HierarchySection>
  {/if}
</div>
