<script lang="ts">
  import type { PerformerRow } from "$lib/identify/scrape-types";
  import {
    acceptPerformerRow,
    rejectPerformerRow,
  } from "$lib/identify/scrape-performers-runner";
  import PerformerRowCard from "./PerformerRowCard.svelte";

  interface Props {
    perfRows: PerformerRow[];
    setPerfRows: (updater: (prev: PerformerRow[]) => PerformerRow[]) => void;
    expandedIds: Set<string>;
    toggleExpanded: (id: string) => void;
  }

  let { perfRows, setPerfRows, expandedIds, toggleExpanded }: Props = $props();

  function togglePerfField(idx: number, field: string) {
    setPerfRows((prev) =>
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

{#each perfRows as row, idx (row.performer.id)}
  <PerformerRowCard
    {row}
    expanded={expandedIds.has(row.performer.id)}
    onToggleExpand={() => toggleExpanded(row.performer.id)}
    onAccept={(imageUrl) =>
      void acceptPerformerRow(perfRows, idx, setPerfRows, imageUrl)}
    onReject={() => rejectPerformerRow(idx, setPerfRows)}
    onToggleField={(field) => togglePerfField(idx, field)}
  />
{/each}
