"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusLed, Meter, Badge, Button, cn } from "@obscura/ui";
import {
  FolderSearch,
  FileSearch,
  Fingerprint,
  Image,
  DatabaseZap,
  Cpu,
  HardDrive,
  Clock,
  RefreshCw,
  Play,
} from "lucide-react";
import type { LedStatus } from "@obscura/ui";
import {
  fetchJobsDashboard,
  runQueue,
  type JobRun,
  type JobsDashboard,
} from "../lib/api";

const queueIcons = {
  "library-scan": FolderSearch,
  "media-probe": FileSearch,
  fingerprint: Fingerprint,
  preview: Image,
  "metadata-import": DatabaseZap,
} as const;

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
  if (status === "active") return "active";
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

  const failedJobs = useMemo(
    () => dashboard?.recentJobs.filter((job) => job.status === "failed").slice(0, 6) ?? [],
    [dashboard]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Operations</h1>
          <p className="mt-1 text-text-muted text-sm">
            Queue health, active work, and manual generation controls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void loadDashboard()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {(error || message) && (
        <div className={error ? "surface-panel border border-error/20 p-3 text-error-text text-sm" : "surface-panel border border-border-accent p-3 text-text-secondary text-sm"}>
          {error ?? message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-5">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-kicker">Queues</h4>
              <span className="text-mono-sm text-text-muted">
                {dashboard?.queues.length ?? 0} configured
              </span>
            </div>
            <div className="space-y-2">
              {dashboard?.queues.map((queue) => {
                const Icon = queueIcons[queue.name];
                return (
                  <div key={queue.name} className="surface-panel p-3">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <StatusLed status={ledForStatus(queue.status)} pulse={queue.active > 0} />
                        <Icon className="h-4 w-4 text-text-muted" />
                        <div>
                          <p className="text-sm font-medium">{queue.name}</p>
                          <p className="text-text-muted text-xs mt-1">{queue.description}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleRun(queue.name)}
                        disabled={runningQueue === queue.name}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Run
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: "Active", value: queue.active, highlight: queue.active > 0 },
                        { label: "Wait", value: queue.waiting, highlight: queue.waiting > 0 },
                        { label: "Done", value: queue.completed, highlight: false },
                        { label: "Fail", value: queue.failed, highlight: queue.failed > 0 },
                      ].map((stat) => (
                        <div key={stat.label}>
                          <p className="text-[0.6rem] text-text-disabled uppercase tracking-wider">
                            {stat.label}
                          </p>
                          <p
                            className={cn(
                              "text-mono-tabular text-sm font-semibold",
                              stat.label === "Fail" && stat.highlight
                                ? "text-error-text"
                                : stat.highlight
                                  ? "text-accent-400"
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
                <div className="surface-panel p-4 text-text-muted text-sm">Loading queue state...</div>
              )}
            </div>
          </section>

          <section>
            <h4 className="text-kicker mb-3">System</h4>
            <div className="surface-panel p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Cpu className="h-4 w-4 text-text-muted" />
                <Meter
                  label="Active jobs"
                  value={dashboard?.activeJobs.length ?? 0}
                  max={Math.max(1, dashboard?.activeJobs.length ?? 1)}
                  showValue
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-3">
                <HardDrive className="h-4 w-4 text-text-muted" />
                <Meter
                  label="Failed recent jobs"
                  value={failedJobs.length}
                  max={Math.max(1, (dashboard?.recentJobs.length ?? 0) || 1)}
                  showValue
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2 text-mono-sm text-text-muted">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Last scan: {formatStamp(dashboard?.lastScanAt ?? null)}
                </span>
              </div>
              <div className="surface-well px-3 py-2 text-xs text-text-muted">
                Auto scan {dashboard?.schedule.enabled ? "enabled" : "disabled"}
                {dashboard ? ` every ${dashboard.schedule.intervalMinutes} minutes.` : "."}
              </div>
            </div>
          </section>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-kicker">Active Jobs</h4>
              <span className="text-mono-sm text-text-muted">
                {dashboard?.activeJobs.length ?? 0} in flight
              </span>
            </div>
            <div className="space-y-2">
              {dashboard?.activeJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
              {dashboard && dashboard.activeJobs.length === 0 && (
                <div className="surface-panel p-5 text-center text-text-muted text-sm">
                  No active or queued jobs right now.
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-kicker">Recent Runs</h4>
              <span className="text-mono-sm text-text-muted">
                {dashboard?.recentJobs.length ?? 0} jobs in view
              </span>
            </div>
            <div className="surface-panel overflow-hidden">
              <div className="grid grid-cols-[1.3fr_0.8fr_0.8fr_0.6fr] gap-3 px-4 py-3 text-[0.62rem] uppercase tracking-[0.14em] text-text-disabled border-b border-border-subtle">
                <span>Target</span>
                <span>Queue</span>
                <span>Status</span>
                <span>Progress</span>
              </div>
              <div className="divide-y divide-border-subtle/60">
                {dashboard?.recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="grid grid-cols-[1.3fr_0.8fr_0.8fr_0.6fr] gap-3 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium truncate">{job.targetLabel ?? "Queued work"}</p>
                      <p className="text-mono-sm text-text-muted truncate">
                        {job.finishedAt ? formatStamp(job.finishedAt) : formatStamp(job.createdAt)}
                      </p>
                    </div>
                    <div className="text-text-secondary text-xs flex items-center">
                      <Badge variant="accent">{job.queueName}</Badge>
                    </div>
                    <div className="flex items-center">
                      <span
                        className={cn(
                          "text-xs font-medium uppercase tracking-[0.12em]",
                          job.status === "failed"
                            ? "text-error-text"
                            : job.status === "completed"
                              ? "text-success-text"
                              : "text-accent-400"
                        )}
                      >
                        {job.status}
                      </span>
                    </div>
                    <div className="text-mono-tabular text-text-muted flex items-center">
                      {job.progress}%
                    </div>
                    {job.error && (
                      <div className="col-span-4 text-xs text-error-text">{job.error}</div>
                    )}
                  </div>
                ))}
                {!dashboard && loading && (
                  <div className="px-4 py-4 text-text-muted text-sm">Loading recent jobs...</div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function JobCard({ job }: { job: JobRun }) {
  return (
    <div className="surface-panel p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <StatusLed status={job.status === "failed" ? "error" : "active"} pulse={job.status !== "failed"} />
          <div>
            <Badge variant="accent" className="mb-1">
              {job.queueName}
            </Badge>
            <p className="text-mono text-text-secondary">
              {job.targetLabel ?? "Background work"}
            </p>
          </div>
        </div>
        <span className="text-mono-tabular text-text-muted text-xs">
          {formatElapsed(job.startedAt)}
        </span>
      </div>
      <Meter value={job.progress} showValue />
    </div>
  );
}
