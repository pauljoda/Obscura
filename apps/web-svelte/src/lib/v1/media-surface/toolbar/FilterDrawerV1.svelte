<script lang="ts">
  import type { Snippet } from "svelte";
  import type { AlphabeticalFilterSectionItem } from "./AlphabeticalFilterSectionV1.svelte";
  import ResolutionSection from "./filter-sections/ResolutionSectionV1.svelte";
  import RatingSection from "./filter-sections/RatingSectionV1.svelte";
  import DateRangeSection from "./filter-sections/DateRangeSectionV1.svelte";
  import DurationSection from "./filter-sections/DurationSectionV1.svelte";
  import PlaybackSection from "./filter-sections/PlaybackSectionV1.svelte";
  import LibraryFlagsSection from "./filter-sections/LibraryFlagsSectionV1.svelte";
  import CodecSection from "./filter-sections/CodecSectionV1.svelte";
  import TagsSection from "./filter-sections/TagsSectionV1.svelte";
  import PerformersSection from "./filter-sections/PerformersSectionV1.svelte";
  import StudiosSection from "./filter-sections/StudiosSectionV1.svelte";
  import type { SectionAddFilter, SectionPanelFilter } from "./filter-sections/types-v1.ts";

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
    showReadFilter?: boolean;
    showNsfwFilter?: boolean;
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
    showReadFilter = false,
    showNsfwFilter = false,
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
        showRead={showReadFilter}
        showNsfw={showNsfwFilter}
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
