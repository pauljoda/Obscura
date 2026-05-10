<script module lang="ts">
  export type SearchResultCardVariant = "grid" | "compact";
</script>

<script lang="ts">
  import type { SearchResultItem } from "@obscura/contracts";
  import { cn } from "@obscura/ui-svelte";
  import EntityThumbnail from "$lib/components/thumbnails/EntityThumbnail.svelte";
  import { searchResultToThumbnailProps } from "$lib/components/thumbnails/thumbnail-adapters";
  import { buildHrefWithFrom } from "$lib/back-navigation";
  import { SEARCH_KIND_CONFIG } from "./search-kind-config";

  interface Props {
    item: SearchResultItem;
    index?: number;
    variant?: SearchResultCardVariant;
    currentPath?: string;
    onSelect?: (href: string) => void;
  }

  let {
    item,
    index = 0,
    variant = "grid",
    currentPath,
    onSelect,
  }: Props = $props();

  const thumbnailProps = $derived(searchResultToThumbnailProps(item, index, currentPath));
  const href = $derived(buildHrefWithFrom(item.href, currentPath ?? ""));
  const label = $derived(SEARCH_KIND_CONFIG[item.kind]?.label ?? item.kind);
  const isTallGrid = $derived(item.kind === "video-series" || item.kind === "performer");
  const isRowGrid = $derived(
    item.kind === "studio" ||
      item.kind === "audio-library" ||
      item.kind === "audio-track",
  );
  const compactFrameClass = $derived.by(() => {
    if (item.kind === "video") return "h-8 w-12";
    if (item.kind === "video-series" || item.kind === "gallery") return "h-10 w-7";
    return "h-8 w-8";
  });
</script>

{#if variant === "compact"}
  <button
    type="button"
    class="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-fast hover:bg-surface-2"
    onclick={() => onSelect?.(item.href)}
  >
    <div class={cn("shrink-0 overflow-hidden bg-surface-1", compactFrameClass)}>
      <EntityThumbnail
        {...thumbnailProps}
        size="compact"
        aspectClass="h-full w-full"
        showChips={false}
        showCount={false}
        showLabel={false}
        compact
        showPlayOverlay={false}
      />
    </div>
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm text-text-primary">{item.title}</div>
      {#if item.subtitle}
        <div class="truncate text-[0.68rem] text-text-muted">{item.subtitle}</div>
      {/if}
    </div>
    <span class="tag-chip tag-chip-default shrink-0 text-[0.6rem]">
      {label}
    </span>
  </button>
{:else if isRowGrid}
  <a
    {href}
    class="surface-card-sharp flex items-center gap-3 p-2 transition-colors duration-fast hover:border-border-accent group/card"
  >
    <div class="h-16 w-16 shrink-0">
      <EntityThumbnail
        {...thumbnailProps}
        size="list"
        aspectClass="h-full w-full"
        showChips={false}
        showPlayOverlay={false}
      />
    </div>
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm text-text-primary">{item.title}</div>
      {#if item.subtitle}
        <div class="truncate text-[0.65rem] text-text-muted">{item.subtitle}</div>
      {/if}
    </div>
  </a>
{:else}
  <a
    {href}
    class={cn(
      "surface-card-sharp overflow-hidden transition-colors duration-fast hover:border-border-accent block",
      isTallGrid && "flex flex-col",
    )}
  >
    <EntityThumbnail
      {...thumbnailProps}
      size="grid"
      showCount={item.kind === "video-series" ? true : thumbnailProps.showCount}
    />
    <div class={cn("space-y-1", item.kind === "image" ? "px-1.5 py-1" : "p-2.5")}>
      <h4
        class={cn(
          "truncate font-medium text-text-primary",
          item.kind === "image" ? "text-[0.62rem] text-text-muted" : "text-body",
        )}
      >
        {item.title}
      </h4>
      {#if item.subtitle && item.kind !== "image"}
        <div class="truncate text-[0.65rem] text-text-muted">{item.subtitle}</div>
      {/if}
    </div>
  </a>
{/if}
