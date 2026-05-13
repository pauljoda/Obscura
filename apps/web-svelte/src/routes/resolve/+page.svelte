<script lang="ts">
  import { onMount } from "svelte";
  import {
    Check,
    X,
    ChevronRight,
    Plus,
    Minus,
    Search,
    Loader2,
    ScanSearch,
    ArrowRightLeft,
    ExternalLink,
    AlertTriangle,
  } from "@lucide/svelte";
  import { Badge, Button, cn } from "@obscura/ui-svelte";
  import { fetchVideos } from "$lib/api/videos";
  import {
    fetchInstalledScrapers,
    scrapeVideo,
    acceptScrapeResult,
    rejectScrapeResult,
  } from "$lib/api/scrapers";
  import type {
    VideoListItem,
    ScraperPackage,
    ScrapeResult,
    NormalizedScrapeResult,
  } from "$lib/api/types";
  import { entityTerms } from "$lib/terminology";
  import ProviderSelector from "$lib/components/ProviderSelector.svelte";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";
  import { videoListItemToCardData } from "$lib/video-card-data";

  interface ScrapeState {
    scraping: boolean;
    result: ScrapeResult | null;
    normalized: NormalizedScrapeResult | null;
    searchResults: NormalizedScrapeResult[] | null;
    error: string | null;
    triedActions?: string[];
  }

  const defaultScrapeState: ScrapeState = {
    scraping: false,
    result: null,
    normalized: null,
    searchResults: null,
    error: null,
  };

  let unmatchedVideos = $state<VideoListItem[]>([]);
  let totalUnmatched = $state(0);
  let totalVideosAvailable = $state(0);
  let loadedVideoCount = $state(0);
  let loadingMoreQueue = $state(false);
  let selectedVideoId = $state<string | null>(null);
  let scrapers = $state<ScraperPackage[]>([]);
  let selectedScraperId = $state<string | null>(null);
  let scrapeUrl = $state("");
  let scrapeState = $state<ScrapeState>(defaultScrapeState);
  let applying = $state(false);
  let loading = $state(true);
  let message = $state<string | null>(null);
  let enabledFields = $state(
    new Set(["title", "date", "details", "url", "studio", "performers", "tags"]),
  );

  const selectedVideo = $derived(
    unmatchedVideos.find((v) => v.id === selectedVideoId) ?? null,
  );

  async function loadData() {
    loading = true;
    try {
      const [videosRes, scrapersRes] = await Promise.all([
        fetchVideos({ sort: "created_at", limit: 500, offset: 0 }),
        fetchInstalledScrapers(),
      ]);
      const unorganized = videosRes.videos.filter((v) => !v.organized);
      unmatchedVideos = unorganized;
      totalUnmatched = unorganized.length;
      totalVideosAvailable = videosRes.total;
      loadedVideoCount = videosRes.videos.length;
      scrapers = scrapersRes.packages.filter((s) => s.enabled);
      if (!selectedVideoId && unorganized.length > 0) selectedVideoId = unorganized[0].id;
      if (!selectedScraperId && scrapers.length > 0) selectedScraperId = scrapers[0].id;
    } finally {
      loading = false;
    }
  }

  async function loadMoreQueue() {
    if (loadingMoreQueue || loadedVideoCount >= totalVideosAvailable) return;
    loadingMoreQueue = true;
    try {
      const res = await fetchVideos({
        sort: "created_at",
        limit: 500,
        offset: loadedVideoCount,
      });
      const unorganized = res.videos.filter((v) => !v.organized);
      if (unorganized.length === 0) return;
      const seen = new Set(unmatchedVideos.map((v) => v.id));
      const appended = unorganized.filter((v) => !seen.has(v.id));
      unmatchedVideos = [...unmatchedVideos, ...appended];
      loadedVideoCount = loadedVideoCount + res.videos.length;
      totalVideosAvailable = res.total;
    } finally {
      loadingMoreQueue = false;
    }
  }

  onMount(() => {
    void loadData();
  });

  async function handleScrape() {
    if (!selectedScraperId || !selectedVideoId) return;
    scrapeState = { ...defaultScrapeState, scraping: true };
    message = null;
    try {
      const res = await scrapeVideo(selectedScraperId, selectedVideoId, "auto", {
        url: scrapeUrl || undefined,
      });
      if (res.results) {
        scrapeState = {
          scraping: false,
          result: null,
          normalized: null,
          searchResults: res.results,
          triedActions: res.triedActions,
          error: null,
        };
      } else if (res.result && res.normalized) {
        scrapeState = {
          scraping: false,
          result: res.result,
          normalized: res.normalized,
          searchResults: null,
          triedActions: res.triedActions,
          error: null,
        };
      } else {
        scrapeState = {
          ...defaultScrapeState,
          triedActions: res.triedActions,
          error: res.message || `No results found for this ${entityTerms.video.toLowerCase()}.`,
        };
      }
    } catch (err) {
      scrapeState = {
        ...defaultScrapeState,
        error: err instanceof Error ? err.message : "Scrape failed",
      };
    }
  }

  async function handleAccept() {
    if (!scrapeState.result) return;
    applying = true;
    message = null;
    try {
      await acceptScrapeResult(scrapeState.result.id, Array.from(enabledFields));
      message = "Metadata applied successfully.";
      scrapeState = defaultScrapeState;
      unmatchedVideos = unmatchedVideos.filter((v) => v.id !== selectedVideoId);
      totalUnmatched = totalUnmatched - 1;
      selectedVideoId = unmatchedVideos[0]?.id ?? null;
    } catch (err) {
      message = err instanceof Error ? err.message : "Failed to apply";
    } finally {
      applying = false;
    }
  }

  async function handleReject() {
    if (!scrapeState.result) return;
    try {
      await rejectScrapeResult(scrapeState.result.id);
      scrapeState = defaultScrapeState;
      message = "Result rejected.";
    } catch (err) {
      message = err instanceof Error ? err.message : "Failed to reject";
    }
  }

  function toggleField(field: string) {
    const next = new Set(enabledFields);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    enabledFields = next;
  }

  interface DiffProps {
    field: string;
    current: string | null;
    proposed: string | null;
  }

  function computeDiff(d: DiffProps) {
    if (!d.proposed && !d.current) return null;
    const isAdd = !d.current && !!d.proposed;
    const isChange = !!d.current && !!d.proposed && d.current !== d.proposed;
    const isUnchanged = d.current === d.proposed;
    if (isUnchanged || !d.proposed) return null;
    return { isAdd, isChange };
  }
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

{#if loading}
  <div class="flex items-center justify-center py-20">
    <Loader2 class="h-6 w-6 animate-spin text-text-muted" />
  </div>
{:else if scrapers.length === 0}
  <div class="space-y-5">
    <div>
      <h1>Resolve</h1>
      <p class="mt-1 text-text-muted text-sm">
        Scrape and apply metadata to your {entityTerms.videos.toLowerCase()}
      </p>
    </div>
    <div class="surface-well flex flex-col items-center justify-center py-16">
      <ScanSearch class="h-12 w-12 text-text-disabled mb-3" />
      <p class="text-text-muted text-sm">No scrapers installed.</p>
      <p class="text-text-disabled text-xs mt-1">
        Install scrapers from the community index in
        <a href="/scrapers" class="text-text-accent hover:underline">Scrapers</a>
        to begin matching.
      </p>
    </div>
  </div>
{:else}
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h1>Resolve</h1>
        <p class="mt-1 text-text-muted text-sm">
          Scrape and apply metadata to your {entityTerms.videos.toLowerCase()}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <Badge variant="accent">{#snippet children()}{totalUnmatched} unmatched{/snippet}</Badge>
        {#if loadedVideoCount < totalVideosAvailable}
          <Button
            variant="secondary"
            size="sm"
            onclick={() => void loadMoreQueue()}
            disabled={loadingMoreQueue}
          >
            {#snippet children()}
              {#if loadingMoreQueue}<Loader2 class="h-3.5 w-3.5 animate-spin" />{/if}
              Load More Queue
            {/snippet}
          </Button>
        {/if}
      </div>
    </div>

    {#if message}
      <div class="surface-panel border border-border-accent p-3 text-text-secondary text-sm">{message}</div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 min-h-[600px]">
      <div class="space-y-2">
        <h4 class="text-kicker mb-3">Unmatched Queue</h4>
        <div class="space-y-1 max-h-[calc(100vh-260px)] overflow-y-auto scrollbar-hidden">
          {#if unmatchedVideos.length === 0}
            <div class="surface-well p-6 text-center">
              <Check class="h-8 w-8 text-success-text mx-auto mb-2" />
              <p class="text-text-muted text-sm">All {entityTerms.videos.toLowerCase()} matched!</p>
            </div>
          {:else}
            {#each unmatchedVideos as video (video.id)}
              <button
                type="button"
                onclick={() => {
                  selectedVideoId = video.id;
                  scrapeState = defaultScrapeState;
                  message = null;
                }}
                class={cn(
                  "w-full text-left surface-card p-3 flex items-center gap-3 transition-colors duration-fast",
                  selectedVideoId === video.id && "border-border-accent bg-accent-950/30",
                )}
              >
                <EntityThumbnail
                  kind="video"
                  video={videoListItemToCardData(video)}
                  size="compact"
                  class="w-16 h-10 flex-shrink-0"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-sm truncate">{video.title}</p>
                  <p class="text-text-disabled text-xs mt-0.5">
                    {video.durationFormatted ?? "—"}
                    {#if video.resolution}
                      <span class="text-text-muted">{video.resolution}</span>
                    {/if}
                  </p>
                </div>
                <ChevronRight class="h-3.5 w-3.5 text-text-disabled flex-shrink-0" />
              </button>
            {/each}
          {/if}
        </div>
      </div>

      <div class="lg:col-span-2 space-y-4 relative z-20">
        {#if selectedVideo}
          <div class="surface-panel p-4">
            <div class="flex items-start gap-4">
              <EntityThumbnail
                kind="video"
                video={videoListItemToCardData(selectedVideo)}
                size="list"
                class="w-40 h-24 flex-shrink-0"
              />
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-semibold">{selectedVideo.title}</h3>
                <p class="text-mono-sm text-text-muted mt-1 truncate">{selectedVideo.filePath}</p>
                <div class="flex items-center gap-3 mt-2 text-xs text-text-disabled">
                  {#if selectedVideo.durationFormatted}<span>{selectedVideo.durationFormatted}</span>{/if}
                  {#if selectedVideo.resolution}<span>{selectedVideo.resolution}</span>{/if}
                  {#if selectedVideo.fileSizeFormatted}<span>{selectedVideo.fileSizeFormatted}</span>{/if}
                </div>
              </div>
            </div>
          </div>

          <div class="surface-panel p-4 space-y-3 relative z-20">
            <div class="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <div>
                <label class="control-label" for="resolve-scraper">Scraper</label>
                <ProviderSelector
                  value={selectedScraperId ?? ""}
                  onChange={(v) => (selectedScraperId = v)}
                  groups={[{ options: scrapers.map((s) => ({ value: s.id, label: s.name })) }]}
                />
              </div>
              <div>
                <label class="control-label" for="resolve-url">{entityTerms.video} URL (optional)</label>
                <input
                  id="resolve-url"
                  class="control-input"
                  placeholder="https://example.com/video/12345"
                  bind:value={scrapeUrl}
                />
              </div>
              <div class="flex items-end">
                <Button size="sm" onclick={() => void handleScrape()} disabled={scrapeState.scraping || !selectedScraperId}>
                  {#snippet children()}
                    {#if scrapeState.scraping}
                      <Loader2 class="h-3.5 w-3.5 animate-spin" />
                    {:else}
                      <Search class="h-3.5 w-3.5" />
                    {/if}
                    {scrapeState.scraping ? "Scraping..." : "Scrape"}
                  {/snippet}
                </Button>
              </div>
            </div>
            <p class="text-text-disabled text-xs">Tries URL → Title → Fragment in order, using the first match.</p>
          </div>

          {#if scrapeState.error}
            <div class="surface-panel border border-error/20 p-4">
              <div class="flex items-start gap-3">
                <AlertTriangle class="h-4 w-4 text-error-text flex-shrink-0 mt-0.5" />
                <div>
                  <p class="text-sm text-error-text font-medium">Scrape failed</p>
                  <p class="text-xs text-text-muted mt-1">{scrapeState.error}</p>
                </div>
              </div>
            </div>
          {/if}

          {#if scrapeState.searchResults}
            <div class="surface-panel p-4 space-y-3">
              <span class="text-label text-text-muted">
                Search Results ({scrapeState.searchResults.length})
              </span>
              <div class="space-y-2">
                {#each scrapeState.searchResults as result, idx (idx)}
                  <div class="surface-well p-3 flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-sm font-medium truncate">{result.title ?? "Untitled"}</p>
                      <p class="text-text-muted text-xs mt-0.5">
                        {[result.studioName, result.date].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {#if result.url}
                      <Button
                        variant="secondary"
                        size="sm"
                        onclick={() => {
                          scrapeUrl = result.url!;
                          scrapeState = defaultScrapeState;
                        }}
                      >
                        {#snippet children()}
                          <ExternalLink class="h-3 w-3" />
                          Scrape URL
                        {/snippet}
                      </Button>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if scrapeState.normalized}
            {@const normalized = scrapeState.normalized}
            {@const sv = selectedVideo}
            <div class="surface-panel p-5 space-y-5">
              <div class="flex items-center gap-2">
                <ArrowRightLeft class="h-3.5 w-3.5 text-accent-500" />
                <span class="text-label text-text-muted">Scraped Metadata</span>
                <Badge variant="info" class="text-[0.6rem]">
                  {#snippet children()}
                    {scrapers.find((s) => s.id === selectedScraperId)?.name ?? ""}
                  {/snippet}
                </Badge>
              </div>
              <div class="separator"></div>
              <div class="surface-well p-3 space-y-0">
                {#each [
                  { key: "title", field: "Title", current: sv.title, proposed: normalized.title ?? null },
                  { key: "date", field: "Date", current: sv.date, proposed: normalized.date ?? null },
                  { key: "studio", field: "Studio", current: null, proposed: normalized.studioName ?? null },
                  { key: "performers", field: entityTerms.performers, current: sv.performers.length > 0 ? sv.performers.map((p) => p.name).join(", ") : null, proposed: normalized.performerNames.length > 0 ? normalized.performerNames.join(", ") : null },
                  { key: "tags", field: "Tags", current: sv.tags.length > 0 ? sv.tags.map((t) => t.name).join(", ") : null, proposed: normalized.tagNames.length > 0 ? normalized.tagNames.join(", ") : null },
                  { key: "url", field: "URL", current: null, proposed: normalized.url ?? null },
                  { key: "details", field: "Details", current: sv.details, proposed: normalized.details ?? null },
                ] as row, ri (row.key)}
                  {@const diff = computeDiff({ field: row.field, current: row.current, proposed: row.proposed })}
                  {#if diff}
                    {#if ri > 0}<div class="separator"></div>{/if}
                    <div class="flex items-center gap-3 py-2.5">
                      <button
                        type="button"
                        onclick={() => toggleField(row.key)}
                        aria-label={`Toggle ${row.field}`}
                        class={cn(
                          "flex h-5 w-5 items-center justify-center transition-colors",
                          enabledFields.has(row.key)
                            ? diff.isAdd
                              ? "bg-success-muted/30 text-success-text"
                              : "bg-info-muted/30 text-info-text"
                            : "bg-surface-3 text-text-disabled",
                        )}
                      >
                        {#if diff.isAdd}
                          <Plus class="h-3 w-3" />
                        {:else}
                          <Minus class="h-3 w-3" />
                        {/if}
                      </button>
                      <span class="text-label text-text-muted w-24">{row.field}</span>
                      {#if diff.isChange && row.current}
                        <span class="text-mono-sm text-text-disabled line-through max-w-[200px] truncate">
                          {row.current}
                        </span>
                        <ChevronRight class="h-3 w-3 text-text-disabled flex-shrink-0" />
                      {/if}
                      <span
                        class={cn(
                          "text-mono-sm flex-1 min-w-0 truncate",
                          !enabledFields.has(row.key)
                            ? "text-text-disabled"
                            : diff.isAdd
                              ? "text-success-text"
                              : "text-info-text",
                        )}
                      >
                        {row.proposed}
                      </span>
                    </div>
                  {/if}
                {/each}
              </div>

              <div class="flex items-center justify-end gap-3 pt-2">
                <Button variant="ghost" size="md" onclick={() => void handleReject()}>
                  {#snippet children()}
                    <X class="h-3.5 w-3.5 mr-1.5" />
                    Reject
                  {/snippet}
                </Button>
                <Button variant="primary" size="md" onclick={() => void handleAccept()} disabled={applying}>
                  {#snippet children()}
                    {#if applying}
                      <Loader2 class="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    {:else}
                      <Check class="h-3.5 w-3.5 mr-1.5" />
                    {/if}
                    {applying ? "Applying..." : "Accept Match"}
                  {/snippet}
                </Button>
              </div>
            </div>
          {/if}

          {#if !scrapeState.scraping && !scrapeState.result && !scrapeState.error && !scrapeState.searchResults}
            <div class="surface-well flex flex-col items-center justify-center py-12">
              <ScanSearch class="h-10 w-10 text-text-disabled mb-3" />
              <p class="text-text-muted text-sm">Select a scraper, optionally provide a URL, then click Scrape.</p>
            </div>
          {/if}
        {:else}
          <div class="surface-well flex flex-col items-center justify-center py-20">
            <ScanSearch class="h-12 w-12 text-text-disabled mb-3" />
            <p class="text-text-muted text-sm">Select a video from the queue to begin.</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
