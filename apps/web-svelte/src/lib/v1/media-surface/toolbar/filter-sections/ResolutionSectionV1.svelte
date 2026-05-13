<script lang="ts">
  import { cn } from "@obscura/ui-svelte";
  import FilterSection from "../FilterSectionV1.svelte";
  import type { SectionAddFilter, SectionPanelFilter } from "./types-v1.ts";

  interface Props {
    panelFilters: SectionPanelFilter[];
    onAddFilter: SectionAddFilter;
  }

  let { panelFilters, onAddFilter }: Props = $props();

  const choices = ["4K", "1080p", "720p", "480p"];
</script>

<FilterSection title="Resolution">
  {#snippet children()}
    <div class="flex flex-wrap gap-1">
      {#each choices as res (res)}
        <button
          type="button"
          onclick={() => onAddFilter("resolution", "Resolution", res)}
          class={cn(
            "tag-chip cursor-pointer transition-colors duration-fast",
            panelFilters.some((f) => f.type === "resolution" && f.value === res)
              ? "tag-chip-accent"
              : "tag-chip-default hover:tag-chip-accent",
          )}
        >
          {res}
        </button>
      {/each}
    </div>
  {/snippet}
</FilterSection>
