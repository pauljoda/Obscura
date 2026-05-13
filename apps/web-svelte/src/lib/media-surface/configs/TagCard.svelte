<script lang="ts">
  import { Badge, Checkbox, cn } from "@obscura/ui-svelte";
  import type { CardProps } from "$lib/media-surface/config";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";
  import type { TagItem } from "$lib/api/types";

  let {
    item,
    selected = false,
    onToggleSelect,
    layout = "grid",
  }: CardProps<TagItem> = $props();

  const href = $derived(`/tags/${encodeURIComponent(item.name)}`);
  const usageCount = $derived(
    (item.videoCount ?? 0) +
      (item.galleryCount ?? 0) +
      (item.imageCount ?? 0) +
      (item.audioTrackCount ?? 0),
  );
</script>

{#if layout === "list"}
  <div class={cn("flex items-center gap-3 px-3 py-2 surface-panel", selected && "bg-accent-950")}>
    {#if onToggleSelect}
      <Checkbox checked={selected} onchange={() => onToggleSelect?.()} />
    {/if}
    <a href={href} class="w-14 shrink-0">
      <EntityThumbnail kind="tag" tag={item} size="list" showLabel={false} />
    </a>
    <a
      href={href}
      class="min-w-0 flex-1 text-[0.82rem] font-medium text-text-primary hover:text-text-accent"
    >
      {item.name}
    </a>
    <span class="text-[0.68rem] text-text-muted">
      {usageCount} use{usageCount === 1 ? "" : "s"}
    </span>
    {#if item.favorite}
      <Badge>Favorite</Badge>
    {/if}
  </div>
{:else}
  <a
    href={href}
    class={cn(
      "surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block",
      selected && "border-border-accent bg-accent-950",
    )}
  >
    <EntityThumbnail kind="tag" tag={item} showLabel={false} />
    <div class="space-y-1 p-2.5">
      <h4 class="truncate text-body font-medium text-text-primary">{item.name}</h4>
      <div class="flex items-center gap-1.5 text-[0.65rem] text-text-muted">
        <span>{usageCount} use{usageCount === 1 ? "" : "s"}</span>
        {#if item.favorite}
          <Badge>Favorite</Badge>
        {/if}
      </div>
    </div>
  </a>
{/if}
