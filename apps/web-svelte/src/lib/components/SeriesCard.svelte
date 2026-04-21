<script lang="ts">
  import { FolderOpen, HardDrive, Images } from "@lucide/svelte";
  import type { VideoSeriesListItemDto } from "@obscura/contracts";
  import { cn } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import NsfwShowModeChip from "./NsfwShowModeChip.svelte";
  import { entityTerms, formatVideoCount } from "$lib/terminology";

  interface Props {
    series: VideoSeriesListItemDto;
    href: string;
    compact?: boolean;
  }

  let { series, href, compact = false }: Props = $props();

  const cover = $derived(toApiUrl(series.coverImagePath, series.updatedAt));
  const previews = $derived(
    (series.previewThumbnailPaths ?? [])
      .map((path) => toApiUrl(path, series.updatedAt))
      .filter(Boolean) as string[],
  );
  /** Cycle preview images on hover when there's no cover image. */
  let hoverIndex = $state(0);
  let hovering = $state(false);

  function startHover() {
    hovering = true;
  }
  function endHover() {
    hovering = false;
    hoverIndex = 0;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<a
  {href}
  class="group surface-card overflow-hidden transition-colors duration-fast hover:border-border-accent block"
  onmouseenter={startHover}
  onmouseleave={endHover}
  onmousemove={(e) => {
    if (!hovering || previews.length === 0 || cover) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    hoverIndex = Math.min(
      previews.length - 1,
      Math.max(0, Math.floor(ratio * previews.length)),
    );
  }}
>
  <div class="aspect-[2/3] relative bg-surface-2">
    {#if cover}
      <img
        src={cover}
        alt={series.displayTitle}
        class="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
    {:else if previews.length > 0}
      <img
        src={previews[hoverIndex] ?? previews[0]}
        alt={series.displayTitle}
        class="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
    {:else}
      <div class="flex h-full w-full items-center justify-center text-text-disabled">
        <FolderOpen class="h-8 w-8" />
      </div>
    {/if}

    <NsfwShowModeChip
      isNsfw={series.isNsfw}
      class="absolute bottom-2 right-2 z-10 pointer-events-none"
    />
    <div
      class="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/70 px-1.5 py-0.5 text-[0.65rem] text-white/90 backdrop-blur-sm"
    >
      <Images class="h-3 w-3" />
      {series.visibleSfwVideoCount}
    </div>
  </div>

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
