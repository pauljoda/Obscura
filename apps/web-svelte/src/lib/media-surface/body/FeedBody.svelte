<script lang="ts" generics="T extends { id: string }">
  import type { Component } from "svelte";
  import type { CardProps } from "$lib/media-surface/config";

  interface Props {
    items: T[];
    card: Component<CardProps<T>>;
    getKey?: (item: T) => string;
    onActivate?: (item: T, index: number) => void;
    /** Kept for prop-contract compatibility; feed now renders directly. */
    reducedMotion?: boolean;
  }

  let {
    items,
    card: Card,
    getKey = (item) => item.id,
    onActivate,
  }: Props = $props();
</script>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-4">
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
