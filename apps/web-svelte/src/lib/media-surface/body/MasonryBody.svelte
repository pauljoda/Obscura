<script lang="ts" generics="T extends { id: string }">
  import { dur, ease } from "@obscura/ui-svelte";
  import { fade } from "svelte/transition";
  import type { Component } from "svelte";
  import type { CardProps } from "$lib/media-surface/config";

  /**
   * CSS-columns masonry layout used by the flat Images view. Items keep
   * their natural aspect ratio and tile down columns instead of into a
   * grid, so tall and wide images stay recognizable.
   *
   * Note: CSS columns reflow as items append; we deliberately skip
   * `animate:flip` here because flip animations across multi-column
   * reflow look jittery (each column shifts independently). Fade-in
   * still runs.
   */
  interface Props {
    items: T[];
    cols: number;
    card: Component<CardProps<T>>;
    getKey?: (item: T) => string;
    selectedIds?: Set<string>;
    onToggleSelect?: (id: string) => void;
    onActivate?: (item: T, index: number) => void;
    reducedMotion?: boolean;
  }

  let {
    items,
    cols,
    card: Card,
    getKey = (item) => item.id,
    selectedIds,
    onToggleSelect,
    onActivate,
    reducedMotion = false,
  }: Props = $props();
</script>

<div class="masonry" style:--col-count={cols}>
  {#each items as item, index (getKey(item))}
    <div
      class="masonry-item"
      in:fade|global={{
        duration: reducedMotion ? 0 : dur.normal,
        delay: reducedMotion ? 0 : Math.min(index * 8, 120),
        easing: ease.enter,
      }}
    >
      <Card
        item={item}
        index={index}
        imageLoading={index < 12 ? "eager" : "lazy"}
        selected={selectedIds?.has(getKey(item))}
        onToggleSelect={onToggleSelect ? () => onToggleSelect(getKey(item)) : undefined}
        onActivate={onActivate ? () => onActivate(item, index) : undefined}
        layout="masonry"
      />
    </div>
  {/each}
</div>

<style>
  .masonry {
    column-count: max(2, min(var(--col-count, 5), 3));
    column-gap: 0.5rem;
  }
  @media (min-width: 640px) {
    .masonry {
      column-count: max(3, min(var(--col-count, 5), 5));
    }
  }
  @media (min-width: 1024px) {
    .masonry {
      column-count: var(--col-count, 5);
    }
  }
  .masonry-item {
    break-inside: avoid;
    margin-bottom: 0.5rem;
  }
</style>
