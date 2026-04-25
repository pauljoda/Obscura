<script lang="ts">
  import type {
    NormalizedScrapeResult,
    ScrapeResult,
    VideoDetail,
  } from "$lib/api/types";
  import {
    acceptScrapeResult,
    rejectScrapeResult,
  } from "$lib/api/scrapers";
  import { fetchVideoDetail } from "$lib/api/videos";
  import type { VideoField, VideoRow } from "$lib/identify/scrape-types";
  import { VIDEO_FIELDS } from "$lib/identify/scrape-types";
  import ReviewDrawer from "./ReviewDrawer.svelte";
  import VideoReviewDrawer from "../scrape/VideoReviewDrawer.svelte";

  interface Props {
    result: ScrapeResult;
    normalized?: NormalizedScrapeResult | null;
    video?: VideoDetail | null;
    matchedScraper?: string;
    onAccepted: () => void;
    onRejected?: () => void;
    onClose: () => void;
  }

  let {
    result,
    normalized,
    video = null,
    matchedScraper,
    onAccepted,
    onRejected,
    onClose,
  }: Props = $props();

  let currentVideo = $state<VideoDetail | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let selectedFields = $state<Set<VideoField>>(new Set());
  let excludedPerformers = $state<Set<string>>(new Set());
  let excludedTags = $state<Set<string>>(new Set());
  let syncedResultId = $state<string | null>(null);

  function normalizeFromResult(row: ScrapeResult): NormalizedScrapeResult {
    return {
      title: row.proposedTitle,
      date: row.proposedDate,
      details: row.proposedDetails,
      url: row.proposedUrl,
      studioName: row.proposedStudioName,
      performerNames: row.proposedPerformerNames ?? [],
      tagNames: row.proposedTagNames ?? [],
      imageUrl: row.proposedImageUrl,
    };
  }

  const normalizedResult = $derived(normalized ?? normalizeFromResult(result));

  function defaultFields(n: NormalizedScrapeResult, row: ScrapeResult): Set<VideoField> {
    const fields = new Set<VideoField>();
    if (n.title) fields.add("title");
    if (n.date) fields.add("date");
    if (n.details) fields.add("details");
    if (n.url) fields.add("url");
    if (n.studioName) fields.add("studio");
    if (n.performerNames.length > 0) fields.add("performers");
    if (n.tagNames.length > 0) fields.add("tags");
    if (n.imageUrl) fields.add("image");
    if (row.proposedEpisodeNumber != null) fields.add("episodeNumber");
    return fields.size > 0 ? fields : new Set(VIDEO_FIELDS);
  }

  $effect(() => {
    if (syncedResultId === result.id) return;
    syncedResultId = result.id;
    currentVideo = video;
    selectedFields = defaultFields(normalizedResult, result);
    excludedPerformers = new Set();
    excludedTags = new Set();
    error = null;
  });

  $effect(() => {
    const entityId = result.entityId;
    if (!entityId || currentVideo?.id === entityId) return;

    let cancelled = false;
    loading = true;
    error = null;
    fetchVideoDetail(entityId)
      .then((detail) => {
        if (!cancelled) currentVideo = detail;
      })
      .catch((err) => {
        if (!cancelled) {
          error = err instanceof Error ? err.message : "Failed to load video";
        }
      })
      .finally(() => {
        if (!cancelled) loading = false;
      });

    return () => {
      cancelled = true;
    };
  });

  const reviewRow = $derived<VideoRow | null>(
    currentVideo
      ? {
          video: currentVideo,
          status: "found",
          result,
          normalized: normalizedResult,
          matchedScraper,
          selectedFields,
          excludedPerformers,
          excludedTags,
        }
      : null,
  );

  function toggleField(field: VideoField) {
    const next = new Set(selectedFields);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    selectedFields = next;
  }

  function togglePerformer(name: string) {
    const next = new Set(excludedPerformers);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    excludedPerformers = next;
  }

  function toggleTag(name: string) {
    const next = new Set(excludedTags);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    excludedTags = next;
  }

  async function accept() {
    await acceptScrapeResult(result.id, Array.from(selectedFields), {
      excludePerformers: Array.from(excludedPerformers),
      excludeTags: Array.from(excludedTags),
    });
    onAccepted();
  }

  async function reject() {
    await rejectScrapeResult(result.id);
    onRejected?.();
  }
</script>

{#if reviewRow}
  <VideoReviewDrawer
    row={reviewRow}
    {onClose}
    onToggleField={toggleField}
    onTogglePerformer={togglePerformer}
    onToggleTag={toggleTag}
    onAccept={accept}
  />
{:else}
  <ReviewDrawer label="Review scrape" {onClose} {loading} {error}>
    {#snippet children()}
      <div class="m-5 border border-border-subtle bg-surface-2/50 px-3 py-3 text-[0.72rem] text-text-muted">
        This scrape result is not attached to a video that can be reviewed here.
      </div>
    {/snippet}
    {#snippet footer()}
      <div class="flex justify-end">
        <button
          type="button"
          onclick={() => void reject()}
          class="px-4 py-1.5 text-[0.72rem] font-medium text-text-muted hover:text-text-primary transition-colors"
        >
          Reject result
        </button>
      </div>
    {/snippet}
  </ReviewDrawer>
{/if}
