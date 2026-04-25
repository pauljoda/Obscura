<script lang="ts" generics="T extends { id: string }">
  import { dur, ease } from "@obscura/ui-svelte";
  import { fade } from "svelte/transition";
  import { flip } from "svelte/animate";
  import type { Component } from "svelte";
  import type { CardProps } from "$lib/media-surface/config";

  interface Props {
    items: T[];
    card: Component<CardProps<T>>;
    getKey?: (item: T) => string;
    selectedIds?: Set<string>;
    onToggleSelect?: (id: string) => void;
    reducedMotion?: boolean;
  }

  let {
    items,
    card: Card,
    getKey = (item) => item.id,
    selectedIds,
    onToggleSelect,
    reducedMotion = false,
  }: Props = $props();
</script>

<div class="flex flex-col gap-2">
  {#each items as item, index (getKey(item))}
    <div
      animate:flip={{
        duration: reducedMotion ? 0 : dur.moderate,
        easing: ease.mechanical,
      }}
      in:fade|global={{
        duration: reducedMotion ? 0 : dur.normal,
        delay: reducedMotion ? 0 : Math.min(index * 8, 100),
        easing: ease.enter,
      }}
    >
      <Card
        item={item}
        index={index}
        imageLoading={index < 8 ? "eager" : "lazy"}
        selected={selectedIds?.has(getKey(item))}
        onToggleSelect={onToggleSelect ? () => onToggleSelect(getKey(item)) : undefined}
        layout="list"
      />
    </div>
  {/each}
</div>
