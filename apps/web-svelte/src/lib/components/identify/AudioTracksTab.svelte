<script lang="ts">
  import { acceptPluginResult } from "$lib/api/scrapers";
  import type {
    AudioTrackRow,
    AudioTrackField,
  } from "$lib/identify/identify-types";
  import AudioTrackRowCard from "./AudioTrackRowCard.svelte";
  import AudioTrackReviewDrawer from "./AudioTrackReviewDrawer.svelte";

  interface Props {
    rows: AudioTrackRow[];
    setRows: (updater: (prev: AudioTrackRow[]) => AudioTrackRow[]) => void;
    expandedIds: Set<string>;
    toggleExpanded: (id: string) => void;
    onSeekSingle?: (idx: number) => void;
  }

  let { rows, setRows, expandedIds, toggleExpanded, onSeekSingle }: Props = $props();

  let reviewingIdx = $state<number | null>(null);

  function toggleField(idx: number, field: AudioTrackField) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.selectedFields);
        if (next.has(field)) next.delete(field);
        else next.add(field);
        return { ...r, selectedFields: next };
      }),
    );
  }

  async function acceptRow(idx: number) {
    const row = rows[idx];
    if (!row?.scrapeResultId) return;
    try {
      await acceptPluginResult(row.scrapeResultId, Array.from(row.selectedFields));
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r)),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Accept failed";
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "error", error: message } : r)),
      );
    }
  }

  function dismissRow(idx: number) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              status: "pending",
              result: undefined,
              scrapeResultId: undefined,
              matchedProvider: undefined,
              error: undefined,
            }
          : r,
      ),
    );
  }

  const nextIdx = $derived(
    reviewingIdx !== null
      ? rows.findIndex((r, i) => i > reviewingIdx! && r.status === "found")
      : -1,
  );
  const prevIdx = $derived(
    reviewingIdx !== null
      ? rows.findLastIndex((r, i) => i < reviewingIdx! && r.status === "found")
      : -1,
  );
</script>

{#each rows as row, idx (row.track.id)}
  <AudioTrackRowCard
    {row}
    expanded={expandedIds.has(row.track.id)}
    onToggleExpand={() => toggleExpanded(row.track.id)}
    onAccept={() => void acceptRow(idx)}
    onDismiss={() => dismissRow(idx)}
    onReview={row.status === "found" ? () => (reviewingIdx = idx) : undefined}
    onSeekSingle={onSeekSingle ? () => onSeekSingle?.(idx) : undefined}
  />
{/each}

{#if reviewingIdx !== null}
  <AudioTrackReviewDrawer
    row={rows[reviewingIdx]}
    onClose={() => (reviewingIdx = null)}
    onToggleField={(field) => toggleField(reviewingIdx!, field)}
    onAccept={async () => {
      await acceptRow(reviewingIdx!);
      reviewingIdx = null;
    }}
    onNext={nextIdx !== -1 ? () => (reviewingIdx = nextIdx) : undefined}
    onPrev={prevIdx !== -1 ? () => (reviewingIdx = prevIdx) : undefined}
    hasNext={nextIdx !== -1}
    hasPrev={prevIdx !== -1}
    onAcceptAndNext={async () => {
      await acceptRow(reviewingIdx!);
      if (nextIdx !== -1) reviewingIdx = nextIdx;
      else reviewingIdx = null;
    }}
  />
{/if}
