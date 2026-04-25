<script lang="ts">
  import { cn } from "@obscura/ui-svelte";
  import FilterSection from "../FilterSection.svelte";
  import type { SectionAddFilter, SectionPanelFilter } from "./types.ts";

  interface Props {
    panelFilters: SectionPanelFilter[];
    onAddFilter: SectionAddFilter;
  }

  let { panelFilters, onAddFilter }: Props = $props();

  const stars = [1, 2, 3, 4, 5];
</script>

<FilterSection title="Rating">
  {#snippet children()}
    <div class="space-y-2">
      <div class="text-[0.6rem] font-mono uppercase tracking-wider text-text-disabled">
        At least
      </div>
      <div class="flex flex-wrap gap-1">
        {#each stars as n (n)}
          <button
            type="button"
            onclick={() => onAddFilter("ratingMin", "Min rating", String(n))}
            class={cn(
              "tag-chip cursor-pointer transition-colors duration-fast",
              panelFilters.some((f) => f.type === "ratingMin" && f.value === String(n))
                ? "tag-chip-accent"
                : "tag-chip-default hover:tag-chip-accent",
            )}
          >
            {n}★+
          </button>
        {/each}
      </div>
      <div class="text-[0.6rem] font-mono uppercase tracking-wider text-text-disabled">
        At most
      </div>
      <div class="flex flex-wrap gap-1">
        {#each stars as n (n)}
          <button
            type="button"
            onclick={() => onAddFilter("ratingMax", "Max rating", String(n))}
            class={cn(
              "tag-chip cursor-pointer transition-colors duration-fast",
              panelFilters.some((f) => f.type === "ratingMax" && f.value === String(n))
                ? "tag-chip-accent"
                : "tag-chip-default hover:tag-chip-accent",
            )}
          >
            ≤{n}★
          </button>
        {/each}
      </div>
    </div>
  {/snippet}
</FilterSection>
