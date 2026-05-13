<script lang="ts">
  import { acceptPluginResult } from "$lib/v1/api/scrapers-v1";
  import type {
    VideoSeriesRow,
    VideoSeriesField,
  } from "$lib/identify/identify-types";
  import VideoSeriesRowCard from "./VideoSeriesRowCard.svelte";
  import CascadeReviewDrawer from "./CascadeReviewDrawer.svelte";

  interface Props {
    rows: VideoSeriesRow[];
    setRows: (updater: (prev: VideoSeriesRow[]) => VideoSeriesRow[]) => void;
    expandedIds: Set<string>;
    toggleExpanded: (id: string) => void;
    onSeekSingle?: (idx: number) => void;
  }

  let { rows, setRows, expandedIds, toggleExpanded, onSeekSingle }: Props = $props();

  interface ReviewState {
    idx: number;
    scrapeResultId: string;
    label: string;
    seriesId: string;
  }
  let reviewing = $state<ReviewState | null>(null);

  function toggleField(idx: number, field: VideoSeriesField) {
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
    if (!row.scrapeResultId) return;
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
    reviewing
      ? rows.findIndex((r, i) => i > reviewing!.idx && r.status === "found" && r.scrapeResultId)
      : -1,
  );
  const prevIdx = $derived(
    reviewing
      ? rows.findLastIndex(
          (r, i) => i < reviewing!.idx && r.status === "found" && r.scrapeResultId,
        )
      : -1,
  );

  function reviewingFor(idx: number): ReviewState {
    const r = rows[idx];
    return {
      idx,
      scrapeResultId: r.scrapeResultId!,
      label: r.series.displayTitle || r.series.title,
      seriesId: r.series.id,
    };
  }

  // Marks the unused toggleField helper as used for future expansion.
  void toggleField;
</script>

{#each rows as row, idx (row.series.id)}
  <VideoSeriesRowCard
    {row}
    expanded={expandedIds.has(row.series.id)}
    onToggleExpand={() => toggleExpanded(row.series.id)}
    onAccept={() => void acceptRow(idx)}
    onDismiss={() => dismissRow(idx)}
    onReview={row.scrapeResultId ? () => (reviewing = reviewingFor(idx)) : undefined}
    onSeekSingle={onSeekSingle ? () => onSeekSingle?.(idx) : undefined}
  />
{/each}

{#if reviewing}
  <CascadeReviewDrawer
    scrapeResultId={reviewing.scrapeResultId}
    entityKind="video_series"
    entityId={reviewing.seriesId}
    label={reviewing.label}
    onAccepted={() => {
      const current = reviewing!;
      setRows((prev) =>
        prev.map((r, i) => (i === current.idx ? { ...r, status: "accepted" } : r)),
      );
      reviewing = null;
    }}
    onClose={() => (reviewing = null)}
    onNext={nextIdx !== -1 ? () => (reviewing = reviewingFor(nextIdx)) : undefined}
    onPrev={prevIdx !== -1 ? () => (reviewing = reviewingFor(prevIdx)) : undefined}
    hasNext={nextIdx !== -1}
    hasPrev={prevIdx !== -1}
    onAcceptAndNext={() => {
      const current = reviewing!;
      setRows((prev) =>
        prev.map((r, i) => (i === current.idx ? { ...r, status: "accepted" } : r)),
      );
      if (nextIdx !== -1) reviewing = reviewingFor(nextIdx);
      else reviewing = null;
    }}
  />
{/if}
