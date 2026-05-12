<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { Image as ImageIcon, Star, Tag as TagIcon } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type { PageData } from "./$types";
  import MediaSurface from "$lib/media-surface/MediaSurface.svelte";
  import {
    tagsSurfaceConfig,
    type TagFilterType,
  } from "$lib/media-surface/configs/tags";
  import FilterSection from "$lib/media-surface/toolbar/FilterSection.svelte";

  let { data }: { data: PageData } = $props();

  type DrawerCtx = {
    panelFilters: Array<{ type?: string; label: string; value: string }>;
    onAddFilter: (type: TagFilterType, label: string, value: string) => void;
  };

  const config = $derived(
    tagsSurfaceConfig({
      initial: { items: data.tags, total: data.total },
      pageSize: data.pageSize,
      page: data.page,
      nsfwMode: data.nsfwMode,
      onMutated: () => invalidateAll(),
    }),
  );
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <TagIcon class="h-5 w-5 text-text-accent" />
        Tags
      </h1>
      <p class="mt-1 text-[0.78rem] text-text-muted">Browse tags in your library</p>
    </div>
    <span class="mt-1 text-mono-sm text-text-disabled">{data.total} total</span>
  </div>

  {#snippet drawerSections({ panelFilters, onAddFilter }: DrawerCtx)}
    <FilterSection title="Tag">
      <div class="flex flex-wrap gap-1">
        <button
          type="button"
          onclick={() => onAddFilter("favorite", "Favorite", "true")}
          class={cn(
            "tag-chip cursor-pointer transition-colors duration-fast",
            panelFilters.some((f) => f.type === "favorite" && f.value === "true")
              ? "tag-chip-accent"
              : "tag-chip-default hover:tag-chip-accent",
          )}
        >
          <Star class="h-3 w-3" /> Favorites
        </button>
        <button
          type="button"
          onclick={() => onAddFilter("hasImage", "Image", "true")}
          class={cn(
            "tag-chip cursor-pointer transition-colors duration-fast",
            panelFilters.some((f) => f.type === "hasImage" && f.value === "true")
              ? "tag-chip-accent"
              : "tag-chip-default hover:tag-chip-accent",
          )}
        >
          <ImageIcon class="h-3 w-3" /> Has image
        </button>
        <button
          type="button"
          onclick={() => onAddFilter("hasImage", "Image", "false")}
          class={cn(
            "tag-chip cursor-pointer transition-colors duration-fast",
            panelFilters.some((f) => f.type === "hasImage" && f.value === "false")
              ? "tag-chip-accent"
              : "tag-chip-default hover:tag-chip-accent",
          )}
        >
          No image
        </button>
      </div>
    </FilterSection>
  {/snippet}

  <MediaSurface
    config={{ ...config, extraFilterSections: drawerSections }}
    initialPrefsByFormFactor={data.surfacePrefs}
    legacyPrefsKey="tags:filterPresets"
  />
</div>
