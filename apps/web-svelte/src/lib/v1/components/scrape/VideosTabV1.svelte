<script lang="ts">
  import type { VideoRow, VideoField } from "$lib/v1/identify/scrape-types-v1";
  import {
    acceptVideoRow,
    rejectVideoRow,
  } from "$lib/v1/identify/scrape-videos-runner-v1";
  import VideoRowCard from "./VideoRowCardV1.svelte";
  import VideoReviewDrawer from "./VideoReviewDrawerV1.svelte";

  interface Props {
    videoRows: VideoRow[];
    setVideoRows: (updater: (prev: VideoRow[]) => VideoRow[]) => void;
    expandedIds: Set<string>;
    toggleExpanded: (id: string) => void;
    onSeekSingle?: (idx: number) => void;
  }

  let {
    videoRows,
    setVideoRows,
    expandedIds,
    toggleExpanded,
    onSeekSingle,
  }: Props = $props();

  let reviewingIdx = $state<number | null>(null);

  function toggleVideoField(idx: number, field: VideoField) {
    setVideoRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.selectedFields);
        if (next.has(field)) next.delete(field);
        else next.add(field);
        return { ...r, selectedFields: next };
      }),
    );
  }

  function toggleVideoExcludePerformer(idx: number, name: string) {
    setVideoRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.excludedPerformers);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return { ...r, excludedPerformers: next };
      }),
    );
  }

  function toggleVideoExcludeTag(idx: number, name: string) {
    setVideoRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.excludedTags);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return { ...r, excludedTags: next };
      }),
    );
  }

  function dismissRow(idx: number) {
    setVideoRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              status: "pending",
              result: undefined,
              normalized: undefined,
              matchedScraper: undefined,
              error: undefined,
            }
          : r,
      ),
    );
  }

  const nextIdx = $derived(
    reviewingIdx !== null
      ? videoRows.findIndex((r, i) => i > reviewingIdx! && r.status === "found")
      : -1,
  );
  const prevIdx = $derived(
    reviewingIdx !== null
      ? videoRows.findLastIndex((r, i) => i < reviewingIdx! && r.status === "found")
      : -1,
  );
</script>

{#each videoRows as row, idx (row.video.id)}
  <VideoRowCard
    {row}
    expanded={expandedIds.has(row.video.id)}
    onToggleExpand={() => toggleExpanded(row.video.id)}
    onAccept={() => void acceptVideoRow(videoRows, idx, setVideoRows)}
    onDismiss={() => dismissRow(idx)}
    onReview={row.status === "found" ? () => (reviewingIdx = idx) : undefined}
    onSeekSingle={onSeekSingle ? () => onSeekSingle?.(idx) : undefined}
  />
{/each}

{#if reviewingIdx !== null}
  <VideoReviewDrawer
    row={videoRows[reviewingIdx]}
    onClose={() => (reviewingIdx = null)}
    onToggleField={(field) => toggleVideoField(reviewingIdx!, field)}
    onTogglePerformer={(name) => toggleVideoExcludePerformer(reviewingIdx!, name)}
    onToggleTag={(name) => toggleVideoExcludeTag(reviewingIdx!, name)}
    onAccept={async () => {
      await acceptVideoRow(videoRows, reviewingIdx!, setVideoRows);
      reviewingIdx = null;
    }}
    onNext={nextIdx !== -1 ? () => (reviewingIdx = nextIdx) : undefined}
    onPrev={prevIdx !== -1 ? () => (reviewingIdx = prevIdx) : undefined}
    hasNext={nextIdx !== -1}
    hasPrev={prevIdx !== -1}
    onAcceptAndNext={async () => {
      await acceptVideoRow(videoRows, reviewingIdx!, setVideoRows);
      if (nextIdx !== -1) reviewingIdx = nextIdx;
      else reviewingIdx = null;
    }}
  />
{/if}
{void rejectVideoRow}
