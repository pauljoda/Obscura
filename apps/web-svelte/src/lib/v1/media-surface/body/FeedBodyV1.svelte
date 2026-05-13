<script lang="ts" generics="T extends { id: string }">
  import type { Component } from "svelte";
  import type { CardProps } from "$lib/v1/media-surface/config-v1";

  interface Props {
    items: T[];
    cols: number;
    card: Component<CardProps<T>>;
    getKey?: (item: T) => string;
    onActivate?: (item: T, index: number) => void;
    /** Kept for prop-contract compatibility; feed now renders directly. */
    reducedMotion?: boolean;
  }

  let {
    items,
    cols,
    card: Card,
    getKey = (item) => item.id,
    onActivate,
  }: Props = $props();
</script>

<div
  class="feed-list mx-auto flex w-full flex-col gap-4"
  data-media-feed
  style:--feed-cols={cols}
>
  {#each items as item, index (getKey(item))}
    <Card
      item={item}
      index={index}
      imageLoading={index < 3 ? "eager" : "lazy"}
      onActivate={onActivate ? () => onActivate(item, index) : undefined}
      layout="feed"
    />
  {/each}
</div>

<style>
  .feed-list {
    /*
     * The shared thumbnail slider stores a column count: low values mean
     * larger cards, high values mean denser/smaller cards. Feed is a
     * single column, so map that same value onto the readable column width.
     */
    max-width: clamp(26rem, calc(86rem - (var(--feed-cols, 8) * 4rem)), 74rem);
    transition: max-width 240ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  @media (max-width: 640px) {
    .feed-list {
      max-width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .feed-list {
      transition: none;
    }
  }
</style>
