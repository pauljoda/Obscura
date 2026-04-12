"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { cn } from "@obscura/ui/lib/utils";
import {
  Activity,
  AlertTriangle,
  Ban,
  Clock,
  Cpu,
  ListChecks,
  RefreshCw,
  Square,
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
import { useNsfw } from "./nsfw/nsfw-context";
import { groupQueuesForJobDashboard } from "./job-dashboard-queue-sections";
import { describeRunResult, displayJobHeading } from "./jobs/job-helpers";
import { OverviewStat } from "./jobs/overview-stat";
import { QueueCard } from "./jobs/queue-card";
import { ActiveJobCard, CompletedJobRow, EmptyPanel, FailedJobCard } from "./jobs/job-cards";

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
  const { mode: nsfwMode } = useNsfw();

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
      const response = await runQueue(queueName, nsfwMode);
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
        `Cancelled ${displayJobHeading(job, nsfwMode)} from ${response.queueName}${response.queueState ? ` (${response.queueState})` : ""}.`
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
      const response = await rebuildPreviews(nsfwMode);
      const parts = [
        `Queued forced preview rebuild (metadata re-probed) for ${response.enqueued} ${response.enqueued === 1 ? "video" : "videos"}`,
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

  const queueSections = useMemo(
    () => groupQueuesForJobDashboard(dashboard?.queues ?? []),
    [dashboard?.queues]
  );

  const totalActive = dashboard?.activeJobs.filter((job) => job.status === "active").length ?? 0;
  const totalQueued =
    dashboard?.queues.reduce((sum, queue) => sum + queue.backlog, 0) ?? 0;
  const totalFailed = dashboard?.failedJobs.length ?? 0;
  const retainedCompleted = dashboard?.completedJobs.length ?? 0;
  const canAcknowledgeFailures =
    totalFailed > 0 ||
    (dashboard?.queues ?? []).some((queue: QueueSummary) => queue.failed > 0);

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

      {/* Overview stats */}
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

      {/* Queues */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <Activity className="h-4 w-4 text-text-accent" />
            <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">Queues</h2>
          </div>
          <span className="text-mono-sm text-text-disabled">
            {dashboard?.queues.length ?? 0} configured
          </span>
        </div>
        <div className="space-y-8">
          {queueSections.map(({ section, queues: sectionQueues }) => (
            <div key={section?.id ?? "additional"} className="space-y-3">
              <div className="border-b border-border-subtle/80 px-1 pb-2">
                <h3 className="text-[0.72rem] font-semibold tracking-[0.14em] font-heading text-text-primary uppercase">
                  {section?.title ?? "Additional queues"}
                </h3>
                <p className="mt-1 text-[0.68rem] text-text-muted">
                  {section?.description ??
                    "Queues not yet assigned to a section; layout may need an update."}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {sectionQueues.map((queue: QueueSummary) => (
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
              </div>
            </div>
          ))}
          {!dashboard && loading && (
            <div className="surface-card no-lift p-6 text-center text-sm text-text-muted">
              Loading queue state...
            </div>
          )}
        </div>
      </section>

      <div className="border-t border-border-subtle" />

      {/* Live Work */}
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
                nsfwMode={nsfwMode}
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

      {/* Failures */}
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
            dashboard.failedJobs.map((job) => (
              <FailedJobCard key={job.id} job={job} nsfwMode={nsfwMode} />
            ))
          ) : (
            <EmptyPanel
              title="No active failures"
              detail="Failed jobs stay here until you clear them, so this list should stay short and actionable."
            />
          )}
        </div>
      </section>

      <div className="border-t border-border-subtle" />

      {/* Recently Finished */}
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
                <CompletedJobRow key={job.id} job={job} nsfwMode={nsfwMode} />
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
