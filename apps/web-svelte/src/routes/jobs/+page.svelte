<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    Activity,
    AlertTriangle,
    Ban,
    Clock,
    Cpu,
    ListChecks,
    RefreshCw,
    Square,
  } from "@lucide/svelte";
  import {
    acknowledgeJobFailures,
    cancelAllJobs,
    cancelJobRun,
    cancelQueue,
    fetchJobsDashboard,
    runQueue,
  } from "$lib/api/library";
  import type { JobRun, JobsDashboard } from "$lib/api/types";
  import { useNsfw } from "$lib/stores/nsfw.svelte";
  import { groupQueuesForJobDashboard } from "$lib/jobs/queue-sections";
  import { describeRunResult, displayJobHeading } from "$lib/jobs/helpers";
  import OverviewStat from "$lib/components/jobs/OverviewStat.svelte";
  import QueueCard from "$lib/components/jobs/QueueCard.svelte";
  import ActiveJobCard from "$lib/components/jobs/ActiveJobCard.svelte";
  import FailedJobCard from "$lib/components/jobs/FailedJobCard.svelte";
  import CompletedJobRow from "$lib/components/jobs/CompletedJobRow.svelte";
  import EmptyPanel from "$lib/components/jobs/EmptyPanel.svelte";

  let { data } = $props();

  const nsfw = useNsfw();

  let dashboard = $state<JobsDashboard | null>(data.dashboard ?? null);
  let loading = $state(!data.dashboard);

  let runningQueue = $state<string | null>(null);
  let cancellingQueue = $state<string | null>(null);
  let cancellingAllJobs = $state(false);
  let cancellingJobRunId = $state<string | null>(null);
  let acknowledging = $state<"all" | string | null>(null);

  let error = $state<string | null>(null);
  let message = $state<string | null>(null);

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function loadDashboard() {
    try {
      const response = await fetchJobsDashboard(nsfw.mode);
      dashboard = response;
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

  async function handleRun(queueName: string) {
    runningQueue = queueName;
    message = null;
    try {
      const response = await runQueue(queueName, nsfw.mode);
      message = describeRunResult(queueName, response.enqueued, response.skipped);
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
    message = null;
    try {
      const response = await cancelQueue(queueName);
      message = `Cancelled ${queueName} jobs (${response.activeRemoved} active, ${response.waitingRemoved} waiting).`;
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
    message = null;
    try {
      const response = await cancelAllJobs();
      const total = response.activeRemoved + response.waitingRemoved;
      message = `Killed ${response.activeRemoved} active and ${response.waitingRemoved} queued job${total === 1 ? "" : "s"}.`;
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
    message = null;
    try {
      const response = await cancelJobRun(job.id);
      message = `Cancelled ${displayJobHeading(job, nsfw.mode)} from ${response.queueName}${response.queueState ? ` (${response.queueState})` : ""}.`;
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
    message = null;
    try {
      const result = await acknowledgeJobFailures(scope === "all" ? undefined : scope);
      const parts: string[] = [];
      if (result.redisRemoved > 0) {
        parts.push(
          `cleared ${result.redisRemoved} failed BullMQ job${result.redisRemoved === 1 ? "" : "s"}`,
        );
      }
      if (result.runsUpdated > 0) {
        parts.push(
          `acknowledged ${result.runsUpdated} failed run${result.runsUpdated === 1 ? "" : "s"}`,
        );
      }
      message =
        parts.length > 0
          ? `${parts.join("; ").replace(/^\w/, (c) => c.toUpperCase())}.`
          : "Nothing to clear.";
      error = null;
      await loadDashboard();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to acknowledge failures";
    } finally {
      acknowledging = null;
    }
  }

  const queueSections = $derived(groupQueuesForJobDashboard(dashboard?.queues ?? []));
  const totalActive = $derived(
    dashboard?.activeJobs.filter((job) => job.status === "active").length ?? 0,
  );
  const totalQueued = $derived(
    dashboard?.queues.reduce((sum, queue) => sum + queue.backlog, 0) ?? 0,
  );
  const totalFailed = $derived(dashboard?.failedJobs.length ?? 0);
  const retainedCompleted = $derived(dashboard?.completedJobs.length ?? 0);
  const canAcknowledgeFailures = $derived(
    totalFailed > 0 || (dashboard?.queues ?? []).some((q) => q.failed > 0),
  );
</script>

<svelte:head>
  <title>Job Control · Obscura</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 class="flex items-center gap-2.5">
        <Activity class="h-5 w-5 text-text-accent" />
        Job Control
      </h1>
      <p class="mt-1 text-text-muted text-[0.8rem]">
        Clear queue pressure, inspect live work, and keep only the failures that still need
        action.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-1.5">
      {#if canAcknowledgeFailures}
        <button
          type="button"
          onclick={() => void handleAcknowledgeFailures("all")}
          disabled={acknowledging !== null}
          class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted transition-all duration-fast hover:bg-status-error/10 hover:text-status-error-text disabled:opacity-40"
        >
          <Ban class="h-3.5 w-3.5" />
          {acknowledging === "all" ? "Clearing..." : "Clear all failures"}
        </button>
      {/if}
      <button
        type="button"
        onclick={() => void loadDashboard()}
        class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted transition-all duration-fast hover:bg-surface-3/60 hover:text-text-primary"
      >
        <RefreshCw class="h-3.5 w-3.5" />
        Refresh
      </button>
    </div>
  </div>

  {#if error}
    <div
      class="surface-card no-lift border-l-2 border-status-error px-3 py-2 text-sm text-status-error-text"
    >
      {error}
    </div>
  {/if}
  {#if message && !error}
    <div
      class="surface-card no-lift border-l-2 border-status-success px-3 py-2 text-sm text-status-success-text"
    >
      {message}
    </div>
  {/if}

  <!-- Overview stats -->
  <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
    <OverviewStat
      icon={Cpu}
      label="Running"
      value={totalActive}
      detail={totalActive > 0 ? "Workers are active now" : "No worker pressure right now"}
      accent={totalActive > 0}
    />
    <OverviewStat
      icon={Clock}
      label="Backlog"
      value={totalQueued}
      detail={totalQueued > 0 ? "Queued or delayed work" : "No queued backlog"}
      accent={totalQueued > 0}
    />
    <OverviewStat
      icon={AlertTriangle}
      label="Failures"
      value={totalFailed}
      detail={totalFailed > 0 ? "Needs review or clearing" : "No uncleared failures"}
      accent={totalFailed > 0}
      danger={totalFailed > 0}
    />
    <OverviewStat
      icon={ListChecks}
      label="Retained Done"
      value={retainedCompleted}
      detail={dashboard?.schedule.enabled
        ? `Auto scan every ${dashboard.schedule.intervalMinutes}m`
        : "Auto scan disabled"}
    />
  </div>

  <div class="border-t border-border-subtle"></div>

  <!-- Queues -->
  <section class="space-y-3">
    <div class="flex items-center justify-between px-1">
      <div class="flex items-center gap-2.5">
        <Activity class="h-4 w-4 text-text-accent" />
        <h2 class="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">
          Queues
        </h2>
      </div>
      <span class="text-mono-sm text-text-disabled">
        {dashboard?.queues.length ?? 0} configured
      </span>
    </div>
    <div class="space-y-8">
      {#each queueSections as { section, queues: sectionQueues } (section?.id ?? "additional")}
        <div class="space-y-3">
          <div class="border-b border-border-subtle/80 px-1 pb-2">
            <h3
              class="text-[0.72rem] font-semibold tracking-[0.14em] font-heading text-text-primary uppercase"
            >
              {section?.title ?? "Additional queues"}
            </h3>
            <p class="mt-1 text-[0.68rem] text-text-muted">
              {section?.description ??
                "Queues not yet assigned to a section; layout may need an update."}
            </p>
          </div>
          <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {#each sectionQueues as queue (queue.name)}
              <QueueCard
                {queue}
                {runningQueue}
                {cancellingQueue}
                {acknowledging}
                onRun={handleRun}
                onCancel={handleCancel}
                onClearFailures={handleAcknowledgeFailures}
              />
            {/each}
          </div>
        </div>
      {/each}
      {#if !dashboard && loading}
        <div class="surface-card no-lift p-6 text-center text-sm text-text-muted">
          Loading queue state...
        </div>
      {/if}
    </div>
  </section>

  <div class="border-t border-border-subtle"></div>

  <!-- Live Work -->
  <section class="space-y-3">
    <div class="flex items-center justify-between px-1">
      <div class="flex items-center gap-2.5">
        <Cpu class="h-4 w-4 text-text-accent" />
        <h2 class="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">
          Live Work
        </h2>
      </div>
      <div class="flex items-center gap-2">
        {#if (dashboard?.activeJobs.length ?? 0) > 0}
          <button
            type="button"
            onclick={() => void handleCancelAllJobs()}
            disabled={cancellingAllJobs}
            class="flex items-center gap-1 px-2 py-1 text-xs text-text-muted transition-colors hover:text-status-error-text disabled:opacity-40"
          >
            <Square class="h-3 w-3" />
            {cancellingAllJobs ? "Killing..." : "Kill all"}
          </button>
        {/if}
        <span class="text-mono-sm text-text-disabled">
          {dashboard?.activeJobs.length ?? 0} visible
        </span>
      </div>
    </div>
    <div class="space-y-2">
      {#if dashboard?.activeJobs.length}
        {#each dashboard.activeJobs as job (job.id)}
          <ActiveJobCard
            {job}
            nsfwMode={nsfw.mode}
            {cancellingJobRunId}
            onCancelJob={handleCancelJob}
          />
        {/each}
      {:else}
        <EmptyPanel
          title="No active or queued jobs"
          detail="When work is triggered, the active queue and backlog will show up here first."
        />
      {/if}
    </div>
  </section>

  <div class="border-t border-border-subtle"></div>

  <!-- Failures -->
  <section class="space-y-3">
    <div class="flex items-center justify-between px-1">
      <div class="flex items-center gap-2.5">
        <AlertTriangle class="h-4 w-4 text-status-error-text" />
        <h2 class="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">
          Failures
        </h2>
      </div>
      <div class="flex items-center gap-2">
        {#if totalFailed > 0}
          <button
            type="button"
            onclick={() => void handleAcknowledgeFailures("all")}
            disabled={acknowledging !== null}
            class="flex items-center gap-1 px-2 py-1 text-xs text-text-muted transition-colors hover:text-status-error-text disabled:opacity-40"
          >
            <Ban class="h-3 w-3" />
            {acknowledging === "all" ? "Clearing..." : "Clear all"}
          </button>
        {/if}
        <span class="text-mono-sm text-text-disabled">
          {totalFailed} uncleared
        </span>
      </div>
    </div>
    <div class="space-y-2">
      {#if dashboard?.failedJobs.length}
        {#each dashboard.failedJobs as job (job.id)}
          <FailedJobCard {job} nsfwMode={nsfw.mode} />
        {/each}
      {:else}
        <EmptyPanel
          title="No active failures"
          detail="Failed jobs stay here until you clear them, so this list should stay short and actionable."
        />
      {/if}
    </div>
  </section>

  <div class="border-t border-border-subtle"></div>

  <!-- Recently Finished -->
  <section class="space-y-3">
    <div class="flex items-center justify-between px-1">
      <div class="flex items-center gap-2.5">
        <ListChecks class="h-4 w-4 text-text-accent" />
        <h2 class="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">
          Recently Finished
        </h2>
      </div>
      <span class="text-mono-sm text-text-disabled">{retainedCompleted} retained</span>
    </div>
    <div class="surface-card no-lift overflow-hidden">
      <div class="divide-y divide-border-subtle/50">
        {#if dashboard?.completedJobs.length}
          {#each dashboard.completedJobs as job (job.id)}
            <CompletedJobRow {job} nsfwMode={nsfw.mode} />
          {/each}
        {:else}
          <div class="px-4 py-6 text-center text-sm text-text-disabled">
            No retained completions.
          </div>
        {/if}
      </div>
    </div>
  </section>
</div>
