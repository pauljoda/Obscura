<script lang="ts">
  import type { TagRow } from "$lib/identify/scrape-types";
  import { acceptTagRow, rejectTagRow } from "$lib/identify/scrape-tags-runner";
  import TagRowCard from "./TagRowCard.svelte";

  interface Props {
    tagRows: TagRow[];
    setTagRows: (updater: (prev: TagRow[]) => TagRow[]) => void;
    expandedIds: Set<string>;
    toggleExpanded: (id: string) => void;
  }

  let { tagRows, setTagRows, expandedIds, toggleExpanded }: Props = $props();

  function toggleTagField(idx: number, field: string) {
    setTagRows((prev) =>
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

{#each tagRows as row, idx (row.tag.id)}
  <TagRowCard
    {row}
    expanded={expandedIds.has(row.tag.id)}
    onToggleExpand={() => toggleExpanded(row.tag.id)}
    onAccept={() => void acceptTagRow(tagRows, idx, setTagRows)}
    onReject={() => rejectTagRow(idx, setTagRows)}
    onToggleField={(field) => toggleTagField(idx, field)}
  />
{/each}
