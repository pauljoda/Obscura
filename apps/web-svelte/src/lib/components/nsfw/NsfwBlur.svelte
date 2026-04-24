<script lang="ts">
  import type { Snippet } from "svelte";
  import { useNsfw } from "$lib/nsfw/store.svelte";

  interface Props {
    isNsfw: boolean;
    class?: string;
    children: Snippet;
  }

  let { isNsfw, class: className, children }: Props = $props();
  const nsfw = useNsfw();
</script>

{#if !isNsfw || nsfw.mode === "show"}
  <div class={className}>{@render children()}</div>
{:else if nsfw.mode === "blur"}
  <div class="group relative {className ?? ''}">
    <div
      class="min-h-0 min-w-0 h-full w-full blur-sm brightness-50 transition-all duration-300 group-hover:blur-none group-hover:brightness-100"
    >
      {@render children()}
    </div>
    <div
      class="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity duration-300 pointer-events-none"
    >
      <span
        class="inline-flex items-center border-2 border-error bg-error-muted/95 px-2.5 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-widest text-error-text"
        style:text-shadow="0 0 12px rgba(204,120,128,0.55),0 0 4px rgba(168,72,80,0.4)"
        style:box-shadow="0 0 18px rgba(168,72,80,0.55),0 0 6px rgba(204,120,128,0.35)"
      >
        NSFW
      </span>
    </div>
  </div>
{/if}
