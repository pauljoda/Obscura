<script lang="ts">
  import { cn } from "@obscura/ui-svelte";
  import FilterSection from "../FilterSection.svelte";
  import type { SectionAddFilter, SectionPanelFilter } from "./types.ts";

  interface Props {
    panelFilters: SectionPanelFilter[];
    onAddFilter: SectionAddFilter;
  }

  let { panelFilters, onAddFilter }: Props = $props();

  const choices = [
    { id: "lt300", label: "< 5 min" },
    { id: "300-900", label: "5–15 min" },
    { id: "900-1800", label: "15–30 min" },
    { id: "gte1800", label: "30+ min" },
  ];
</script>

<FilterSection title="Duration">
  {#snippet children()}
    <div class="flex flex-wrap gap-1">
      {#each choices as d (d.id)}
        <button
          type="button"
          onclick={() => onAddFilter("duration", "Duration", d.id)}
          class={cn(
            "tag-chip cursor-pointer transition-colors duration-fast",
            panelFilters.some((f) => f.type === "duration" && f.value === d.id)
              ? "tag-chip-accent"
              : "tag-chip-default hover:tag-chip-accent",
          )}
        >
          {d.label}
        </button>
      {/each}
    </div>
  {/snippet}
</FilterSection>
