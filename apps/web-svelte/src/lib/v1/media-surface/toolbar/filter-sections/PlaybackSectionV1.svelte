<script lang="ts">
  import { cn } from "@obscura/ui-svelte";
  import FilterSection from "../FilterSectionV1.svelte";
  import type { SectionAddFilter, SectionPanelFilter } from "./types-v1.ts";

  interface Props {
    panelFilters: SectionPanelFilter[];
    onAddFilter: SectionAddFilter;
  }

  let { panelFilters, onAddFilter }: Props = $props();

  const choices = [
    { type: "played", value: "true", label: "Played", chipLabel: "Playback" },
    { type: "played", value: "false", label: "Unplayed", chipLabel: "Playback" },
    { type: "hasFile", value: "true", label: "Has file", chipLabel: "File" },
    { type: "hasFile", value: "false", label: "No file", chipLabel: "File" },
  ];
</script>

<FilterSection title="Playback & file">
  {#snippet children()}
    <div class="flex flex-wrap gap-1">
      {#each choices as item (`${item.type}-${item.value}`)}
        <button
          type="button"
          onclick={() => onAddFilter(item.type, item.chipLabel, item.value)}
          class={cn(
            "tag-chip cursor-pointer transition-colors duration-fast",
            panelFilters.some((f) => f.type === item.type && f.value === item.value)
              ? "tag-chip-accent"
              : "tag-chip-default hover:tag-chip-accent",
          )}
        >
          {item.label}
        </button>
      {/each}
    </div>
  {/snippet}
</FilterSection>
