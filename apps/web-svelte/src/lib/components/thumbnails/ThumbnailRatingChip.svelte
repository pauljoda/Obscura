<script lang="ts">
  import { Star } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";

  interface Props {
    rating?: number | null;
    class?: string;
  }

  let { rating = null, class: className }: Props = $props();

  const stars = $derived(rating != null && rating > 0 ? Math.round(rating / 20) : 0);
</script>

{#if stars > 0}
  <span
    class={cn(
      "pointer-events-none z-[25] inline-flex items-center gap-0.5 border border-accent-500/40 bg-black/75 px-1.5 py-0.5 font-mono text-[0.58rem] font-semibold text-accent-100 shadow-[0_0_10px_rgba(196,154,90,0.22)] backdrop-blur-sm",
      className,
    )}
    title={`${stars} star${stars === 1 ? "" : "s"}`}
  >
    <Star class="h-2.5 w-2.5 fill-current text-accent-400" />
    {stars}
  </span>
{/if}
