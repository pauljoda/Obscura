"use client";

import { useEffect, useState } from "react";
import {
  Film,
  Clock,
  HardDrive,
  Activity,
  Users,
  Tag,
  Building2,
  TrendingUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Circle,
} from "lucide-react";
import Link from "next/link";
import {
  fetchSceneStats,
  fetchJobsDashboard,
  type SceneStats,
  type JobsDashboard,
  type JobRun,
} from "../../lib/api";

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatQueueName(name: string): string {
  return name
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DashboardPage() {
  const [stats, setStats] = useState<SceneStats | null>(null);
  const [jobs, setJobs] = useState<JobsDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchSceneStats().catch(() => null),
      fetchJobsDashboard().catch(() => null),
    ]).then(([statsData, jobsData]) => {
      setStats(statsData);
      setJobs(jobsData);
      setLoading(false);
    });
  }, []);

  const hasActiveJobs = jobs?.queues.some((q) => q.status === "active") ?? false;
  const hasWarnings = jobs?.queues.some((q) => q.status === "warning") ?? false;

  const workerLed = hasActiveJobs ? "led-active" : hasWarnings ? "led-warning" : "led-idle";
  const workerLabel = hasActiveJobs ? "Active" : hasWarnings ? "Warning" : "Idle";
  const workerDetail = hasActiveJobs
    ? `${jobs!.activeJobs.length} job${jobs!.activeJobs.length !== 1 ? "s" : ""} running`
    : hasWarnings
      ? "Queue has failed jobs"
      : "No active jobs";

  const libraryLed = jobs?.lastScanAt ? "led-active" : "led-idle";
  const libraryLabel = jobs?.lastScanAt ? "Scanned" : "Not scanned";
  const libraryDetail = jobs?.lastScanAt
    ? `Last scan ${formatRelativeTime(jobs.lastScanAt)}`
    : "Add library roots in Settings";

  const storageLed = stats?.totalSize ? "led-active" : "led-idle";
  const storageLabel = stats?.totalSizeFormatted ?? "—";
  const storageDetail = stats?.totalScenes
    ? `${stats.totalScenes} file${stats.totalScenes !== 1 ? "s" : ""} indexed`
    : "No media indexed";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="flex items-center gap-2.5">
          <Activity className="h-5 w-5 text-text-accent" />
          Dashboard
        </h1>
        <p className="mt-1 text-text-muted text-[0.78rem]">
          Library overview and system status
        </p>
      </div>

      {/* Library stats strip */}
      <section>
        <h4 className="text-kicker mb-3">Library</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard
            icon={<Film className="h-3.5 w-3.5" />}
            label="Scenes"
            value={loading ? "—" : String(stats?.totalScenes ?? 0)}
          />
          <StatCard
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Total Duration"
            value={loading ? "—" : (stats?.totalDurationFormatted ?? "—")}
          />
          <StatCard
            icon={<HardDrive className="h-3.5 w-3.5" />}
            label="Storage"
            value={loading ? "—" : (stats?.totalSizeFormatted ?? "—")}
          />
          <StatCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="This Week"
            value={loading ? "—" : `+${stats?.recentCount ?? 0} new`}
            accent
          />
        </div>
      </section>

      {/* System status */}
      <section>
        <h4 className="text-kicker mb-3">System</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatusCard
            section="Workers"
            ledClass={loading ? "led-idle" : workerLed}
            label={loading ? "—" : workerLabel}
            detail={loading ? "Loading…" : workerDetail}
          />
          <StatusCard
            section="Library"
            ledClass={loading ? "led-idle" : libraryLed}
            label={loading ? "—" : libraryLabel}
            detail={loading ? "Loading…" : libraryDetail}
          />
          <StatusCard
            section="Storage"
            ledClass={loading ? "led-idle" : storageLed}
            label={loading ? "—" : storageLabel}
            detail={loading ? "Loading…" : storageDetail}
          />
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-kicker">Recent Activity</h4>
          <Link
            href="/jobs"
            className="text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
          >
            View all jobs →
          </Link>
        </div>
        {loading ? (
          <div className="surface-well p-8 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-text-disabled animate-spin" />
          </div>
        ) : jobs?.recentJobs?.length ? (
          <div className="surface-panel divide-y divide-border-subtle">
            {jobs.recentJobs.slice(0, 8).map((job) => (
              <RecentJobRow key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <div className="surface-well p-8 text-center">
            <Clock className="h-8 w-8 text-text-disabled mx-auto mb-2" />
            <p className="text-text-muted text-sm">
              Activity will appear here once the library is configured and scanned.
            </p>
            <Link
              href="/settings"
              className="text-text-accent text-xs mt-2 inline-block hover:text-text-accent-bright transition-colors duration-fast"
            >
              Configure library →
            </Link>
          </div>
        )}
      </section>

      {/* Quick navigation */}
      <section>
        <h4 className="text-kicker mb-3">Browse</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <QuickLink href="/scenes" icon={<Film className="h-4 w-4" />} label="Scenes" count={stats?.totalScenes} />
          <QuickLink href="/performers" icon={<Users className="h-4 w-4" />} label="Performers" />
          <QuickLink href="/studios" icon={<Building2 className="h-4 w-4" />} label="Studios" />
          <QuickLink href="/tags" icon={<Tag className="h-4 w-4" />} label="Tags" />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "surface-stat-accent px-3 py-2.5" : "surface-stat px-3 py-2.5"}>
      <div
        className={`flex items-center gap-1.5 mb-1 ${accent ? "text-text-accent" : "text-text-disabled"}`}
      >
        {icon}
        <span className="text-kicker" style={{ color: "inherit" }}>
          {label}
        </span>
      </div>
      <div
        className={
          accent
            ? "text-lg font-semibold text-text-accent leading-tight"
            : "text-lg font-semibold text-text-primary leading-tight"
        }
      >
        {value}
      </div>
    </div>
  );
}

function StatusCard({
  section,
  ledClass,
  label,
  detail,
}: {
  section: string;
  ledClass: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="surface-panel p-4">
      <div className="flex items-center gap-3 mb-2">
        <span className={`led ${ledClass}`} />
        <span className="text-label text-text-muted">{section}</span>
      </div>
      <p className="font-heading font-semibold">{label}</p>
      <p className="text-text-muted text-sm mt-1">{detail}</p>
    </div>
  );
}

function RecentJobRow({ job }: { job: JobRun }) {
  const isSuccess = job.status === "completed";
  const isError = job.status === "failed";
  const isActive = job.status === "active";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex-shrink-0">
        {isSuccess ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-success-text" />
        ) : isError ? (
          <AlertCircle className="h-3.5 w-3.5 text-error-text" />
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
      <span className="text-mono-sm text-text-disabled flex-shrink-0">
        {job.finishedAt
          ? formatRelativeTime(job.finishedAt)
          : job.startedAt
            ? formatRelativeTime(job.startedAt)
            : formatRelativeTime(job.createdAt)}
      </span>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
  count,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className="surface-panel p-3 flex items-center gap-3 hover:border-border-accent transition-all duration-fast group"
    >
      <span className="text-text-disabled group-hover:text-text-accent transition-colors duration-fast">
        {icon}
      </span>
      <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors duration-fast">
        {label}
      </span>
      {count !== undefined && (
        <span className="ml-auto text-mono-sm text-text-disabled">
          {count}
        </span>
      )}
    </Link>
  );
}
