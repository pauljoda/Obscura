<script lang="ts">
  import { onMount } from "svelte";
  import {
    ChevronLeft,
    ChevronRight,
    Fingerprint,
    Loader2,
    UploadCloud,
    X,
  } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import {
    createStashId,
    deleteStashId,
    fetchStashBoxEndpoints,
  } from "$lib/v1/api/scrapers-v1";
  import type { StashBoxEndpoint } from "$lib/v1/api/types-v1";
  import {
    listPhashContributions,
    submitFingerprintsToEndpoint,
    type FingerprintAlgorithm,
    type PhashContributionItem,
    type PhashContributionSubmission,
  } from "$lib/v1/api/phash-contributions-v1";
  import StashIdChips from "./StashIdChips.svelte";

  const ALGORITHMS: FingerprintAlgorithm[] = ["MD5", "OSHASH", "PHASH"];
  const PAGE_SIZE = 25;

  function truncateHash(hash: string | null, length = 12): string {
    if (!hash) return "—";
    return hash.length > length ? `${hash.slice(0, length)}…` : hash;
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds || seconds <= 0) return "—";
    const s = Math.round(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    }
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  function formatRelative(iso: string): string {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return iso;
    const diff = Date.now() - then;
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  }

  let loading = $state(true);
  let items = $state<PhashContributionItem[]>([]);
  let total = $state(0);
  let page = $state(1);
  let endpoints = $state<StashBoxEndpoint[]>([]);
  let submitting = $state(new Set<string>());
  let bulkProgress = $state<{ current: number; total: number } | null>(null);
  let error = $state<string | null>(null);

  const totalPages = $derived(Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const anySubmittable = $derived(items.some((i) => i.stashIds.length > 0));

  async function load(nextPage: number) {
    loading = true;
    error = null;
    try {
      const [contribs, epRes] = await Promise.all([
        listPhashContributions({ page: nextPage, pageSize: PAGE_SIZE }),
        fetchStashBoxEndpoints().catch(() => ({ endpoints: [] as StashBoxEndpoint[] })),
      ]);
      items = contribs.items;
      total = contribs.total;
      page = contribs.page;
      endpoints = epRes.endpoints.filter((e) => e.enabled);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load contributions";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void load(1);
  });

  function applySubmissionResults(
    videoId: string,
    endpointId: string,
    submissions: PhashContributionSubmission[],
  ) {
    items = items.map((item) => {
      if (item.video.id !== videoId) return item;
      const merged = [...item.submissions];
      for (const incoming of submissions) {
        const idx = merged.findIndex(
          (m) =>
            m.endpointId === endpointId &&
            m.algorithm === incoming.algorithm &&
            m.hash === incoming.hash,
        );
        if (idx >= 0) merged[idx] = incoming;
        else merged.push(incoming);
      }
      return { ...item, submissions: merged };
    });
  }

  async function submitOne(videoId: string, endpointId: string) {
    const key = `${videoId}:${endpointId}`;
    submitting = new Set(submitting).add(key);
    try {
      const res = await submitFingerprintsToEndpoint(endpointId, videoId);
      const now = new Date().toISOString();
      const stamped: PhashContributionSubmission[] = res.submissions.map((s) => ({
        endpointId,
        algorithm: s.algorithm,
        hash: s.hash,
        status: s.status,
        error: s.error ?? null,
        submittedAt: now,
      }));
      applySubmissionResults(videoId, endpointId, stamped);
    } catch (err) {
      const now = new Date().toISOString();
      const message = err instanceof Error ? err.message : "Submission failed";
      applySubmissionResults(
        videoId,
        endpointId,
        ALGORITHMS.map((alg) => ({
          endpointId,
          algorithm: alg,
          hash: "",
          status: "error" as const,
          error: message,
          submittedAt: now,
        })),
      );
    } finally {
      const next = new Set(submitting);
      next.delete(key);
      submitting = next;
    }
  }

  async function submitRow(item: PhashContributionItem) {
    for (const link of item.stashIds) {
      await submitOne(item.video.id, link.endpointId);
    }
  }

  async function submitAll() {
    const tasks: Array<{ videoId: string; endpointId: string }> = [];
    for (const item of items) {
      for (const link of item.stashIds) {
        tasks.push({ videoId: item.video.id, endpointId: link.endpointId });
      }
    }
    if (tasks.length === 0) return;
    bulkProgress = { current: 0, total: tasks.length };
    for (let i = 0; i < tasks.length; i++) {
      await submitOne(tasks[i].videoId, tasks[i].endpointId);
      bulkProgress = { current: i + 1, total: tasks.length };
    }
    bulkProgress = null;
  }

  async function removeStashId(itemId: string, linkId: string) {
    try {
      await deleteStashId(linkId);
      items = items.map((item) =>
        item.video.id !== itemId
          ? item
          : { ...item, stashIds: item.stashIds.filter((l) => l.id !== linkId) },
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to remove link";
    }
  }

  async function addStashId(videoId: string, endpointId: string, stashId: string) {
    const trimmed = stashId.trim();
    if (!trimmed || !endpointId) return;
    try {
      const created = await createStashId({
        entityType: "video",
        entityId: videoId,
        stashBoxEndpointId: endpointId,
        stashId: trimmed,
      });
      items = items.map((item) => {
        if (item.video.id !== videoId) return item;
        const withoutSameEndpoint = item.stashIds.filter(
          (l) => l.endpointId !== endpointId,
        );
        return {
          ...item,
          stashIds: [
            ...withoutSameEndpoint,
            {
              id: created.id,
              endpointId: created.endpointId,
              endpointName: created.endpointName,
              stashId: created.stashId,
            },
          ],
        };
      });
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to add link";
    }
  }

  function latestByKey(submissions: PhashContributionSubmission[]) {
    const map = new Map<string, PhashContributionSubmission>();
    for (const s of submissions) {
      const key = `${s.endpointId}:${s.algorithm}`;
      const existing = map.get(key);
      if (!existing || new Date(s.submittedAt) > new Date(existing.submittedAt)) {
        map.set(key, s);
      }
    }
    return map;
  }
</script>

{#if loading && items.length === 0}
  <div class="flex items-center justify-center py-20">
    <Loader2 class="h-6 w-6 animate-spin text-text-muted" />
  </div>
{:else}
  <div class="space-y-4">
    <div class="surface-card no-lift p-3 flex flex-wrap items-center gap-3">
      <div class="text-xs text-text-muted flex items-center gap-2">
        <Fingerprint class="h-3.5 w-3.5 text-text-accent" />
        <span>
          {total} {total === 1 ? "video" : "videos"} linked to StashBox endpoints
        </span>
      </div>
      <div class="flex-1"></div>
      {#if bulkProgress}
        <div class="flex items-center gap-2 text-xs text-text-muted">
          <Loader2 class="h-3.5 w-3.5 animate-spin" />
          Submitting {bulkProgress.current} / {bulkProgress.total}…
        </div>
      {:else}
        <button
          type="button"
          onclick={() => void submitAll()}
          disabled={!anySubmittable}
          class={cn(
            "flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium transition-all duration-normal",
            "bg-gradient-to-r from-accent-900 via-accent-800 to-accent-900",
            "text-accent-200 border border-border-accent shadow-[var(--shadow-glow-accent)]",
            "hover:shadow-[var(--shadow-glow-accent-strong)] hover:border-border-accent-strong",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          <UploadCloud class="h-3 w-3" />
          Submit all
        </button>
      {/if}

      <div class="flex items-center gap-1.5">
        <button
          type="button"
          onclick={() => void load(page - 1)}
          disabled={page <= 1 || loading}
          aria-label="Previous page"
          class="p-1.5 text-text-muted border border-border-subtle hover:text-text-primary hover:border-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft class="h-3.5 w-3.5" />
        </button>
        <div class="text-mono-sm text-text-disabled px-1">
          {page} / {totalPages}
        </div>
        <button
          type="button"
          onclick={() => void load(page + 1)}
          disabled={page >= totalPages || loading}
          aria-label="Next page"
          class="p-1.5 text-text-muted border border-border-subtle hover:text-text-primary hover:border-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    {#if error}
      <div class="surface-card no-lift p-3 border border-status-error/40 text-status-error-text text-xs flex items-center justify-between">
        <span>{error}</span>
        <button
          type="button"
          onclick={() => (error = null)}
          class="text-text-muted hover:text-text-primary"
          aria-label="Dismiss error"
        >
          <X class="h-3 w-3" />
        </button>
      </div>
    {/if}

    {#if items.length === 0 && !loading}
      <div class="surface-card no-lift p-12 text-center">
        <Fingerprint class="h-10 w-10 text-text-disabled mx-auto mb-3" />
        <p class="text-text-muted text-sm">
          No videos linked to StashBox endpoints yet.
        </p>
        <p class="text-text-disabled text-xs mt-1">
          Run Identify and accept a match to link videos, then return here to
          contribute their fingerprints.
        </p>
      </div>
    {/if}

    <div class="space-y-1.5">
      {#each items as item (item.video.id)}
        {@const availableEndpoints = endpoints.filter(
          (e) => !item.stashIds.some((l) => l.endpointId === e.id),
        )}
        {@const rowSubmitting = item.stashIds.some((l) =>
          submitting.has(`${item.video.id}:${l.endpointId}`),
        )}
        {@const latest = latestByKey(item.submissions)}
        <div class="surface-card no-lift p-3 space-y-2">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-text-primary truncate">
                {item.video.title}
              </div>
              <div class="text-mono-sm text-text-disabled mt-0.5">
                {formatDuration(item.video.duration)}
              </div>
            </div>
            <button
              type="button"
              onclick={() => void submitRow(item)}
              disabled={rowSubmitting || item.stashIds.length === 0}
              class={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all duration-normal",
                "text-text-accent border border-border-accent hover:shadow-[var(--shadow-glow-accent)]",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {#if rowSubmitting}
                <Loader2 class="h-3 w-3 animate-spin" />
              {:else}
                <UploadCloud class="h-3 w-3" />
              {/if}
              Submit
            </button>
          </div>

          <StashIdChips
            {item}
            {availableEndpoints}
            onRemove={(linkId) => void removeStashId(item.video.id, linkId)}
            onAdd={(endpointId, stashId) =>
              void addStashId(item.video.id, endpointId, stashId)}
          />

          <div class="flex flex-wrap items-center gap-1.5">
            {#each [
              { algorithm: "MD5" as FingerprintAlgorithm, value: item.video.checksumMd5 },
              { algorithm: "OSHASH" as FingerprintAlgorithm, value: item.video.oshash },
              { algorithm: "PHASH" as FingerprintAlgorithm, value: item.video.phash },
            ] as hash (hash.algorithm)}
              <div
                class={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 border text-xs",
                  hash.value
                    ? "bg-surface-2/60 border-border-subtle text-text-secondary"
                    : "bg-surface-1/40 border-border-subtle text-text-disabled",
                )}
              >
                <span class="font-medium">{hash.algorithm}</span>
                <span class="text-mono-sm">{truncateHash(hash.value, 10)}</span>
              </div>
            {/each}
          </div>

          {#if item.stashIds.length > 0}
            <div class="flex flex-wrap items-center gap-1">
              {#each item.stashIds as link (link.id)}
                {#each ALGORITHMS as alg (alg)}
                  {@const hasAlg =
                    (alg === "MD5" && !!item.video.checksumMd5) ||
                    (alg === "OSHASH" && !!item.video.oshash) ||
                    (alg === "PHASH" && !!item.video.phash)}
                  {#if hasAlg}
                    {@const submission = latest.get(`${link.endpointId}:${alg}`)}
                    {@const state = submission?.status ?? "pending"}
                    <div
                      title={submission?.error ?? undefined}
                      class={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 border text-[0.65rem] font-medium",
                        state === "success" &&
                          "bg-surface-2/60 border-border-accent text-text-accent shadow-[var(--shadow-glow-accent)]",
                        state === "error" &&
                          "bg-status-error/10 border-status-error/40 text-status-error-text",
                        state === "pending" &&
                          "bg-surface-1/40 border-border-subtle text-text-disabled",
                      )}
                    >
                      <span>{link.endpointName}</span>
                      <span>·</span>
                      <span>{alg}</span>
                      <span>·</span>
                      <span>
                        {#if state === "success"}
                          {submission ? formatRelative(submission.submittedAt) : "ok"}
                        {:else if state === "error"}
                          failed
                        {:else}
                          pending
                        {/if}
                      </span>
                    </div>
                  {/if}
                {/each}
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

