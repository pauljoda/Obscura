<script lang="ts">
  import type { Component } from "svelte";
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    icon?: Component<Record<string, unknown>>;
    children: Snippet;
  }

  let { title, icon: Icon, children }: Props = $props();
</script>

<div>
  <div class="flex items-center gap-1.5 text-kicker mb-2">
    {#if Icon}
      <Icon class="h-3 w-3 text-text-disabled" />
    {/if}
    {title}
  </div>
  {@render children()}
</div>
