<script lang="ts" generics="T extends { id: string }">
  import { dur, ease } from "@obscura/ui-svelte";
  import { flip } from "svelte/animate";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import type { Component } from "svelte";
  import type { CardProps } from "$lib/media-surface/config";

  /**
   * CSS-columns masonry layout used by the flat Images view. Items keep
   * their natural aspect ratio and tile down columns instead of into a
   * grid, so tall and wide images stay recognizable. Items render
   * directly without fade-in to keep incremental loads snappy.
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

  // Tweened col-count for a smoother slider experience; CSS column-count
  // is integer-only so the displayed value is rounded.
  // svelte-ignore state_referenced_locally
  const animatedCols = tweened(cols, {
    duration: reducedMotion ? 0 : 240,
    easing: cubicOut,
  });
  $effect(() => {
    void animatedCols.set(cols, { duration: reducedMotion ? 0 : 240 });
  });
  const displayCols = $derived(Math.max(1, Math.round($animatedCols)));
</script>

<div class="masonry" style:--col-count={displayCols}>
  {#each items as item, index (getKey(item))}
    <div
      class="masonry-item"
      animate:flip={{
        duration: reducedMotion ? 0 : dur.moderate,
        easing: ease.mechanical,
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
  /*
   * Same mobile-aware mapping as the standard ThumbnailGrid: smallest
   * slider value lands on 1 column on phones (largest cards), capped
   * at 4 cols on phones / 6 on tablets so masonry items stay legible.
   * Desktop is uncapped.
   */
  .masonry {
    column-count: max(1, min(calc(var(--col-count, 5) - 1), 4));
    column-gap: 0.5rem;
    /* CSS columns animate smoothly in modern browsers; the tweened
     * value paces the integer step crossings. */
    transition: column-count 240ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  @media (min-width: 640px) {
    .masonry {
      column-count: max(2, min(var(--col-count, 5), 6));
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
  @media (prefers-reduced-motion: reduce) {
    .masonry {
      transition: none;
    }
  }
</style>
