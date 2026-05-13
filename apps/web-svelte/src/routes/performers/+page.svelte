<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { Users, Star, Image as ImageIcon } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type { PageData } from "./$types";
  import MediaSurface from "$lib/v1/media-surface/MediaSurfaceV1.svelte";
  import { performersSurfaceConfig } from "$lib/v1/media-surface/configs/performers-v1";
  import FilterSection from "$lib/v1/media-surface/toolbar/FilterSectionV1.svelte";

  let { data }: { data: PageData } = $props();

  // Build a snippet that injects the per-route Actor / Gender / Country
  // filter rows into the drawer, since these don't map to a built-in
  // section kind.
  type DrawerCtx = {
    panelFilters: Array<{ type?: string; label: string; value: string }>;
    onAddFilter: (
      type: "favorite" | "hasImage" | "gender" | "country" | "rating" | "ratingMin" | "ratingMax",
      label: string,
      value: string,
    ) => void;
  };

  const config = $derived(
    performersSurfaceConfig({
      initial: { items: data.performers, total: data.total },
      pageSize: data.pageSize,
      page: data.page,
      nsfwMode: data.nsfwMode,
      onMutated: () => invalidateAll(),
    }),
  );

  // Dynamic gender / country lists derived from the current page's items.
  const genders = $derived(
    Array.from(
      new Set(
        data.performers.map((p) => p.gender).filter((v): v is string => !!v),
      ),
    ).sort(),
  );
  const countries = $derived(
    Array.from(
      new Set(
        data.performers.map((p) => p.country).filter((v): v is string => !!v),
      ),
    ).sort(),
  );
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <Users class="h-5 w-5 text-text-accent" />
        Actors
      </h1>
      <p class="mt-1 text-[0.78rem] text-text-muted">Browse actors in your library</p>
    </div>
    <span class="mt-1 text-mono-sm text-text-disabled">{data.total} total</span>
  </div>

  {#snippet drawerSections({ panelFilters, onAddFilter }: DrawerCtx)}
    <FilterSection title="Actor">
      {#snippet children()}
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
            onclick={() => onAddFilter("hasImage", "Photo", "true")}
            class={cn(
              "tag-chip cursor-pointer transition-colors duration-fast",
              panelFilters.some((f) => f.type === "hasImage" && f.value === "true")
                ? "tag-chip-accent"
                : "tag-chip-default hover:tag-chip-accent",
            )}
          >
            <ImageIcon class="h-3 w-3" /> Has photo
          </button>
          <button
            type="button"
            onclick={() => onAddFilter("hasImage", "Photo", "false")}
            class={cn(
              "tag-chip cursor-pointer transition-colors duration-fast",
              panelFilters.some((f) => f.type === "hasImage" && f.value === "false")
                ? "tag-chip-accent"
                : "tag-chip-default hover:tag-chip-accent",
            )}
          >
            No photo
          </button>
        </div>
      {/snippet}
    </FilterSection>

    {#if genders.length > 0}
      <FilterSection title="Gender">
        {#snippet children()}
          <div class="flex flex-wrap gap-1">
            {#each genders as gender (gender)}
              <button
                type="button"
                onclick={() => onAddFilter("gender", "Gender", gender)}
                class={cn(
                  "tag-chip cursor-pointer transition-colors duration-fast",
                  panelFilters.some((f) => f.type === "gender" && f.value === gender)
                    ? "tag-chip-accent"
                    : "tag-chip-default hover:tag-chip-accent",
                )}
              >
                {gender.replaceAll("_", " ")}
              </button>
            {/each}
          </div>
        {/snippet}
      </FilterSection>
    {/if}

    {#if countries.length > 0}
      <FilterSection title="Country">
        {#snippet children()}
          <div class="flex flex-wrap gap-1 max-h-40 overflow-y-auto tag-scroll-area">
            {#each countries as country (country)}
              <button
                type="button"
                onclick={() => onAddFilter("country", "Country", country)}
                class={cn(
                  "tag-chip cursor-pointer transition-colors duration-fast",
                  panelFilters.some((f) => f.type === "country" && f.value === country)
                    ? "tag-chip-accent"
                    : "tag-chip-default hover:tag-chip-accent",
                )}
              >
                {country}
              </button>
            {/each}
          </div>
        {/snippet}
      </FilterSection>
    {/if}
  {/snippet}

  <MediaSurface
    config={{ ...config, extraFilterSections: drawerSections }}
    initialPrefsByFormFactor={data.surfacePrefs}
    legacyPrefsKey="performers:filterPresets"
  />
</div>
