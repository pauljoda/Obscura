<script lang="ts">
  import { dur, ease, scaleChip } from "@obscura/ui-svelte";
  import { flip } from "svelte/animate";
  import FilterChip from "./FilterChipV1.svelte";

  interface DisplayFilter {
    label: string;
    value: string;
    type?: string;
  }

  interface Props {
    filters: DisplayFilter[];
    onRemove: (index: number) => void;
    /** Visual variant: inline strip (with left border + padding) or mobile scroll row. */
    variant?: "inline" | "scroll";
  }

  let { filters, onRemove, variant = "inline" }: Props = $props();
</script>

{#if filters.length > 0}
  {#if variant === "inline"}
    <div class="hidden sm:flex items-center gap-1.5 border-l border-border-subtle pl-2">
      {#each filters as filter, i (filter.type + ":" + filter.value)}
        <span
          class="inline-flex"
          animate:flip={{ duration: dur.fast, easing: ease.mechanical }}
          in:scaleChip
          out:scaleChip
        >
          <FilterChip
            label={filter.label}
            value={filter.value}
            onRemove={() => onRemove(i)}
          />
        </span>
      {/each}
    </div>
  {:else}
    <div class="flex sm:hidden items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-hidden">
      {#each filters as filter, i (filter.type + ":" + filter.value)}
        <span
          class="inline-flex"
          animate:flip={{ duration: dur.fast, easing: ease.mechanical }}
          in:scaleChip
          out:scaleChip
        >
          <FilterChip
            label={filter.label}
            value={filter.value}
            onRemove={() => onRemove(i)}
          />
        </span>
      {/each}
    </div>
  {/if}
{/if}
