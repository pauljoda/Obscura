<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { Building2, Image as ImageIcon, Star } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type { PageData } from "./$types";
  import MediaSurface from "$lib/media-surface/MediaSurface.svelte";
  import {
    studiosSurfaceConfig,
    type StudioFilterType,
  } from "$lib/media-surface/configs/studios";
  import FilterSection from "$lib/media-surface/toolbar/FilterSection.svelte";

  let { data }: { data: PageData } = $props();

  type DrawerCtx = {
    panelFilters: Array<{ type?: string; label: string; value: string }>;
    onAddFilter: (type: StudioFilterType, label: string, value: string) => void;
  };

  const config = $derived(
    studiosSurfaceConfig({
      initial: { items: data.studios, total: data.total },
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
        <Building2 class="h-5 w-5 text-text-accent" />
        Studios
      </h1>
      <p class="mt-1 text-[0.78rem] text-text-muted">Browse studios in your library</p>
    </div>
    <span class="mt-1 text-mono-sm text-text-disabled">{data.total} total</span>
  </div>

  {#snippet drawerSections({ panelFilters, onAddFilter }: DrawerCtx)}
    <FilterSection title="Studio">
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
    legacyPrefsKey="studios:filterPresets"
  />
</div>
