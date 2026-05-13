<script lang="ts">
  import { Badge, Checkbox, cn } from "@obscura/ui-svelte";
  import type { CollectionListItemDto } from "@obscura/contracts";
  import type { CardProps } from "$lib/media-surface/config";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";

  let {
    item,
    index,
    selected = false,
    onToggleSelect,
    layout = "grid",
  }: CardProps<CollectionListItemDto> = $props();
</script>

{#if layout === "list"}
  <div class={cn(
    "flex items-center gap-3 px-3 py-2 surface-panel",
    selected && "bg-accent-950"
  )}>
    {#if onToggleSelect}
      <Checkbox checked={selected} onchange={() => onToggleSelect?.()} />
    {/if}
    <a href={`/collections/${item.id}`} class="w-16 shrink-0">
      <EntityThumbnail kind="collection" collection={item} gradientIndex={index} size="list" />
    </a>
    <a
      href={`/collections/${item.id}`}
      class="min-w-0 flex-1 text-[0.82rem] font-medium text-text-primary hover:text-text-accent"
    >
      {item.name}
    </a>
    <span class="text-[0.68rem] text-text-muted">
      {item.itemCount} item{item.itemCount === 1 ? "" : "s"}
    </span>
    <Badge>{item.mode}</Badge>
  </div>
{:else}
  <a
    href={`/collections/${item.id}`}
    class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
  >
    <EntityThumbnail kind="collection" collection={item} gradientIndex={index} />
    <div class="p-2.5 space-y-1">
      <h4 class="truncate text-body font-medium text-text-primary">{item.name}</h4>
      <div class="flex items-center gap-1.5 text-[0.65rem] text-text-muted">
        <span>{item.itemCount} item{item.itemCount === 1 ? "" : "s"}</span>
        <Badge>{item.mode}</Badge>
      </div>
    </div>
  </a>
{/if}
