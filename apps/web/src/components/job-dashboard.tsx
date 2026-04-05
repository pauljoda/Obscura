"use client";

import { useEffect, useMemo, useState } from "react";
import { Meter } from "@obscura/ui/composed/meter";
import { StatusLed, type LedStatus } from "@obscura/ui/composed/status-led";
import { Badge } from "@obscura/ui/primitives/badge";
import { cn } from "@obscura/ui/lib/utils";
import {
  FolderSearch,
  FileSearch,
  Fingerprint,
  Image,
  DatabaseZap,
  Cpu,
  Clock,
  RefreshCw,
  Play,
  Activity,
  AlertTriangle,
  ListChecks,
} from "lucide-react";
import {
  fetchJobsDashboard,
  runQueue,
  type JobRun,
  type JobsDashboard,
} from "../lib/api";

const queueIcons: Record<string, typeof FolderSearch> = {
  "library-scan": FolderSearch,
  "media-probe": FileSearch,
  fingerprint: Fingerprint,
  preview: Image,
  "metadata-import": DatabaseZap,
};

function formatElapsed(startedAt: string | null) {
  if (!startedAt) return "Queued";
  const deltaSeconds = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(deltaSeconds / 60);
  const seconds = deltaSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatStamp(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function ledForStatus(status: string): LedStatus {
  if (status === "active") return "phosphor";
  if (status === "warning") return "warning";
  if (status === "failed") return "error";
  return "idle";
}

export function JobDashboard() {
  const [dashboard, setDashboard] = useState<JobsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningQueue, setRunningQueue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadDashboard() {
    try {
      const response = await fetchJobsDashboard();
      setDashboard(response);
      setError(null);
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
      setMessage(
        `Queued ${response.enqueued} ${queueName} job${response.enqueued === 1 ? "" : "s"}.`
      );
      await loadDashboard();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to queue jobs");
    } finally {
      setRunningQueue(null);
    }
  }

  const failedCount = useMemo(
    () => dashboard?.recentJobs.filter((job) => job.status === "failed").length ?? 0,
    [dashboard]
  );

  const totalActive = dashboard?.activeJobs.length ?? 0;
  const totalCompleted = dashboard?.queues.reduce((sum, q) => sum + q.completed, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Activity className="h-5 w-5 text-text-accent" />
            Operations
          </h1>
          <p className="mt-1 text-text-muted text-[0.78rem]">
            Queue health, active work, and manual generation controls.
          </p>
        </div>
        <button
          onClick={() => void loadDashboard()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] text-xs text-text-muted hover:text-text-primary hover:bg-surface-3/60 transition-all duration-fast"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="surface-card-sharp no-lift border-l-2 border-status-error px-3 py-2 text-sm text-status-error-text">
          {error}
        </div>
      )}
      {message && !error && (
        <div className="surface-card-sharp no-lift border-l-2 border-status-success px-3 py-2 text-sm text-status-success-text">
          {message}
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className={cn("surface-stat px-3 py-2.5", totalActive > 0 && "surface-stat-accent")}>
          <div className="flex items-center gap-1.5 mb-1">
            <Cpu className="h-3 w-3" />
            <span className={cn("text-kicker", totalActive === 0 && "!text-text-disabled")}>Active</span>
          </div>
          <div className={cn(
            "text-lg font-semibold leading-tight",
            totalActive > 0 ? "text-glow-accent" : "text-text-primary"
          )}>
            {totalActive}
          </div>
        </div>
        <div className="surface-stat px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <ListChecks className="h-3 w-3" />
            <span className="text-kicker !text-text-disabled">Completed</span>
          </div>
          <div className="text-lg font-semibold text-text-primary leading-tight">
            {totalCompleted}
          </div>
        </div>
        <div className={cn("surface-stat px-3 py-2.5", failedCount > 0 && "border-status-error/30")}>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-3 w-3" />
            <span className="text-kicker !text-text-disabled">Failed</span>
          </div>
          <div className={cn(
            "text-lg font-semibold leading-tight",
            failedCount > 0 ? "text-status-error-text" : "text-text-primary"
          )}>
            {failedCount}
          </div>
        </div>
        <div className="surface-stat px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3 w-3" />
            <span className="text-kicker !text-text-disabled">Last Scan</span>
          </div>
          <div className="text-[0.8rem] font-medium text-text-secondary leading-tight mt-0.5 font-mono">
            {dashboard?.lastScanAt
              ? <span className="text-ephemeral">{new Date(dashboard.lastScanAt).toLocaleTimeString()}</span>
              : "Never"}
          </div>
          <div className="text-[0.62rem] text-text-disabled mt-0.5">
            Auto scan {dashboard?.schedule.enabled
              ? `every ${dashboard.schedule.intervalMinutes}m`
              : "disabled"}
          </div>
        </div>
      </div>

      <div className="border-t border-border-subtle" />

      {/* Queues */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <Activity className="h-4 w-4 text-text-accent" />
            <h2 className="text-[0.9rem] font-heading font-semibold">Queues</h2>
          </div>
          <span className="text-mono-sm text-text-disabled">
            {dashboard?.queues.length ?? 0} configured
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {dashboard?.queues.map((queue) => {
            const Icon = queueIcons[queue.name] ?? Cpu;
            const hasActivity = queue.active > 0 || queue.waiting > 0;
            return (
              <div
                key={queue.name}
                className={cn(
                  "surface-card-sharp no-lift p-3.5 transition-all duration-normal",
                  hasActivity && "border-border-accent/30"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <StatusLed status={ledForStatus(queue.status)} pulse={queue.active > 0} />
                    <Icon className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[0.8rem] font-medium truncate">{queue.name}</p>
                      <p className="text-text-disabled text-[0.62rem] mt-0.5 truncate">{queue.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => void handleRun(queue.name)}
                    disabled={runningQueue === queue.name}
                    className="flex items-center gap-1 px-2 py-1 rounded-[3px] text-xs text-text-muted hover:text-text-accent transition-colors flex-shrink-0 disabled:opacity-40"
                  >
                    <Play className="h-3 w-3" />
                    Run
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: "Active", value: queue.active, highlight: queue.active > 0 },
                    { label: "Wait", value: queue.waiting, highlight: queue.waiting > 0 },
                    { label: "Done", value: queue.completed, highlight: false },
                    { label: "Fail", value: queue.failed, highlight: queue.failed > 0 },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center rounded-[2px] bg-black/15 py-1.5">
                      <p className="text-[0.55rem] text-text-disabled uppercase tracking-wider mb-0.5">
                        {stat.label}
                      </p>
                      <p
                        className={cn(
                          "text-mono text-[0.8rem] font-semibold",
                          stat.label === "Fail" && stat.highlight
                            ? "text-status-error-text"
                            : stat.highlight
                              ? "text-text-accent"
                              : "text-text-muted"
                        )}
                      >
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {!dashboard && loading && (
            <div className="surface-card-sharp no-lift p-6 text-text-muted text-sm col-span-full text-center">
              Loading queue state...
            </div>
          )}
        </div>
      </section>

      <div className="border-t border-border-subtle" />

      {/* Active Jobs */}
      {(totalActive > 0 || loading) && (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5">
                <Cpu className="h-4 w-4 text-text-accent" />
                <h2 className="text-[0.9rem] font-heading font-semibold">Active Jobs</h2>
              </div>
              <span className="text-mono-sm text-text-disabled">
                {totalActive} in flight
              </span>
            </div>
            <div className="space-y-2">
              {dashboard?.activeJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </section>
          <div className="border-t border-border-subtle" />
        </>
      )}

      {/* Recent Runs */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <ListChecks className="h-4 w-4 text-text-accent" />
            <h2 className="text-[0.9rem] font-heading font-semibold">Recent Runs</h2>
          </div>
          <span className="text-mono-sm text-text-disabled">
            {dashboard?.recentJobs.length ?? 0} jobs
          </span>
        </div>
        <div className="surface-card-sharp no-lift overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1.3fr_0.8fr_0.7fr_0.5fr] gap-3 px-4 py-2.5 text-[0.6rem] uppercase tracking-[0.12em] text-text-disabled border-b border-border-subtle bg-black/15">
            <span>Target</span>
            <span>Queue</span>
            <span>Status</span>
            <span className="text-right">Progress</span>
          </div>
          {/* Table body */}
          <div className="divide-y divide-border-subtle/40 max-h-[440px] overflow-y-auto scrollbar-hidden">
            {dashboard?.recentJobs.map((job) => (
              <div
                key={job.id}
                className={cn(
                  "grid grid-cols-[1.3fr_0.8fr_0.7fr_0.5fr] gap-3 px-4 py-2.5 text-[0.8rem] transition-colors",
                  job.status === "failed" && "bg-status-error/[0.04]"
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{job.targetLabel ?? "Queued work"}</p>
                  <p className="text-mono-sm text-text-disabled truncate">
                    {job.finishedAt ? formatStamp(job.finishedAt) : formatStamp(job.createdAt)}
                  </p>
                </div>
                <div className="flex items-center">
                  <Badge variant="accent" className="text-[0.55rem]">{job.queueName}</Badge>
                </div>
                <div className="flex items-center">
                  <span
                    className={cn(
                      "text-[0.65rem] font-semibold uppercase tracking-[0.1em]",
                      job.status === "failed"
                        ? "text-status-error-text"
                        : job.status === "completed"
                          ? "text-status-success-text"
                          : "text-text-accent"
                    )}
                  >
                    {job.status}
                  </span>
                </div>
                <div className="text-mono-sm text-text-muted flex items-center justify-end">
                  {job.progress}%
                </div>
                {job.error && (
                  <div className="col-span-4 text-[0.68rem] text-status-error-text mt-1 truncate">{job.error}</div>
                )}
              </div>
            ))}
            {!dashboard && loading && (
              <div className="px-4 py-6 text-text-muted text-sm text-center">Loading recent jobs...</div>
            )}
            {dashboard && dashboard.recentJobs.length === 0 && (
              <div className="px-4 py-6 text-text-disabled text-sm text-center">No recent jobs.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function JobCard({ job }: { job: JobRun }) {
  return (
    <div className={cn(
      "surface-card-sharp no-lift p-3.5 transition-all duration-normal",
      job.status === "failed" ? "border-status-error/30" : "border-phosphor-500/30"
    )}>
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <StatusLed status={job.status === "failed" ? "error" : "phosphor"} pulse={job.status !== "failed"} />
          <Badge variant="accent" className="text-[0.55rem] flex-shrink-0">
            {job.queueName}
          </Badge>
          <p className="text-[0.8rem] text-text-secondary truncate">
            {job.targetLabel ?? "Background work"}
          </p>
        </div>
        <span className="text-ephemeral flex-shrink-0">
          {formatElapsed(job.startedAt)}
        </span>
      </div>
      <Meter value={job.progress} showValue variant={job.status === "failed" ? "accent" : "phosphor"} />
    </div>
  );
}
