<script lang="ts">
  import type { Snippet } from "svelte";
  import type { AlphabeticalFilterSectionItem } from "./AlphabeticalFilterSection.svelte";
  import ResolutionSection from "./filter-sections/ResolutionSection.svelte";
  import RatingSection from "./filter-sections/RatingSection.svelte";
  import DateRangeSection from "./filter-sections/DateRangeSection.svelte";
  import DurationSection from "./filter-sections/DurationSection.svelte";
  import PlaybackSection from "./filter-sections/PlaybackSection.svelte";
  import LibraryFlagsSection from "./filter-sections/LibraryFlagsSection.svelte";
  import CodecSection from "./filter-sections/CodecSection.svelte";
  import TagsSection from "./filter-sections/TagsSection.svelte";
  import PerformersSection from "./filter-sections/PerformersSection.svelte";
  import StudiosSection from "./filter-sections/StudiosSection.svelte";
  import type { SectionAddFilter, SectionPanelFilter } from "./filter-sections/types.ts";

  export type FilterSectionKey =
    | "resolution"
    | "rating"
    | "date"
    | "duration"
    | "playback"
    | "libraryFlags"
    | "codec"
    | "tags"
    | "performers"
    | "studios";

  interface Props {
    enabledSections: ReadonlySet<FilterSectionKey>;
    panelFilters: SectionPanelFilter[];
    onAddFilter: SectionAddFilter;
    tagItems: AlphabeticalFilterSectionItem[];
    performerItems: AlphabeticalFilterSectionItem[];
    studioItems: AlphabeticalFilterSectionItem[];
    showInteractiveFilter?: boolean;
    showComicFilter?: boolean;
    /** Render extra panel sections at the top of the drawer (per-route hooks). */
    customSections?: Snippet<[{ panelFilters: SectionPanelFilter[] }]>;
  }

  let {
    enabledSections,
    panelFilters,
    onAddFilter,
    tagItems,
    performerItems,
    studioItems,
    showInteractiveFilter = true,
    showComicFilter = false,
    customSections,
  }: Props = $props();
</script>

<div class="surface-well mt-px p-3">
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {#if customSections}
      {@render customSections({ panelFilters })}
    {/if}
    {#if enabledSections.has("resolution")}
      <ResolutionSection {panelFilters} {onAddFilter} />
    {/if}
    {#if enabledSections.has("rating")}
      <RatingSection {panelFilters} {onAddFilter} />
    {/if}
    {#if enabledSections.has("date")}
      <DateRangeSection {onAddFilter} />
    {/if}
    {#if enabledSections.has("duration")}
      <DurationSection {panelFilters} {onAddFilter} />
    {/if}
    {#if enabledSections.has("playback")}
      <PlaybackSection {panelFilters} {onAddFilter} />
    {/if}
    {#if enabledSections.has("libraryFlags")}
      <LibraryFlagsSection
        {panelFilters}
        {onAddFilter}
        showInteractive={showInteractiveFilter}
        showComic={showComicFilter}
      />
    {/if}
    {#if enabledSections.has("codec")}
      <CodecSection {panelFilters} {onAddFilter} />
    {/if}
    {#if enabledSections.has("tags") && tagItems.length > 0}
      <TagsSection items={tagItems} {panelFilters} {onAddFilter} />
    {/if}
    {#if enabledSections.has("performers") && performerItems.length > 0}
      <PerformersSection items={performerItems} {panelFilters} {onAddFilter} />
    {/if}
    {#if enabledSections.has("studios") && studioItems.length > 0}
      <StudiosSection items={studioItems} {panelFilters} {onAddFilter} />
    {/if}
  </div>
</div>
