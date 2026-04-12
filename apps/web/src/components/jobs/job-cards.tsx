import { Meter } from "@obscura/ui/composed/meter";
import { StatusLed } from "@obscura/ui/composed/status-led";
import { Badge } from "@obscura/ui/primitives/badge";
import { cn } from "@obscura/ui/lib/utils";
import { Square } from "lucide-react";
import type { JobRun } from "../../lib/api";
import {
  displayDescribeTrigger,
  displayJobHeading,
  formatElapsed,
  formatRelativeTime,
  formatStamp,
  isForceRebuildJob,
  jobBadgeVariant,
  maintenanceJobLogRedacted,
  statusLabel,
  toneForJob,
} from "./job-helpers";

function ForceRebuildBadge({ job }: { job: JobRun }) {
  if (!isForceRebuildJob(job)) return null;
  return (
    <Badge variant="error" className="text-[0.56rem]">
      Force rebuild
    </Badge>
  );
}

export function ActiveJobCard({
  job,
  nsfwMode,
  cancellingJobRunId,
  onCancelJob,
}: {
  job: JobRun;
  nsfwMode: string;
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
          <h3 className="mt-2 text-[0.95rem] font-medium text-text-primary">{displayJobHeading(job, nsfwMode)}</h3>
          <p className="mt-1 text-[0.74rem] text-text-muted">{displayDescribeTrigger(job, nsfwMode)}</p>
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

export function FailedJobCard({ job, nsfwMode }: { job: JobRun; nsfwMode: string }) {
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
            <h3 className="mt-2 text-[0.95rem] font-medium text-text-primary">{displayJobHeading(job, nsfwMode)}</h3>
            <p className="mt-1 text-[0.74rem] text-text-muted">{displayDescribeTrigger(job, nsfwMode)}</p>
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
            {maintenanceJobLogRedacted(job, nsfwMode) && job.error
              ? "Error details are hidden."
              : job.error ?? "No error message recorded."}
          </pre>
        </div>
      </div>
    </details>
  );
}

export function CompletedJobRow({ job, nsfwMode }: { job: JobRun; nsfwMode: string }) {
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[1.1fr_0.8fr_0.8fr]">
      <div className="min-w-0">
        <p className="truncate text-[0.84rem] font-medium text-text-primary">{displayJobHeading(job, nsfwMode)}</p>
        <p className="mt-1 truncate text-mono-sm text-text-disabled">{displayDescribeTrigger(job, nsfwMode)}</p>
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

export function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="surface-card no-lift px-4 py-6 text-center">
      <p className="text-sm font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-[0.78rem] text-text-muted">{detail}</p>
    </div>
  );
}
