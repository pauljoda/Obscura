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
    { id: "h264", label: "H.264" },
    { id: "hevc", label: "HEVC" },
    { id: "av1", label: "AV1" },
    { id: "vp9", label: "VP9" },
    { id: "vp8", label: "VP8" },
    { id: "mpeg4", label: "MPEG-4" },
    { id: "prores", label: "ProRes" },
    { id: "wmv", label: "WMV" },
  ];
</script>

<FilterSection title="Codec">
  {#snippet children()}
    <div class="flex flex-wrap gap-1">
      {#each choices as c (c.id)}
        <button
          type="button"
          onclick={() => onAddFilter("codec", "Codec", c.id)}
          class={cn(
            "tag-chip cursor-pointer transition-colors duration-fast",
            panelFilters.some((f) => f.type === "codec" && f.value === c.id)
              ? "tag-chip-accent"
              : "tag-chip-default hover:tag-chip-accent",
          )}
        >
          {c.label}
        </button>
      {/each}
    </div>
  {/snippet}
</FilterSection>
