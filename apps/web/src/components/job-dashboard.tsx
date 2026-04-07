"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { Meter } from "@obscura/ui/composed/meter";
import { StatusLed, type LedStatus } from "@obscura/ui/composed/status-led";
import { Badge } from "@obscura/ui/primitives/badge";
import { cn } from "@obscura/ui/lib/utils";
import {
  Activity,
  AlertTriangle,
  Ban,
  Clock,
  Cpu,
  DatabaseZap,
  FileSearch,
  Fingerprint,
  FolderSearch,
  Image,
  ListChecks,
  Play,
  RefreshCw,
  Square,
  Wrench,
} from "lucide-react";
import {
  acknowledgeJobFailures,
  cancelAllJobs,
  cancelJobRun,
  cancelQueue,
  fetchJobsDashboard,
  rebuildPreviews,
  runQueue,
  type JobRun,
  type JobsDashboard,
  type QueueSummary,
} from "../lib/api";

const queueIcons: Record<string, typeof FolderSearch> = {
  "library-scan": FolderSearch,
  "media-probe": FileSearch,
  fingerprint: Fingerprint,
  preview: Image,
  "metadata-import": DatabaseZap,
  "gallery-scan": FolderSearch,
  "image-thumbnail": Image,
  "image-fingerprint": Fingerprint,
};

function formatStamp(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function formatRelativeTime(value: string | null) {
  if (!value) return "Never";

  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatElapsed(job: JobRun) {
  const anchor = job.startedAt ?? job.createdAt;
  const deltaSeconds = Math.max(0, Math.round((Date.now() - new Date(anchor).getTime()) / 1000));
  const minutes = Math.floor(deltaSeconds / 60);
  const seconds = deltaSeconds % 60;

  if (job.status === "waiting" || job.status === "delayed") {
    return `queued ${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function ledForQueue(status: QueueSummary["status"]): LedStatus {
  if (status === "active") return "phosphor";
  if (status === "warning") return "warning";
  return "idle";
}

function isForceRebuildJob(job: JobRun) {
  return job.jobKind === "force-rebuild";
}

function toneForJob(job: JobRun) {
  if (job.status === "failed") return "error";
  if (isForceRebuildJob(job)) return "error";
  if (job.status === "waiting" || job.status === "delayed") return "warning";
  return "phosphor";
}

function describeTrigger(job: JobRun) {
  if (job.triggerLabel) return job.triggerLabel;

  switch (job.triggeredBy) {
    case "manual":
      return "Started manually";
    case "schedule":
      return "Started by recurring scan schedule";
    case "library-scan":
      return "Queued during library scan";
    case "gallery-scan":
      return "Queued during gallery scan";
    case "system":
      return "Queued by the system";
    default:
      return "Trigger not recorded";
  }
}

function statusLabel(status: JobRun["status"]) {
  if (status === "waiting") return "queued";
  if (status === "delayed") return "delayed";
  if (status === "dismissed") return "cleared";
  return status;
}

function jobHeading(job: JobRun) {
  return job.targetLabel ?? `${job.queueLabel} task`;
}

function jobBadgeVariant(job: JobRun) {
  return isForceRebuildJob(job) ? "error" : "accent";
}

function ForceRebuildBadge({ job }: { job: JobRun }) {
  if (!isForceRebuildJob(job)) {
    return null;
  }

  return (
    <Badge variant="error" className="text-[0.56rem]">
      Force rebuild
    </Badge>
  );
}

function describeRunResult(queueName: string, enqueued: number, skipped: number) {
  const parts = [
    `Queued ${enqueued} ${queueName} job${enqueued === 1 ? "" : "s"}`,
  ];

  if (skipped > 0) {
    parts.push(`skipped ${skipped} already pending`);
  }

  return `${parts.join(", ")}.`;
}

export function JobDashboard() {
  const [dashboard, setDashboard] = useState<JobsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningQueue, setRunningQueue] = useState<string | null>(null);
  const [cancellingQueue, setCancellingQueue] = useState<string | null>(null);
  const [cancellingAllJobs, setCancellingAllJobs] = useState(false);
  const [cancellingJobRunId, setCancellingJobRunId] = useState<string | null>(null);
  const [rebuildingPreviews, setRebuildingPreviews] = useState(false);
  const [acknowledging, setAcknowledging] = useState<"all" | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadDashboard() {
    try {
      const response = await fetchJobsDashboard();
      startTransition(() => {
        setDashboard(response);
        setError(null);
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
    const timer = window.setInterval(() => {
      void loadDashboard();
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  async function handleRun(queueName: string) {
    setRunningQueue(queueName);
    setMessage(null);

    try {
      const response = await runQueue(queueName);
      setMessage(describeRunResult(queueName, response.enqueued, response.skipped));
      setError(null);
      await loadDashboard();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to queue jobs");
    } finally {
      setRunningQueue(null);
    }
  }

  async function handleCancel(queueName: string) {
    setCancellingQueue(queueName);
    setMessage(null);

    try {
      const response = await cancelQueue(queueName);
      setMessage(
        `Cancelled ${queueName} jobs (${response.activeRemoved} active, ${response.waitingRemoved} waiting).`
      );
      setError(null);
      await loadDashboard();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Failed to cancel jobs");
    } finally {
      setCancellingQueue(null);
    }
  }

  async function handleCancelAllJobs() {
    setCancellingAllJobs(true);
    setMessage(null);

    try {
      const response = await cancelAllJobs();
      setMessage(
        `Killed ${response.activeRemoved} active and ${response.waitingRemoved} queued job${response.activeRemoved + response.waitingRemoved === 1 ? "" : "s"}.`
      );
      setError(null);
      await loadDashboard();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Failed to kill all jobs");
    } finally {
      setCancellingAllJobs(false);
    }
  }

  async function handleCancelJob(job: JobRun) {
    setCancellingJobRunId(job.id);
    setMessage(null);

    try {
      const response = await cancelJobRun(job.id);
      setMessage(
        `Cancelled ${jobHeading(job)} from ${response.queueName}${response.redisState ? ` (${response.redisState})` : ""}.`
      );
      setError(null);
      await loadDashboard();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Failed to cancel job");
    } finally {
      setCancellingJobRunId(null);
    }
  }

  async function handleAcknowledgeFailures(scope: "all" | string) {
    setAcknowledging(scope);
    setMessage(null);

    try {
      const result = await acknowledgeJobFailures(scope === "all" ? undefined : scope);
      const parts: string[] = [];

      if (result.redisRemoved > 0) {
        parts.push(
          `cleared ${result.redisRemoved} failed BullMQ job${result.redisRemoved === 1 ? "" : "s"}`
        );
      }

      if (result.runsUpdated > 0) {
        parts.push(
          `acknowledged ${result.runsUpdated} failed run${result.runsUpdated === 1 ? "" : "s"}`
        );
      }

      setMessage(
        parts.length > 0
          ? `${parts.join("; ").replace(/^\w/, (char) => char.toUpperCase())}.`
          : "Nothing to clear."
      );
      setError(null);
      await loadDashboard();
    } catch (ackError) {
      setError(ackError instanceof Error ? ackError.message : "Failed to acknowledge failures");
    } finally {
      setAcknowledging(null);
    }
  }

  async function handleForceRebuildPreviews() {
    setRebuildingPreviews(true);
    setMessage(null);

    try {
      const response = await rebuildPreviews();
      const parts = [
        `Queued forced preview rebuild for ${response.enqueued} scene${response.enqueued === 1 ? "" : "s"}`,
      ];

      if (response.skipped > 0) {
        parts.push(`skipped ${response.skipped} already pending`);
      }

      setMessage(`${parts.join(", ")}.`);
      setError(null);
      await loadDashboard();
    } catch (rebuildError) {
      setError(
        rebuildError instanceof Error ? rebuildError.message : "Failed to queue forced preview rebuild"
      );
    } finally {
      setRebuildingPreviews(false);
    }
  }

  const sortedQueues = useMemo(
    () =>
      [...(dashboard?.queues ?? [])].sort(
        (left: QueueSummary, right: QueueSummary) =>
          right.failed - left.failed ||
          right.backlog - left.backlog ||
          right.active - left.active ||
          left.label.localeCompare(right.label)
      ),
    [dashboard]
  );

  const totalActive = dashboard?.activeJobs.filter((job) => job.status === "active").length ?? 0;
  const totalQueued =
    dashboard?.activeJobs.filter((job) => job.status === "waiting" || job.status === "delayed")
      .length ?? 0;
  const totalFailed = dashboard?.failedJobs.length ?? 0;
  const retainedCompleted = dashboard?.completedJobs.length ?? 0;
  const canAcknowledgeFailures =
    totalFailed > 0 || sortedQueues.some((queue: QueueSummary) => queue.failed > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Activity className="h-5 w-5 text-text-accent" />
            Job Control
          </h1>
          <p className="mt-1 text-text-muted text-[0.8rem]">
            Clear queue pressure, inspect live work, and keep only the failures that still need action.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {canAcknowledgeFailures && (
            <button
              type="button"
              onClick={() => void handleAcknowledgeFailures("all")}
              disabled={acknowledging !== null}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted transition-all duration-fast hover:bg-status-error/10 hover:text-status-error-text disabled:opacity-40"
            >
              <Ban className="h-3.5 w-3.5" />
              {acknowledging === "all" ? "Clearing..." : "Clear all failures"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted transition-all duration-fast hover:bg-surface-3/60 hover:text-text-primary"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="surface-card no-lift border-l-2 border-status-error px-3 py-2 text-sm text-status-error-text">
          {error}
        </div>
      )}
      {message && !error && (
        <div className="surface-card no-lift border-l-2 border-status-success px-3 py-2 text-sm text-status-success-text">
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
          detail={
            dashboard?.schedule.enabled
              ? `Auto scan every ${dashboard.schedule.intervalMinutes}m`
              : "Auto scan disabled"
          }
        />
      </div>

      <div className="border-t border-border-subtle" />

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <Activity className="h-4 w-4 text-text-accent" />
            <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">Queues</h2>
          </div>
          <span className="text-mono-sm text-text-disabled">
            {sortedQueues.length} configured
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {sortedQueues.map((queue: QueueSummary) => (
            <QueueCard
              key={queue.name}
              queue={queue}
              runningQueue={runningQueue}
              cancellingQueue={cancellingQueue}
              acknowledging={acknowledging}
              onRun={handleRun}
              onCancel={handleCancel}
              onClearFailures={handleAcknowledgeFailures}
            />
          ))}
          {!dashboard && loading && (
            <div className="surface-card no-lift col-span-full p-6 text-center text-sm text-text-muted">
              Loading queue state...
            </div>
          )}
        </div>
      </section>

      <div className="border-t border-border-subtle" />

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <Cpu className="h-4 w-4 text-text-accent" />
            <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">Live Work</h2>
          </div>
          <div className="flex items-center gap-2">
            {(dashboard?.activeJobs.length ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => void handleCancelAllJobs()}
                disabled={cancellingAllJobs}
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted transition-colors hover:text-status-error-text disabled:opacity-40"
              >
                <Square className="h-3 w-3" />
                {cancellingAllJobs ? "Killing..." : "Kill all"}
              </button>
            )}
            <span className="text-mono-sm text-text-disabled">
              {dashboard?.activeJobs.length ?? 0} visible
            </span>
          </div>
        </div>
        <div className="space-y-2">
          {dashboard?.activeJobs.length ? (
            dashboard.activeJobs.map((job) => (
              <ActiveJobCard
                key={job.id}
                job={job}
                cancellingJobRunId={cancellingJobRunId}
                onCancelJob={handleCancelJob}
              />
            ))
          ) : (
            <EmptyPanel
              title="No active or queued jobs"
              detail="When work is triggered, the active queue and backlog will show up here first."
            />
          )}
        </div>
      </section>

      <div className="border-t border-border-subtle" />

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-status-error-text" />
            <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">Failures</h2>
          </div>
          <div className="flex items-center gap-2">
            {totalFailed > 0 && (
              <button
                type="button"
                onClick={() => void handleAcknowledgeFailures("all")}
                disabled={acknowledging !== null}
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted transition-colors hover:text-status-error-text disabled:opacity-40"
              >
                <Ban className="h-3 w-3" />
                {acknowledging === "all" ? "Clearing..." : "Clear all"}
              </button>
            )}
            <span className="text-mono-sm text-text-disabled">
              {totalFailed} uncleared
            </span>
          </div>
        </div>
        <div className="space-y-2">
          {dashboard?.failedJobs.length ? (
            dashboard.failedJobs.map((job) => <FailedJobCard key={job.id} job={job} />)
          ) : (
            <EmptyPanel
              title="No active failures"
              detail="Failed jobs stay here until you clear them, so this list should stay short and actionable."
            />
          )}
        </div>
      </section>

      <div className="border-t border-border-subtle" />

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <ListChecks className="h-4 w-4 text-text-accent" />
            <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">Recently Finished</h2>
          </div>
          <span className="text-mono-sm text-text-disabled">
            {retainedCompleted} retained
          </span>
        </div>
        <div className="surface-card no-lift overflow-hidden">
          <div className="divide-y divide-border-subtle/50">
            {dashboard?.completedJobs.length ? (
              dashboard.completedJobs.map((job) => (
                <CompletedJobRow key={job.id} job={job} />
              ))
            ) : (
              <div className="px-4 py-6 text-center text-sm text-text-disabled">
                No retained completions.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function OverviewStat({
  icon: Icon,
  label,
  value,
  detail,
  accent = false,
  danger = false,
}: {
  icon: typeof Cpu;
  label: string;
  value: number;
  detail: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface-panel relative overflow-hidden px-3 py-2.5 flex flex-col justify-between min-h-[72px]",
        accent && !danger && "border-border-accent shadow-[var(--shadow-glow-accent)]",
        danger && "border-status-error/30 shadow-[0_0_12px_rgba(179,79,86,0.15)]"
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] opacity-90",
          danger ? "bg-status-error" : accent ? "bg-accent-500" : "bg-surface-4"
        )}
      />
      <div className="flex items-center justify-between ml-1.5">
        <span className={cn("text-[0.6rem] font-semibold tracking-[0.15em] uppercase", danger ? "text-status-error-text" : "text-text-muted")}>
          {label}
        </span>
        <div className={cn("opacity-70", danger ? "text-status-error-text" : accent ? "text-text-accent" : "text-text-disabled")}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="flex items-end justify-between ml-1.5 mt-1">
        <div
          className={cn(
            "text-lg font-mono tracking-tight",
            danger
              ? "text-status-error-text"
              : accent
                ? "text-glow-accent"
                : "text-text-primary"
          )}
        >
          {value}
        </div>
        <div className="text-[0.6rem] text-text-disabled mb-0.5 truncate max-w-[60%] text-right" title={detail}>
          {detail}
        </div>
      </div>
    </div>
  );
}

function QueueCard({
  queue,
  runningQueue,
  cancellingQueue,
  acknowledging,
  onRun,
  onCancel,
  onClearFailures,
}: {
  queue: QueueSummary;
  runningQueue: string | null;
  cancellingQueue: string | null;
  acknowledging: "all" | string | null;
  onRun: (queueName: string) => Promise<void>;
  onCancel: (queueName: string) => Promise<void>;
  onClearFailures: (scope: "all" | string) => Promise<void>;
}) {
  const Icon = queueIcons[queue.name] ?? Cpu;
  const hasPressure = queue.active > 0 || queue.backlog > 0;

  return (
    <div
      className={cn(
        "surface-card no-lift space-y-4 p-4 transition-all duration-normal",
        queue.failed > 0
          ? "border-status-error/25"
          : hasPressure
            ? "border-border-accent/30"
            : ""
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <StatusLed status={ledForQueue(queue.status)} pulse={queue.active > 0} />
            <Icon className="h-4 w-4 text-text-muted" />
            <h3 className="truncate text-[0.92rem] font-heading font-semibold">{queue.label}</h3>
          </div>
          <p className="mt-1 text-[0.72rem] text-text-muted">{queue.description}</p>
          <p className="mt-1 text-[0.68rem] text-text-disabled">
            Throttle: {queue.concurrency} worker{queue.concurrency === 1 ? "" : "s"} at a time
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {queue.failed > 0 && (
            <button
              type="button"
              onClick={() => void onClearFailures(queue.name)}
              disabled={acknowledging !== null}
              className="px-2 py-1 text-xs text-text-muted transition-colors hover:text-status-error-text disabled:opacity-40"
            >
              {acknowledging === queue.name ? "Clearing..." : "Clear failures"}
            </button>
          )}
          {(queue.active > 0 || queue.backlog > 0) && (
            <button
              type="button"
              onClick={() => void onCancel(queue.name)}
              disabled={cancellingQueue === queue.name}
              className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted transition-colors hover:text-status-error-text disabled:opacity-40"
            >
              <Square className="h-3 w-3" />
              {cancellingQueue === queue.name ? "Stopping..." : "Stop"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void onRun(queue.name)}
            disabled={runningQueue === queue.name}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-accent disabled:opacity-40"
          >
            <Play className="h-3 w-3" />
            {runningQueue === queue.name ? "Queueing..." : "Run"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <QueueMetric label="Running" value={queue.active} highlight={queue.active > 0} />
        <QueueMetric label="Queued" value={queue.waiting} highlight={queue.waiting > 0} />
        <QueueMetric label="Delayed" value={queue.delayed} highlight={queue.delayed > 0} />
        <QueueMetric label="Errors" value={queue.failed} highlight={queue.failed > 0} danger />
      </div>
    </div>
  );
}

function QueueMetric({
  label,
  value,
  highlight,
  danger = false,
}: {
  label: string;
  value: number;
  highlight: boolean;
  danger?: boolean;
}) {
  return (
    <div className="bg-black/15 px-2 py-2 text-center">
      <p className="mb-0.5 text-[0.55rem] uppercase tracking-wider text-text-disabled">
        {label}
      </p>
      <p
        className={cn(
          "text-mono text-[0.84rem] font-semibold",
          danger && highlight
            ? "text-status-error-text"
            : highlight
              ? "text-text-accent"
              : "text-text-muted"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ActiveJobCard({
  job,
  cancellingJobRunId,
  onCancelJob,
}: {
  job: JobRun;
  cancellingJobRunId: string | null;
  onCancelJob: (job: JobRun) => Promise<void>;
}) {
  const isRunning = job.status === "active";
  const isCancelling = cancellingJobRunId === job.id;

  return (
    <div
      className={cn(
        "surface-card no-lift space-y-3 p-4",
        isForceRebuildJob(job)
          ? "border-status-error/30 bg-status-error/[0.04]"
          : isRunning
            ? "border-border-accent/30"
            : "border-status-warning/20"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusLed status={toneForJob(job)} pulse={isRunning} />
            <Badge variant={jobBadgeVariant(job)} className="text-[0.56rem]">
              {job.queueLabel}
            </Badge>
            <ForceRebuildBadge job={job} />
            <span
              className={cn(
                "text-[0.62rem] font-semibold uppercase tracking-[0.12em]",
                isForceRebuildJob(job)
                  ? "text-status-error-text"
                  : isRunning
                    ? "text-text-accent"
                    : "text-status-warning-text"
              )}
            >
              {statusLabel(job.status)}
            </span>
          </div>
          <h3 className="mt-2 text-[0.95rem] font-medium text-text-primary">{jobHeading(job)}</h3>
          <p className="mt-1 text-[0.74rem] text-text-muted">{describeTrigger(job)}</p>
        </div>
        <div className="text-right">
          <p className="text-ephemeral">{formatElapsed(job)}</p>
          <p className="mt-1 text-mono-sm text-text-disabled">
            attempt {Math.max(1, job.attempts + 1)}
          </p>
          <button
            type="button"
            onClick={() => void onCancelJob(job)}
            disabled={isCancelling}
            className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-xs text-text-muted transition-colors hover:text-status-error-text disabled:opacity-40"
          >
            <Square className="h-3 w-3" />
            {isCancelling ? "Stopping..." : "Kill task"}
          </button>
        </div>
      </div>

      <Meter
        value={job.progress}
        showValue
        variant={isRunning && !isForceRebuildJob(job) ? "phosphor" : "accent"}
      />

      <div className="grid gap-2 text-[0.7rem] text-text-disabled md:grid-cols-3">
        <div>
          <span className="text-text-muted">Queued:</span> {formatStamp(job.createdAt)}
        </div>
        <div>
          <span className="text-text-muted">Started:</span> {formatStamp(job.startedAt)}
        </div>
        <div>
          <span className="text-text-muted">Trigger:</span> {job.triggeredBy ?? "unknown"}
        </div>
      </div>
    </div>
  );
}

function FailedJobCard({ job }: { job: JobRun }) {
  return (
    <details className="surface-card no-lift border-status-error/25 p-4" open>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusLed status="error" pulse={false} />
              <Badge variant={jobBadgeVariant(job)} className="text-[0.56rem]">
                {job.queueLabel}
              </Badge>
              <ForceRebuildBadge job={job} />
              <span className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-status-error-text">
                failed
              </span>
            </div>
            <h3 className="mt-2 text-[0.95rem] font-medium text-text-primary">{jobHeading(job)}</h3>
            <p className="mt-1 text-[0.74rem] text-text-muted">{describeTrigger(job)}</p>
          </div>
          <div className="text-right">
            <p className="text-ephemeral">{formatRelativeTime(job.finishedAt ?? job.updatedAt)}</p>
            <p className="mt-1 text-mono-sm text-text-disabled">
              attempt {Math.max(1, job.attempts + 1)}
            </p>
          </div>
        </div>
      </summary>

      <div className="mt-4 border-t border-border-subtle pt-4">
        <div className="grid gap-2 text-[0.7rem] text-text-disabled md:grid-cols-3">
          <div>
            <span className="text-text-muted">Queued:</span> {formatStamp(job.createdAt)}
          </div>
          <div>
            <span className="text-text-muted">Finished:</span> {formatStamp(job.finishedAt)}
          </div>
          <div>
            <span className="text-text-muted">Trigger:</span> {job.triggeredBy ?? "unknown"}
          </div>
        </div>
        <div className="mt-3 border border-status-error/20 bg-status-error/[0.05] p-3">
          <p className="mb-1 text-[0.68rem] uppercase tracking-[0.12em] text-status-error-text">
            Error output
          </p>
          <pre className="whitespace-pre-wrap break-words font-mono text-[0.75rem] leading-5 text-status-error-text">
            {job.error ?? "No error message recorded."}
          </pre>
        </div>
      </div>
    </details>
  );
}

function CompletedJobRow({ job }: { job: JobRun }) {
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[1.1fr_0.8fr_0.8fr]">
      <div className="min-w-0">
        <p className="truncate text-[0.84rem] font-medium text-text-primary">{jobHeading(job)}</p>
        <p className="mt-1 truncate text-mono-sm text-text-disabled">{describeTrigger(job)}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={jobBadgeVariant(job)} className="text-[0.56rem]">
          {job.queueLabel}
        </Badge>
        <ForceRebuildBadge job={job} />
      </div>
      <div className="text-right text-[0.72rem] text-text-muted">
        <div>{formatRelativeTime(job.finishedAt ?? job.updatedAt)}</div>
        <div className="mt-1 text-text-disabled">{formatStamp(job.finishedAt)}</div>
      </div>
    </div>
  );
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="surface-card no-lift px-4 py-6 text-center">
      <p className="text-sm font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-[0.78rem] text-text-muted">{detail}</p>
    </div>
  );
}
