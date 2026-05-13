<script lang="ts">
  import { acceptPluginResult } from "$lib/v1/api/scrapers-v1";
  import type { GalleryRow, GalleryField } from "$lib/v1/identify/identify-types-v1";
  import GalleryRowCard from "./GalleryRowCardV1.svelte";
  import GalleryReviewDrawer from "./GalleryReviewDrawerV1.svelte";

  interface Props {
    rows: GalleryRow[];
    setRows: (updater: (prev: GalleryRow[]) => GalleryRow[]) => void;
    expandedIds: Set<string>;
    toggleExpanded: (id: string) => void;
    onSeekSingle?: (idx: number) => void;
    onSeekUrl?: (idx: number, url: string) => void;
    includeNsfw?: boolean;
  }

  let {
    rows,
    setRows,
    expandedIds,
    toggleExpanded,
    onSeekSingle,
    onSeekUrl,
    includeNsfw = false,
  }: Props = $props();

  let reviewingIdx = $state<number | null>(null);

  function toggleField(idx: number, field: GalleryField) {
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

{#each rows as row, idx (row.gallery.id)}
  <GalleryRowCard
    {row}
    expanded={expandedIds.has(row.gallery.id)}
    onToggleExpand={() => toggleExpanded(row.gallery.id)}
    onAccept={() => void acceptRow(idx)}
    onDismiss={() => dismissRow(idx)}
    onReview={row.status === "found" ? () => (reviewingIdx = idx) : undefined}
    onSeekSingle={onSeekSingle ? () => onSeekSingle?.(idx) : undefined}
    onSeekUrl={onSeekUrl ? (url) => onSeekUrl?.(idx, url) : undefined}
  />
{/each}

{#if reviewingIdx !== null}
  <GalleryReviewDrawer
    row={rows[reviewingIdx]}
    onClose={() => (reviewingIdx = null)}
    onToggleField={(field) => toggleField(reviewingIdx!, field)}
    onCandidateResult={(result, scrapeResultId) => {
      setRows((prev) =>
        prev.map((r, i) =>
          i === reviewingIdx
            ? { ...r, result, scrapeResultId, status: "found" }
            : r,
        ),
      );
    }}
    {includeNsfw}
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
