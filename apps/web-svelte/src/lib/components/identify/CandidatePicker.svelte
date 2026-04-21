<script lang="ts">
  import { Loader2 } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type { NormalizedSeriesCandidate } from "@obscura/contracts";

  interface Props {
    candidates: NormalizedSeriesCandidate[];
    picked: string | null;
    rerunning: boolean;
    onPick: (externalId: string) => void;
  }

  let { candidates, picked, rerunning, onPick }: Props = $props();

  function candidateId(c: NormalizedSeriesCandidate): string {
    return c.externalIds.tmdb ?? Object.values(c.externalIds)[0] ?? c.title + (c.year ?? "");
  }
</script>

<div class="border-b border-border-accent/30 bg-surface-2/40 p-4">
  <div
    class="mb-2 flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.14em] text-text-muted"
  >
    Multiple matches — pick one
    {#if rerunning}
      <span class="flex items-center gap-1 text-text-accent">
        <Loader2 class="h-3 w-3 animate-spin" /> refetching…
      </span>
    {/if}
  </div>
  <div class="grid grid-cols-2 gap-2 md:grid-cols-3">
    {#each candidates as c (candidateId(c))}
      {@const id = candidateId(c)}
      {@const isPicked = id === picked}
      <button
        type="button"
        onclick={() => onPick(id)}
        disabled={rerunning}
        class={cn(
          "surface-card no-lift flex gap-2 p-2 text-left transition-colors",
          isPicked && "border-border-accent",
          rerunning && "opacity-50 cursor-not-allowed",
        )}
      >
        {#if c.posterUrl}
          <img
            src={c.posterUrl}
            alt=""
            loading="lazy"
            class="h-16 w-12 flex-shrink-0 object-cover"
          />
        {/if}
        <div class="min-w-0 flex-1 space-y-0.5">
          <div class="truncate text-[0.72rem] font-medium">{c.title}</div>
          {#if c.year}
            <div class="text-[0.6rem] text-text-muted">{c.year}</div>
          {/if}
          {#if c.overview}
            <div class="line-clamp-2 text-[0.6rem] text-text-muted">{c.overview}</div>
          {/if}
        </div>
      </button>
    {/each}
  </div>
</div>
