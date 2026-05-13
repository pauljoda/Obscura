<script lang="ts">
  import { Loader2 } from "@lucide/svelte";

  interface Props {
    status: string;
  }

  let { status }: Props = $props();
</script>

<div class="flex-shrink-0 w-4">
  {#if status === "scraping"}
    <Loader2 class="h-3.5 w-3.5 animate-spin text-text-accent" />
  {:else if status === "found"}
    <div class="led led-active"></div>
  {:else if status === "accepted"}
    <div class="led led-accent"></div>
  {:else}
    <div class="led led-idle"></div>
  {/if}
</div>
