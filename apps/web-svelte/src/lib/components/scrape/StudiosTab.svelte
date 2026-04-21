<script lang="ts">
  import type { StudioRow } from "$lib/identify/scrape-types";
  import {
    acceptStudioRow,
    rejectStudioRow,
  } from "$lib/identify/scrape-studios-runner";
  import StudioRowCard from "./StudioRowCard.svelte";

  interface Props {
    studioRows: StudioRow[];
    setStudioRows: (updater: (prev: StudioRow[]) => StudioRow[]) => void;
    expandedIds: Set<string>;
    toggleExpanded: (id: string) => void;
  }

  let { studioRows, setStudioRows, expandedIds, toggleExpanded }: Props = $props();

  function toggleStudioField(idx: number, field: string) {
    setStudioRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.selectedFields);
        if (next.has(field)) next.delete(field);
        else next.add(field);
        return { ...r, selectedFields: next };
      }),
    );
  }
</script>

{#each studioRows as row, idx (row.studio.id)}
  <StudioRowCard
    {row}
    expanded={expandedIds.has(row.studio.id)}
    onToggleExpand={() => toggleExpanded(row.studio.id)}
    onAccept={() => void acceptStudioRow(studioRows, idx, setStudioRows)}
    onReject={() => rejectStudioRow(idx, setStudioRows)}
    onToggleField={(field) => toggleStudioField(idx, field)}
  />
{/each}
