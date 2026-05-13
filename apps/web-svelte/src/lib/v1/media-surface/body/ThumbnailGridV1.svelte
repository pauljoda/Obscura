<script lang="ts" generics="T extends { id: string }">
  import { dur, ease } from "@obscura/ui-svelte";
  import { flip } from "svelte/animate";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import type { Component } from "svelte";
  import type { CardProps } from "$lib/v1/media-surface/config-v1";

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
    onActivate?: (item: T, index: number) => void;
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
    onActivate,
    reducedMotion = false,
  }: Props = $props();

  // Svelte tweened store interpolates the integer column count over
  // time. The CSS `repeat()` track function only accepts integers, so
  // we round when handing the value off — the user sees the grid
  // resnap once per crossing instead of one giant snap, which gives
  // the slider a smoother, more "alive" feel.
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

<div class="thumb-grid" style:--col-count={displayCols}>
  {#each items as item, index (getKey(item))}
    <!--
      animate:flip is the mechanism that animates thumbnail size
      changes: when --col-count changes, every keyed cell's bounding
      rect changes, and Svelte computes the delta + applies a transform
      so the cards smoothly slide/scale to their new positions instead
      of snapping. We deliberately do NOT use in:fade for new items —
      append should feel snappy.
    -->
    <div
      animate:flip={{
        duration: reducedMotion ? 0 : dur.moderate,
        easing: ease.mechanical,
      }}
    >
      <Card
        item={item}
        index={index}
        imageLoading={index < eagerCount ? "eager" : "lazy"}
        selected={selectedIds?.has(getKey(item))}
        onToggleSelect={onToggleSelect ? () => onToggleSelect(getKey(item)) : undefined}
        onActivate={onActivate ? () => onActivate(item, index) : undefined}
        layout="grid"
      />
    </div>
  {/each}
</div>

<style>
  /*
   * Mobile column count tracks the slider but with an offset of -1 and
   * a cap so that:
   *   - the smallest slider value lands on 1 column (largest cards);
   *   - large slider values are capped to 4 mobile columns to keep
   *     thumbnails legible.
   * Tablet and desktop keep the unscaled mapping (capped at 4 on
   * tablet, uncapped on desktop) so the slider behaves the same on
   * those screens as before.
   */
  .thumb-grid {
    display: grid;
    grid-template-columns: repeat(
      max(1, min(calc(var(--col-count, 5) - 1), 4)),
      minmax(0, 1fr)
    );
    gap: 0.75rem;
    /*
     * grid-template-columns is interpolatable in modern browsers
     * (Chrome 119+, Safari 17.4+, Firefox 137+). With this transition
     * the grid track widths smoothly retarget when --col-count
     * changes, so the cards inside grow and shrink continuously
     * instead of snapping. The tweened JS store paces the value step
     * across integers; the CSS transition fills in the continuous
     * width animation between renders. Older browsers will simply
     * snap (graceful degradation).
     */
    transition: grid-template-columns 240ms cubic-bezier(0.4, 0, 0.2, 1);
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
  @media (prefers-reduced-motion: reduce) {
    .thumb-grid {
      transition: none;
    }
  }
</style>
