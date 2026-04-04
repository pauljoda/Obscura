"use client";

import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  Circle,
  Clock,
  Loader2,
} from "lucide-react";
import type { JobRun } from "../../lib/api";
import { formatQueueName, formatRelativeTime } from "./dashboard-utils";

function RecentJobRow({ job }: { job: JobRun }) {
  const isSuccess = job.status === "completed";
  const isError = job.status === "failed";
  const isActive = job.status === "active";

  return (
    <div className="group flex items-center gap-3 px-4 py-3 transition-colors duration-fast hover:bg-surface-3/35">
      <span className="flex-shrink-0">
        {isSuccess ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-success-text drop-shadow-[0_0_6px_rgba(90,150,112,0.35)]" />
        ) : isError ? (
          <AlertCircle className="h-3.5 w-3.5 text-error-text drop-shadow-[0_0_6px_rgba(179,79,86,0.35)]" />
        ) : isActive ? (
          <Loader2 className="h-3.5 w-3.5 text-text-accent animate-spin" />
        ) : (
          <Circle className="h-3.5 w-3.5 text-text-disabled" />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-text-secondary">
          {formatQueueName(job.queueName)}
        </span>
        {job.targetLabel && (
          <span className="text-text-muted text-sm ml-1.5 truncate">
            — {job.targetLabel}
          </span>
        )}
      </div>
      <span className="glass-chip rounded-sm px-2 py-0.5 text-mono-sm text-text-secondary flex-shrink-0 border border-white/5">
        {job.finishedAt
          ? formatRelativeTime(job.finishedAt)
          : job.startedAt
            ? formatRelativeTime(job.startedAt)
            : formatRelativeTime(job.createdAt)}
      </span>
    </div>
  );
}

export function DashboardRecentActivity({
  loading,
  jobs,
}: {
  loading: boolean;
  jobs: JobRun[] | null | undefined;
}) {
  const list = jobs?.slice(0, 8) ?? [];

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold tracking-tight font-heading">Jobs</h2>
        <Link
          href="/jobs"
          className="text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast font-medium"
        >
          All →
        </Link>
      </div>

      {loading ? (
        <div className="surface-card-sharp no-lift flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 text-text-accent animate-spin" />
        </div>
      ) : list.length > 0 ? (
        <div className="surface-card-sharp no-lift overflow-hidden divide-y divide-border-subtle">
          {list.map((job) => (
            <RecentJobRow key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <div className="surface-card-sharp no-lift flex flex-col items-center justify-center p-10 text-center">
          <Clock className="h-9 w-9 text-text-disabled mb-2 opacity-80" />
          <p className="text-text-muted text-sm">No jobs yet.</p>
          <Link
            href="/settings"
            className="mt-3 text-text-accent text-xs font-medium hover:text-text-accent-bright transition-colors duration-fast"
          >
            Settings →
          </Link>
        </div>
      )}
    </section>
  );
}
