<script lang="ts">
  import { Loader2, RefreshCw, Wrench } from "@lucide/svelte";
  import { backfillPhashes, rebuildPreviews } from "$lib/api/library";
  import { useNsfw } from "$lib/stores/nsfw.svelte";
  import { entityTerms } from "$lib/terminology";

  const nsfw = useNsfw();

  let rebuilding = $state(false);
  let result = $state<string | null>(null);
  let backfilling = $state(false);
  let phashResult = $state<string | null>(null);

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
</section>
