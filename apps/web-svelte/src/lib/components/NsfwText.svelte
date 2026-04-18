<script lang="ts">
  import type { Snippet } from "svelte";
  import { useNsfw } from "$lib/stores/nsfw.svelte";

  interface Props {
    isNsfw: boolean;
    class?: string;
    children: Snippet;
  }

  let { isNsfw, class: className, children }: Props = $props();
  const nsfw = useNsfw();
</script>

{#if !isNsfw || nsfw.mode === "show"}
  <span class={className}>{@render children()}</span>
{:else if nsfw.mode === "blur"}
  <span
    class={`blur-sm hover:blur-none transition-all duration-300 cursor-default ${className ?? ""}`}
    title="NSFW — hover to reveal"
  >
    {@render children()}
  </span>
{/if}
