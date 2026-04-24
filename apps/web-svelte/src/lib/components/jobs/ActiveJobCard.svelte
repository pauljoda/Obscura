<script lang="ts">
  import { Square } from "@lucide/svelte";
  import { Badge, Meter, StatusLed, cn } from "@obscura/ui-svelte";
  import type { JobRun } from "$lib/api/types";
  import {
    displayDescribeTrigger,
    displayJobHeading,
    formatElapsed,
    formatStamp,
    isForceRebuildJob,
    jobBadgeVariant,
    statusLabel,
    toneForJob,
  } from "$lib/jobs/helpers";
  import ForceRebuildBadge from "./ForceRebuildBadge.svelte";

  interface Props {
    job: JobRun;
    nsfwMode: string;
    cancellingJobRunId: string | null;
    onCancelJob: (job: JobRun) => void | Promise<void>;
  }

  let { job, nsfwMode, cancellingJobRunId, onCancelJob }: Props = $props();

  const isRunning = $derived(job.status === "active");
  const isCancelling = $derived(cancellingJobRunId === job.id);
  const forceRebuild = $derived(isForceRebuildJob(job));
</script>

<div
  class={cn(
    "surface-card no-lift space-y-3 p-4",
    forceRebuild
      ? "border-status-error/30 bg-status-error/[0.04]"
      : isRunning
        ? "border-border-accent/30"
        : "border-status-warning/20",
  )}
>
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <StatusLed status={toneForJob(job)} pulse={isRunning} />
        <Badge variant={jobBadgeVariant(job)} class="text-[0.56rem]">
          {#snippet children()}{job.queueLabel}{/snippet}
        </Badge>
        <ForceRebuildBadge {job} />
        <span
          class={cn(
            "text-[0.62rem] font-semibold uppercase tracking-[0.12em]",
            forceRebuild
              ? "text-status-error-text"
              : isRunning
                ? "text-text-accent"
                : "text-status-warning-text",
          )}
        >
          {statusLabel(job.status)}
        </span>
      </div>
      <h3 class="mt-2 text-[0.95rem] font-medium text-text-primary">
        {displayJobHeading(job, nsfwMode)}
      </h3>
      <p class="mt-1 text-[0.74rem] text-text-muted">
        {displayDescribeTrigger(job, nsfwMode)}
      </p>
    </div>
    <div class="text-right">
      <p class="text-ephemeral">{formatElapsed(job)}</p>
      <p class="mt-1 text-mono-sm text-text-disabled">
        attempt {Math.max(1, job.attempts + 1)}
      </p>
      <button
        type="button"
        onclick={() => void onCancelJob(job)}
        disabled={isCancelling}
        class="mt-2 inline-flex items-center gap-1 px-2 py-1 text-xs text-text-muted transition-colors hover:text-status-error-text disabled:opacity-40"
      >
        <Square class="h-3 w-3" />
        {isCancelling ? "Stopping..." : "Kill task"}
      </button>
    </div>
  </div>

  <Meter value={job.progress} showValue variant={isRunning && !forceRebuild ? "phosphor" : "accent"} />

  <div class="grid gap-2 text-[0.7rem] text-text-disabled md:grid-cols-3">
    <div>
      <span class="text-text-muted">Queued:</span>
      {formatStamp(job.createdAt)}
    </div>
    <div>
      <span class="text-text-muted">Started:</span>
      {formatStamp(job.startedAt)}
    </div>
    <div>
      <span class="text-text-muted">Trigger:</span>
      {job.triggeredBy ?? "unknown"}
    </div>
  </div>
</div>
