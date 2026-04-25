<script lang="ts">
  import type { Component } from "svelte";

  interface Props {
    icon?: Component;
    title: string;
    description?: string;
  }

  let { icon: Icon, title, description }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
  {#if Icon}
    <Icon class="h-10 w-10 text-text-muted" />
  {/if}
  <p class="text-body-lg text-text-primary">{title}</p>
  {#if description}
    <p class="max-w-md text-body-sm text-text-muted">{description}</p>
  {/if}
</div>
