<script lang="ts">
  import {
    Check,
    ChevronDown,
    Layers,
    Loader2,
    ScanSearch,
    X,
  } from "@lucide/svelte";
  import { Badge, cn } from "@obscura/ui-svelte";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";
  import type { VideoSeriesRow } from "$lib/identify/identify-types";
  import StatusDot from "../scrape/StatusDot.svelte";

  interface Props {
    row: VideoSeriesRow;
    expanded: boolean;
    onToggleExpand: () => void;
    onAccept: () => void;
    onDismiss: () => void;
    onReview?: () => void;
    onSeekSingle?: () => void;
  }

  let {
    row,
    expanded,
    onToggleExpand,
    onAccept,
    onDismiss,
    onReview,
    onSeekSingle,
  }: Props = $props();
</script>

<div>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    onclick={() => (onReview ? onReview() : onToggleExpand())}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        if (onReview) onReview();
        else onToggleExpand();
      }
    }}
    class={cn(
      "w-full text-left surface-card no-lift p-3 flex items-center gap-3 transition-all duration-fast cursor-pointer",
      expanded && "border-border-accent/40",
      row.status === "accepted" && "opacity-50",
      row.status === "rejected" && "opacity-30",
    )}
  >
    <StatusDot status={row.status} />
    <div class="h-10 w-7 flex-shrink-0 overflow-hidden">
      <EntityThumbnail
        kind="video-series"
        title={row.series.displayTitle}
        coverImagePath={row.series.coverImagePath}
        previewThumbnailPaths={row.series.previewThumbnailPaths}
        isNsfw={row.series.isNsfw}
        videoCount={row.series.visibleSfwVideoCount}
        class="h-full w-full"
        showCount={false}
      />
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-[0.8rem] font-medium truncate">{row.series.displayTitle}</p>
      <div class="flex items-center gap-2 mt-0.5">
        <span class="text-text-disabled text-[0.65rem]">
          {row.series.directVideoCount} video{row.series.directVideoCount !== 1 ? "s" : ""}
        </span>
        {#if row.series.studioName}
          <span class="text-text-accent text-[0.65rem]">{row.series.studioName}</span>
        {/if}
        {#if row.matchedProvider && row.status !== "pending"}
          <span class="text-text-disabled text-[0.6rem] font-mono">via {row.matchedProvider}</span>
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-1 flex-shrink-0">
      {#if (row.status === "pending" || row.status === "no-result" || row.status === "error") && onSeekSingle}
        <button
          type="button"
          onclick={(e) => {
            e.stopPropagation();
            onSeekSingle?.();
          }}
          class="p-1.5 hover:bg-accent-950/60 text-text-muted hover:text-text-accent transition-colors"
          title="Identify this series"
          aria-label="Identify this series"
        >
          <ScanSearch class="h-3.5 w-3.5" />
        </button>
      {/if}
      {#if row.status === "scraping"}
        <Loader2 class="h-3.5 w-3.5 animate-spin text-text-accent" />
      {/if}
      {#if row.status === "found"}
        {#if onReview}
          <button
            type="button"
            onclick={(e) => {
              e.stopPropagation();
              onReview?.();
            }}
            class="p-1.5 hover:bg-accent-950/60 text-text-muted hover:text-text-accent transition-colors"
            title="Review cascade (seasons + episodes + images)"
            aria-label="Review cascade"
          >
            <Layers class="h-3.5 w-3.5" />
          </button>
        {/if}
        <button
          type="button"
          onclick={(e) => {
            e.stopPropagation();
            onAccept();
          }}
          class="p-1.5 hover:bg-status-success/15 text-status-success-text transition-colors"
          title="Quick accept (legacy)"
          aria-label="Quick accept"
        >
          <Check class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onclick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          class="p-1.5 hover:bg-status-error/10 text-text-disabled hover:text-status-error-text transition-colors"
          title="Dismiss result"
          aria-label="Dismiss result"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      {/if}
      {#if row.status === "accepted"}
        <Badge variant="accent" class="text-[0.55rem]">
          {#snippet children()}Applied{/snippet}
        </Badge>
      {/if}
    </div>

    <ChevronDown
      class={cn(
        "h-3 w-3 text-text-disabled flex-shrink-0 transition-transform duration-fast",
        expanded && "rotate-180",
      )}
    />
  </div>

  {#if expanded && row.error}
    <div class="surface-card no-lift ml-6 mr-1 mb-1 p-3 border-status-error/20">
      <p class="text-[0.7rem] text-status-error-text">{row.error}</p>
    </div>
  {/if}
</div>
