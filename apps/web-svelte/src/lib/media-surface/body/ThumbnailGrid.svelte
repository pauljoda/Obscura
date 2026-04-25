<script lang="ts" generics="T extends { id: string }">
  import { dur, ease } from "@obscura/ui-svelte";
  import { fade } from "svelte/transition";
  import { flip } from "svelte/animate";
  import type { Component } from "svelte";
  import type { CardProps } from "$lib/media-surface/config";

  interface Props {
    items: T[];
    cols: number;
    card: Component<CardProps<T>>;
    getKey?: (item: T) => string;
    /** Number of "above the fold" cards that load eagerly; rest are lazy. */
    eagerCount?: number;
    /** Selection set for bulk-action surfaces; passed through to the card. */
    selectedIds?: Set<string>;
    onToggleSelect?: (id: string) => void;
    reducedMotion?: boolean;
  }

  let {
    items,
    cols,
    card: Card,
    getKey = (item) => item.id,
    eagerCount = 6,
    selectedIds,
    onToggleSelect,
    reducedMotion = false,
  }: Props = $props();
</script>

<div class="thumb-grid" style:--col-count={cols}>
  {#each items as item, index (getKey(item))}
    <div
      animate:flip={{
        duration: reducedMotion ? 0 : dur.moderate,
        easing: ease.mechanical,
      }}
      in:fade|global={{
        duration: reducedMotion ? 0 : dur.normal,
        delay: reducedMotion ? 0 : Math.min(index * 12, 150),
        easing: ease.enter,
      }}
    >
      <Card
        item={item}
        index={index}
        imageLoading={index < eagerCount ? "eager" : "lazy"}
        selected={selectedIds?.has(getKey(item))}
        onToggleSelect={onToggleSelect ? () => onToggleSelect(getKey(item)) : undefined}
      />
    </div>
  {/each}
</div>

<style>
  .thumb-grid {
    display: grid;
    grid-template-columns: repeat(max(1, min(var(--col-count, 5), 2)), minmax(0, 1fr));
    gap: 0.75rem;
  }
  @media (min-width: 640px) {
    .thumb-grid {
      grid-template-columns: repeat(max(1, min(var(--col-count, 5), 4)), minmax(0, 1fr));
    }
  }
  @media (min-width: 1024px) {
    .thumb-grid {
      grid-template-columns: repeat(var(--col-count, 5), minmax(0, 1fr));
    }
  }
</style>
