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
    reducedMotion?: boolean;
  }

  let {
    items,
    card: Card,
    getKey = (item) => item.id,
    reducedMotion = false,
  }: Props = $props();
</script>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-4">
  {#each items as item, index (getKey(item))}
    <div
      animate:flip={{
        duration: reducedMotion ? 0 : dur.moderate,
        easing: ease.mechanical,
      }}
      in:fade|global={{
        duration: reducedMotion ? 0 : dur.normal,
        delay: reducedMotion ? 0 : Math.min(index * 16, 200),
        easing: ease.enter,
      }}
    >
      <Card
        item={item}
        index={index}
        imageLoading={index < 3 ? "eager" : "lazy"}
      />
    </div>
  {/each}
</div>
