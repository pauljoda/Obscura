<script lang="ts">
  import { AlertTriangle, Loader2, RefreshCw, Trash2, Wrench } from "@lucide/svelte";
  import { backfillPhashes, clearAllMetadata, rebuildPreviews } from "$lib/v1/api/library-v1";
  import { useNsfw } from "$lib/nsfw/store.svelte";
  import { entityTerms } from "$lib/terminology";

  const nsfw = useNsfw();

  let rebuilding = $state(false);
  let result = $state<string | null>(null);
  let backfilling = $state(false);
  let phashResult = $state<string | null>(null);
  let clearing = $state(false);
  let clearResult = $state<string | null>(null);
  let confirmClearOpen = $state(false);

  async function handleClearMetadata() {
    confirmClearOpen = false;
    clearing = true;
    clearResult = null;
    try {
      const res = await clearAllMetadata();
      const total = res.episodesCleared + res.moviesCleared + res.seriesCleared;
      clearResult = `Cleared metadata on ${total} ${total === 1 ? "item" : "items"} (${res.episodesCleared} episodes, ${res.moviesCleared} movies, ${res.seriesCleared} series). Queued ${res.librariesQueued} library scan${res.librariesQueued === 1 ? "" : "s"}.`;
    } catch (err) {
      clearResult = err instanceof Error ? `Failed: ${err.message}` : "Failed to clear metadata";
    } finally {
      clearing = false;
    }
  }

  async function handleRebuildPreviews() {
    rebuilding = true;
    result = null;
    try {
      const res = await rebuildPreviews(nsfw.mode);
      result = `Queued ${res.enqueued} ${res.enqueued === 1 ? "video" : "videos"} for forced preview regeneration (metadata re-probed from disk)`;
    } catch {
      result = "Failed to queue rebuild";
    } finally {
      rebuilding = false;
    }
  }

  async function handleBackfillPhashes() {
    backfilling = true;
    phashResult = null;
    try {
      const res = await backfillPhashes(nsfw.mode);
      phashResult = `Queued ${res.enqueued} ${res.enqueued === 1 ? "video" : "videos"} for pHash generation`;
    } catch {
      phashResult = "Failed to queue backfill";
    } finally {
      backfilling = false;
    }
  }
</script>

<section class="space-y-3">
  <div class="flex items-center gap-2.5 px-1">
    <Wrench class="h-4 w-4 text-text-accent" />
    <div>
      <h2 class="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">
        Diagnostics
      </h2>
      <p class="text-[0.68rem] text-text-muted">Maintenance actions for troubleshooting</p>
    </div>
  </div>
  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
    <div class="surface-card p-3 space-y-2">
      <div>
        <p class="text-[0.78rem] font-medium text-status-error-text">
          Force rebuild all previews
        </p>
        <p class="text-[0.68rem] text-text-muted">
          Re-probe each file on disk (resolution, duration, codecs, size), then clear and
          regenerate thumbnails, preview clips, and trickplay sprites for every
          {entityTerms.video.toLowerCase()}. Use this after replacing a source file with a
          different resolution, after quality setting changes, or to fix corrupt sprites.
          Heavy maintenance job.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button
          type="button"
          onclick={handleRebuildPreviews}
          disabled={rebuilding}
          class="inline-flex items-center gap-1.5 border border-status-error/25 bg-status-error/[0.12] px-3 py-1.5 text-[0.72rem] font-medium text-status-error-text transition-colors hover:bg-status-error/[0.18] disabled:opacity-50"
        >
          {#if rebuilding}
            <Loader2 class="h-3 w-3 animate-spin" />
          {:else}
            <RefreshCw class="h-3 w-3" />
          {/if}
          {rebuilding ? "Queuing..." : "Force rebuild previews"}
        </button>
        {#if result}
          <p class="text-[0.68rem] text-text-muted">{result}</p>
        {/if}
      </div>
    </div>
    <div class="surface-card p-3 space-y-2">
      <div>
        <p class="text-[0.78rem] font-medium text-text-primary">Backfill perceptual hashes</p>
        <p class="text-[0.68rem] text-text-muted">
          Queue a Stash-compatible pHash generation job for every
          {entityTerms.video.toLowerCase()} that has a known duration but no stored phash.
          Required before you can contribute those hashes to StashDB / ThePornDB from the
          Identify → pHashes tab. CPU-heavy (25 ffmpeg frame extractions per
          {entityTerms.video.toLowerCase()}).
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button
          type="button"
          onclick={handleBackfillPhashes}
          disabled={backfilling}
          class="inline-flex items-center gap-1.5 border border-border-accent/40 bg-accent-950/30 px-3 py-1.5 text-[0.72rem] font-medium text-text-accent transition-colors hover:bg-accent-950/50 hover:shadow-[var(--shadow-glow-accent)] disabled:opacity-50"
        >
          {#if backfilling}
            <Loader2 class="h-3 w-3 animate-spin" />
          {:else}
            <RefreshCw class="h-3 w-3" />
          {/if}
          {backfilling ? "Queuing..." : "Backfill pHashes"}
        </button>
        {#if phashResult}
          <p class="text-[0.68rem] text-text-muted">{phashResult}</p>
        {/if}
      </div>
    </div>
  </div>

  <div class="surface-card p-3 space-y-2 border-status-error/30">
    <div>
      <p class="text-[0.78rem] font-medium text-status-error-text flex items-center gap-1.5">
        <AlertTriangle class="h-3.5 w-3.5" />
        Clear all metadata
      </p>
      <p class="text-[0.68rem] text-text-muted">
        Wipes every scrape-derived custom field across {entityTerms.series.toLowerCase()},
        {entityTerms.movies.toLowerCase()}, and episodes (overview, tagline, air / release date,
        runtime, rating, studio, performers, tags, posters, URLs, external IDs) and clears the
        scrape-results history. Technical probe data — duration, codecs, fingerprints, generated
        thumbnails — stays intact. A fresh library scan is queued on every enabled library root
        so the tree gets rediscovered. Irreversible.
      </p>
    </div>
    <div class="flex items-center gap-3">
      <button
        type="button"
        onclick={() => (confirmClearOpen = true)}
        disabled={clearing}
        class="inline-flex items-center gap-1.5 border border-status-error/25 bg-status-error/[0.12] px-3 py-1.5 text-[0.72rem] font-medium text-status-error-text transition-colors hover:bg-status-error/[0.18] disabled:opacity-50"
      >
        {#if clearing}
          <Loader2 class="h-3 w-3 animate-spin" />
        {:else}
          <Trash2 class="h-3 w-3" />
        {/if}
        {clearing ? "Clearing..." : "Clear all metadata"}
      </button>
      {#if clearResult}
        <p class="text-[0.68rem] text-text-muted">{clearResult}</p>
      {/if}
    </div>
  </div>
</section>

{#if confirmClearOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute inset-0 bg-black/80 backdrop-blur-sm"
      onclick={() => (confirmClearOpen = false)}
      aria-hidden="true"
    ></div>
    <div
      class="relative surface-elevated border border-status-error/40 w-full max-w-md mx-4 p-6 space-y-4"
    >
      <h3 class="text-base font-heading font-semibold text-status-error-text flex items-center gap-2">
        <AlertTriangle class="h-4 w-4" />
        Clear all metadata?
      </h3>
      <p class="text-[0.78rem] text-text-muted leading-relaxed">
        Every scrape-derived field on every {entityTerms.video.toLowerCase()} will be wiped and
        every library root rescanned. Your original files, technical probe data, and generated
        thumbnails stay on disk. Performer / tag / studio assignments and the scrape-results log
        will be deleted. This cannot be undone.
      </p>
      <div class="flex items-center justify-end gap-2">
        <button
          type="button"
          onclick={() => (confirmClearOpen = false)}
          class="px-3.5 py-2 text-[0.75rem] text-text-muted hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={() => void handleClearMetadata()}
          class="inline-flex items-center gap-1.5 border border-status-error/40 bg-status-error/[0.18] px-3.5 py-2 text-[0.8rem] font-medium text-status-error-text transition-colors hover:bg-status-error/[0.25]"
        >
          <Trash2 class="h-3.5 w-3.5" />
          Yes, clear everything
        </button>
      </div>
    </div>
  </div>
{/if}
