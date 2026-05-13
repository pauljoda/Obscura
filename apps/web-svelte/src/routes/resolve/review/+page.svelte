<script lang="ts">
  import { invalidate } from "$app/navigation";
  import {
    Check,
    X,
    GitCompareArrows,
    RefreshCw,
    Plus,
    Eye,
  } from "@lucide/svelte";
  import { Badge, Button, cn } from "@obscura/ui-svelte";
  import {
    fetchAllScrapeResults,
    acceptScrapeResult,
    rejectScrapeResult,
  } from "$lib/v1/api/scrapers-v1";
  import type { ScrapeResult } from "$lib/v1/api/types-v1";
  import { entityTerms } from "$lib/terminology";
  import CascadeReviewDrawer from "$lib/v1/components/identify/CascadeReviewDrawerV1.svelte";
  import LegacyVideoReviewDrawer from "$lib/v1/components/identify/LegacyVideoReviewDrawerV1.svelte";

  let { data } = $props();
  let results = $state.raw<ScrapeResult[]>([]);
  let processingId = $state<string | null>(null);
  let message = $state<string | null>(null);
  let refreshing = $state(false);
  let syncedInitialResults: ScrapeResult[] | null = $state(null);
  let reviewingResult = $state<ScrapeResult | null>(null);

  $effect(() => {
    if (syncedInitialResults !== data.initialResults) {
      results = data.initialResults;
      syncedInitialResults = data.initialResults;
    }
  });

  async function loadResults() {
    refreshing = true;
    try {
      const res = await fetchAllScrapeResults({ status: "pending" });
      results = res.results;
      await invalidate("scrape-results:pending");
    } finally {
      refreshing = false;
    }
  }

  async function handleReject(result: ScrapeResult) {
    processingId = result.id;
    try {
      await rejectScrapeResult(result.id);
      results = results.filter((r) => r.id !== result.id);
    } catch (err) {
      message = err instanceof Error ? err.message : "Failed to reject";
    } finally {
      processingId = null;
    }
  }

  function handleReviewedAccepted(result: ScrapeResult) {
    results = results.filter((r) => r.id !== result.id);
    reviewingResult = null;
    message = "Metadata applied successfully.";
  }

  function handleReviewedRejected(result: ScrapeResult) {
    results = results.filter((r) => r.id !== result.id);
    reviewingResult = null;
    message = "Result rejected.";
  }

  async function handleAcceptAll() {
    message = null;
    const applied: string[] = [];
    const failed: string[] = [];
    for (const result of results) {
      try {
        await acceptScrapeResult(result.id);
        applied.push(result.id);
      } catch {
        failed.push(result.id);
      }
    }
    results = results.filter((r) => !applied.includes(r.id));
    message =
      failed.length > 0
        ? `Applied ${applied.length} result(s). ${failed.length} failed.`
        : `Applied ${applied.length} result(s).`;
  }

  function typedVideoEntityKind(
    result: ScrapeResult,
  ): "video_series" | "video_movie" | "video_episode" | null {
    if (!result.proposedResult) return null;
    if (result.entityType === "video_series") return "video_series";
    if (result.entityType === "video_movie") return "video_movie";
    if (result.entityType === "video_episode") return "video_episode";
    return null;
  }

  function resultLabel(result: ScrapeResult) {
    return (
      result.proposedTitle ??
      `${result.entityType.replace(/_/g, " ")} ${(result.entityId ?? result.id).slice(0, 8)}`
    );
  }
</script>

<svelte:head>
  <title>Review — Obscura</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h1>Review</h1>
      <p class="mt-1 text-text-muted text-sm">
        Review and apply pending scrape results
      </p>
    </div>
    <div class="flex items-center gap-2">
      <Badge variant="accent">{#snippet children()}{results.length} pending{/snippet}</Badge>
      <Button variant="secondary" size="sm" onclick={() => void loadResults()} disabled={refreshing}>
        {#snippet children()}
          <RefreshCw class={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        {/snippet}
      </Button>
      {#if results.length > 0}
        <Button variant="primary" size="sm" onclick={() => void handleAcceptAll()}>
          {#snippet children()}
            <Check class="h-3.5 w-3.5" />
            Accept All
          {/snippet}
        </Button>
      {/if}
    </div>
  </div>

  {#if message}
    <div class="surface-panel border border-border-accent p-3 text-text-secondary text-sm">
      {message}
    </div>
  {/if}

  {#if results.length === 0}
    <div class="surface-well flex flex-col items-center justify-center py-16">
      <GitCompareArrows class="h-12 w-12 text-text-disabled mb-3" />
      <p class="text-text-muted text-sm">No pending results to review.</p>
      <p class="text-text-disabled text-xs mt-1">
        Scrape {entityTerms.videos.toLowerCase()} from the
        <a href="/resolve" class="text-text-accent hover:underline">Resolve queue</a>
        to generate results.
      </p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each results as result (result.id)}
        <div class="surface-panel p-5 space-y-4">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-xs text-text-disabled">
                {entityTerms.video} {(result.entityId ?? "").slice(0, 8)}... · {result.action}
              </p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onclick={() => void handleReject(result)}
                disabled={processingId === result.id}
              >
                {#snippet children()}
                  <X class="h-3.5 w-3.5" />
                  Reject
                {/snippet}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onclick={() => (reviewingResult = result)}
                disabled={processingId === result.id}
              >
                {#snippet children()}
                  <Eye class="h-3.5 w-3.5" />
                  Review
                {/snippet}
              </Button>
            </div>
          </div>

          <div class="surface-well p-3 space-y-0">
            {#if result.proposedTitle}
              <div class="flex items-center gap-3 py-2.5">
                <span class="flex h-5 w-5 items-center justify-center bg-success-muted/30 text-success-text">
                  <Plus class="h-3 w-3" />
                </span>
                <span class="text-label text-text-muted w-24">Title</span>
                <span class="text-mono-sm text-success-text">{result.proposedTitle}</span>
              </div>
            {/if}
            {#if result.proposedDate}
              <div class="separator"></div>
              <div class="flex items-center gap-3 py-2.5">
                <span class="flex h-5 w-5 items-center justify-center bg-success-muted/30 text-success-text">
                  <Plus class="h-3 w-3" />
                </span>
                <span class="text-label text-text-muted w-24">Date</span>
                <span class="text-mono-sm text-success-text">{result.proposedDate}</span>
              </div>
            {/if}
            {#if result.proposedStudioName}
              <div class="separator"></div>
              <div class="flex items-center gap-3 py-2.5">
                <span class="flex h-5 w-5 items-center justify-center bg-success-muted/30 text-success-text">
                  <Plus class="h-3 w-3" />
                </span>
                <span class="text-label text-text-muted w-24">Studio</span>
                <span class="text-mono-sm text-success-text">{result.proposedStudioName}</span>
              </div>
            {/if}
            {#if result.proposedPerformerNames && result.proposedPerformerNames.length > 0}
              <div class="separator"></div>
              <div class="flex items-center gap-3 py-2.5">
                <span class="flex h-5 w-5 items-center justify-center bg-success-muted/30 text-success-text">
                  <Plus class="h-3 w-3" />
                </span>
                <span class="text-label text-text-muted w-24">{entityTerms.performers}</span>
                <span class="text-mono-sm text-success-text">{result.proposedPerformerNames.join(", ")}</span>
              </div>
            {/if}
            {#if result.proposedTagNames && result.proposedTagNames.length > 0}
              <div class="separator"></div>
              <div class="flex items-center gap-3 py-2.5">
                <span class="flex h-5 w-5 items-center justify-center bg-success-muted/30 text-success-text">
                  <Plus class="h-3 w-3" />
                </span>
                <span class="text-label text-text-muted w-24">Tags</span>
                <span class="text-mono-sm text-success-text">{result.proposedTagNames.join(", ")}</span>
              </div>
            {/if}
            {#if result.proposedUrl}
              <div class="separator"></div>
              <div class="flex items-center gap-3 py-2.5">
                <span class="flex h-5 w-5 items-center justify-center bg-success-muted/30 text-success-text">
                  <Plus class="h-3 w-3" />
                </span>
                <span class="text-label text-text-muted w-24">URL</span>
                <span class="text-mono-sm text-success-text">{result.proposedUrl}</span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if reviewingResult}
  {@const typedKind = typedVideoEntityKind(reviewingResult)}
  {#if typedKind && reviewingResult.entityId}
    <CascadeReviewDrawer
      scrapeResultId={reviewingResult.id}
      entityKind={typedKind}
      entityId={reviewingResult.entityId}
      label={resultLabel(reviewingResult)}
      onAccepted={() => handleReviewedAccepted(reviewingResult!)}
      onClose={() => (reviewingResult = null)}
    />
  {:else}
    <LegacyVideoReviewDrawer
      result={reviewingResult}
      matchedScraper={resultLabel(reviewingResult)}
      onAccepted={() => handleReviewedAccepted(reviewingResult!)}
      onRejected={() => handleReviewedRejected(reviewingResult!)}
      onClose={() => (reviewingResult = null)}
    />
  {/if}
{/if}
