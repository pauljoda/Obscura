<script lang="ts">
  import { FolderOpen, HardDrive } from "@lucide/svelte";
  import type { VideoSeriesListItemDto } from "@obscura/contracts";
  import { cn } from "@obscura/ui-svelte";
  import { entityTerms, formatVideoCount } from "$lib/terminology";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";

  interface Props {
    series: VideoSeriesListItemDto;
    href: string;
    compact?: boolean;
  }

  let { series, href, compact = false }: Props = $props();
</script>

<a
  {href}
  class="group surface-card overflow-hidden transition-colors duration-fast hover:border-border-accent block"
>
  <EntityThumbnail
    kind="video-series"
    title={series.displayTitle}
    coverImagePath={series.coverImagePath}
    previewThumbnailPaths={series.previewThumbnailPaths}
    updatedAt={series.updatedAt}
    isNsfw={series.isNsfw}
    videoCount={series.visibleSfwVideoCount}
    rating={series.rating}
  />

  <div class={cn("px-2.5", compact ? "space-y-0.5 py-1.5" : "space-y-1.5 py-2.5")}>
    <div class="flex items-center gap-2">
      <FolderOpen
        class={cn(
          "flex-shrink-0 text-text-accent",
          compact ? "h-3 w-3" : "h-3.5 w-3.5",
        )}
      />
      <h3
        class={cn(
          "truncate font-medium text-text-primary",
          compact ? "text-[0.75rem]" : "text-[0.82rem]",
        )}
      >
        {series.displayTitle}
      </h3>
    </div>
    <div
      class={cn(
        "flex items-center gap-2 text-text-muted",
        compact ? "text-[0.62rem]" : "text-[0.68rem]",
      )}
    >
      <span>{formatVideoCount(series.visibleSfwVideoCount)}</span>
      {#if series.childSeasonCount > 0}
        <span>
          {series.childSeasonCount} child {series.childSeasonCount === 1
            ? entityTerms.seriesSingular.toLowerCase()
            : entityTerms.series.toLowerCase()}
        </span>
      {/if}
    </div>
    {#if series.libraryRootLabel}
      <div
        class={cn(
          "flex items-center gap-1.5 text-text-disabled",
          compact ? "text-[0.6rem]" : "text-[0.65rem]",
        )}
      >
        <HardDrive class="h-3 w-3 flex-shrink-0" />
        <span class="truncate">{series.libraryRootLabel}</span>
      </div>
    {/if}
    {#if !compact && series.containsNsfwDescendants && !series.isNsfw}
      <div class="text-[0.65rem] text-text-disabled">
        Mixed-content {entityTerms.seriesSingular.toLowerCase()}
      </div>
    {/if}
  </div>
</a>
