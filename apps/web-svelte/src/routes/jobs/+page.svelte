<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    Activity,
    AlertTriangle,
    Ban,
    CheckCheck,
    Clock,
    Play,
    RefreshCw,
    Square,
  } from "@lucide/svelte";
  import { Badge, Button, StatusLed, type LedStatus } from "@obscura/ui-svelte";
  import {
    acknowledgeJobFailures,
    cancelAllJobs,
    cancelJobRun,
    cancelQueue,
    fetchJobsDashboard,
    rebuildPreviews,
    runQueue,
  } from "$lib/api/library";
  import { useNsfw } from "$lib/stores/nsfw.svelte";
  import type { JobsDashboard, JobRun } from "$lib/api/types";

  let { data } = $props();

  const nsfw = useNsfw();

  let dashboard = $state<JobsDashboard | null>(data.dashboard ?? null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let message = $state<string | null>(null);

  let runningQueue = $state<string | null>(null);
  let cancellingQueue = $state<string | null>(null);
  let cancellingAllJobs = $state(false);
  let cancellingJobRunId = $state<string | null>(null);
  let rebuildingPreviews = $state(false);
  let acknowledging = $state<"all" | string | null>(null);

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function loadDashboard() {
    try {
      const res = await fetchJobsDashboard();
      dashboard = res;
      error = null;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load jobs";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadDashboard();
    pollTimer = setInterval(() => void loadDashboard(), 5000);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  function flashMessage(msg: string) {
    message = msg;
    setTimeout(() => {
      if (message === msg) message = null;
    }, 4000);
  }

  async function handleRun(queueName: string) {
    runningQueue = queueName;
    try {
      const res = await runQueue(queueName, nsfw.mode);
      flashMessage(
        `Queued ${res.enqueued} ${queueName} job${res.enqueued === 1 ? "" : "s"}` +
          (res.skipped > 0 ? ` (skipped ${res.skipped})` : "") +
          ".",
      );
      error = null;
      await loadDashboard();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to queue jobs";
    } finally {
      runningQueue = null;
    }
  }

  async function handleCancel(queueName: string) {
    cancellingQueue = queueName;
    try {
      const res = await cancelQueue(queueName);
      flashMessage(
        `Cancelled ${queueName} jobs (${res.activeRemoved} active, ${res.waitingRemoved} waiting).`,
      );
      error = null;
      await loadDashboard();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to cancel jobs";
    } finally {
      cancellingQueue = null;
    }
  }

  async function handleCancelAllJobs() {
    cancellingAllJobs = true;
    try {
      const res = await cancelAllJobs();
      const total = res.activeRemoved + res.waitingRemoved;
      flashMessage(
        `Killed ${res.activeRemoved} active and ${res.waitingRemoved} queued job${total === 1 ? "" : "s"}.`,
      );
      error = null;
      await loadDashboard();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to kill all jobs";
    } finally {
      cancellingAllJobs = false;
    }
  }

  async function handleCancelJob(job: JobRun) {
    cancellingJobRunId = job.id;
    try {
      const res = await cancelJobRun(job.id);
      flashMessage(
        `Cancelled ${job.targetLabel ?? job.targetType ?? "job"} from ${res.queueName}` +
          (res.queueState ? ` (${res.queueState})` : "") +
          ".",
      );
      error = null;
      await loadDashboard();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to cancel job";
    } finally {
      cancellingJobRunId = null;
    }
  }

  async function handleAcknowledgeFailures(scope: "all" | string) {
    acknowledging = scope;
    try {
      const res = await acknowledgeJobFailures(scope === "all" ? undefined : scope);
      const parts: string[] = [];
      if (res.redisRemoved > 0)
        parts.push(`cleared ${res.redisRemoved} failed job${res.redisRemoved === 1 ? "" : "s"}`);
      if (res.runsUpdated > 0)
        parts.push(`acknowledged ${res.runsUpdated} failed run${res.runsUpdated === 1 ? "" : "s"}`);
      flashMessage(
        parts.length > 0
          ? `${parts.join("; ").replace(/^\w/, (c) => c.toUpperCase())}.`
          : "Nothing to clear.",
      );
      error = null;
      await loadDashboard();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to acknowledge failures";
    } finally {
      acknowledging = null;
    }
  }

  async function handleForceRebuildPreviews() {
    rebuildingPreviews = true;
    try {
      const res = await rebuildPreviews(nsfw.mode);
      flashMessage(
        `Queued forced preview rebuild for ${res.enqueued} video${res.enqueued === 1 ? "" : "s"}` +
          (res.skipped > 0 ? `, skipped ${res.skipped} already pending` : "") +
          ".",
      );
      error = null;
      await loadDashboard();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to queue forced preview rebuild";
    } finally {
      rebuildingPreviews = false;
    }
  }

  function jobStatus(status: string): LedStatus {
    switch (status) {
      case "completed":
      case "succeeded":
        return "active";
      case "failed":
      case "errored":
        return "error";
      case "running":
      case "active":
        return "accent";
      case "queued":
      case "pending":
        return "info";
      default:
        return "idle";
    }
  }

  function statusVariant(status: string): "success" | "warning" | "error" | "info" | "default" {
    if (status === "completed" || status === "succeeded") return "success";
    if (status === "failed" || status === "errored") return "error";
    if (status === "running" || status === "active") return "info";
    if (status === "queued" || status === "pending") return "warning";
    return "default";
  }

  const d = $derived(dashboard);
  const hasActiveJobs = $derived((d?.activeJobs?.length ?? 0) > 0);
  const hasFailedJobs = $derived((d?.failedJobs?.length ?? 0) > 0);
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-4">
  <header class="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <h1 class="flex items-center gap-2.5">
        <Activity class="h-5 w-5 text-text-accent" />
        Jobs
      </h1>
      {#if d?.lastScanAt}
        <p class="text-body-sm text-text-muted mt-1">
          Last scan: {new Date(d.lastScanAt).toLocaleString()}
        </p>
      {/if}
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <Button
        variant="secondary"
        size="sm"
        onclick={() => void loadDashboard()}
        disabled={loading}
      >
        {#snippet children()}
          <RefreshCw class={"h-3.5 w-3.5" + (loading ? " animate-spin" : "")} />
          Refresh
        {/snippet}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onclick={() => void handleForceRebuildPreviews()}
        disabled={rebuildingPreviews}
      >
        {#snippet children()}
          <RefreshCw class={"h-3.5 w-3.5" + (rebuildingPreviews ? " animate-spin" : "")} />
          Force rebuild previews
        {/snippet}
      </Button>
      {#if hasActiveJobs}
        <Button
          variant="danger"
          size="sm"
          onclick={() => void handleCancelAllJobs()}
          disabled={cancellingAllJobs}
        >
          {#snippet children()}
            <Square class="h-3.5 w-3.5" />
            {cancellingAllJobs ? "Killing…" : "Kill all"}
          {/snippet}
        </Button>
      {/if}
      {#if hasFailedJobs}
        <Button
          variant="secondary"
          size="sm"
          onclick={() => void handleAcknowledgeFailures("all")}
          disabled={acknowledging === "all"}
        >
          {#snippet children()}
            <CheckCheck class="h-3.5 w-3.5" />
            {acknowledging === "all" ? "Clearing…" : "Acknowledge failures"}
          {/snippet}
        </Button>
      {/if}
    </div>
  </header>

  {#if error}
    <div class="surface-well border-l-2 border-status-error px-3 py-2 text-sm text-status-error-text">
      {error}
    </div>
  {/if}
  {#if message && !error}
    <div class="surface-well border-l-2 border-status-success px-3 py-2 text-sm text-status-success-text">
      {message}
    </div>
  {/if}

  {#if !d}
    <div class="surface-panel p-8 text-center">
      <Activity class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">Job dashboard unavailable.</p>
    </div>
  {:else}
    {#if d.queues?.length}
      <section class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {#each d.queues as q (q.name)}
          <div class="surface-panel p-4 space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-label text-text-muted truncate">{q.label ?? q.name}</span>
              <StatusLed status={(q.active ?? 0) > 0 ? "accent" : "idle"} />
            </div>
            <dl class="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[0.7rem] text-text-secondary">
              <dt class="text-text-muted">Active:</dt><dd>{q.active ?? 0}</dd>
              <dt class="text-text-muted">Queued:</dt><dd>{q.waiting ?? 0}</dd>
              <dt class="text-text-muted">Failed:</dt><dd>{q.failed ?? 0}</dd>
              <dt class="text-text-muted">Complete:</dt><dd>{q.completed ?? 0}</dd>
            </dl>
            <div class="flex items-center gap-1.5 pt-1">
              <button
                onclick={() => void handleRun(q.name)}
                disabled={runningQueue === q.name}
                class="flex items-center gap-1 px-2 py-1 text-[0.65rem] text-text-muted hover:text-text-accent transition-colors duration-fast disabled:opacity-40"
                title="Run this queue"
              >
                <Play class="h-3 w-3" />
                {runningQueue === q.name ? "Running…" : "Run"}
              </button>
              {#if (q.active ?? 0) > 0 || (q.waiting ?? 0) > 0}
                <button
                  onclick={() => void handleCancel(q.name)}
                  disabled={cancellingQueue === q.name}
                  class="flex items-center gap-1 px-2 py-1 text-[0.65rem] text-text-muted hover:text-status-error-text transition-colors duration-fast disabled:opacity-40"
                  title="Cancel active + queued jobs on this queue"
                >
                  <Ban class="h-3 w-3" />
                  {cancellingQueue === q.name ? "Cancelling…" : "Cancel"}
                </button>
              {/if}
              {#if (q.failed ?? 0) > 0}
                <button
                  onclick={() => void handleAcknowledgeFailures(q.name)}
                  disabled={acknowledging === q.name}
                  class="flex items-center gap-1 px-2 py-1 text-[0.65rem] text-text-muted hover:text-status-warning-text transition-colors duration-fast disabled:opacity-40"
                  title="Clear failed jobs on this queue"
                >
                  <AlertTriangle class="h-3 w-3" />
                  {acknowledging === q.name ? "Clearing…" : "Clear"}
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </section>
    {/if}

    {#each ["activeJobs", "failedJobs", "recentJobs"] as const as key}
      {@const rows = d[key] ?? []}
      {#if rows.length > 0}
        <section class="space-y-2">
          <h2 class="text-label text-text-muted capitalize">
            {key.replace("Jobs", "")} jobs ({rows.length})
          </h2>
          <ul class="surface-panel divide-y divide-border-subtle">
            {#each rows as j (j.id)}
              <li class="flex items-center gap-3 px-4 py-2 text-body-sm">
                <StatusLed status={jobStatus(j.status)} />
                <span
                  class="font-mono text-text-muted text-[0.7rem] w-24 truncate"
                  title={j.queueLabel ?? j.queueName}
                >
                  {j.queueLabel ?? j.queueName}
                </span>
                <span class="flex-1 min-w-0 truncate text-text-primary">
                  {j.targetLabel ?? j.targetType ?? "—"}
                </span>
                <Badge variant={statusVariant(j.status)}>
                  {#snippet children()}{j.status}{/snippet}
                </Badge>
                {#if j.progress > 0 && j.progress < 1}
                  <span class="text-text-disabled font-mono w-12 text-right">
                    {Math.round(j.progress * 100)}%
                  </span>
                {/if}
                <span class="text-text-disabled text-[0.7rem] font-mono flex items-center gap-1 w-32 justify-end">
                  <Clock class="h-3 w-3" />
                  {j.finishedAt
                    ? new Date(j.finishedAt).toLocaleTimeString()
                    : j.startedAt
                      ? new Date(j.startedAt).toLocaleTimeString()
                      : "—"}
                </span>
                {#if key === "activeJobs"}
                  <button
                    onclick={() => void handleCancelJob(j)}
                    disabled={cancellingJobRunId === j.id}
                    class="p-1 text-text-disabled hover:text-status-error-text transition-colors duration-fast disabled:opacity-40"
                    aria-label="Cancel this job"
                    title="Cancel this job"
                  >
                    <Square class="h-3.5 w-3.5" />
                  </button>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}
  {/if}
</div>
