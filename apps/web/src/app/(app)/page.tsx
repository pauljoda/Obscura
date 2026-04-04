"use client";

import { useEffect, useState } from "react";
import { Film, Clock, HardDrive, TrendingUp } from "lucide-react";
import {
  fetchSceneStats,
  fetchJobsDashboard,
  type SceneStats,
  type JobsDashboard,
} from "../../lib/api";
import { DashboardHero } from "../../components/dashboard/dashboard-hero";
import { DashboardStatTile } from "../../components/dashboard/dashboard-stat-tile";
import { DashboardStatusChannel } from "../../components/dashboard/dashboard-status-channel";
import { DashboardQueueRack } from "../../components/dashboard/dashboard-queue-rack";
import { DashboardRecentActivity } from "../../components/dashboard/dashboard-recent-activity";
import { DashboardQuickNav } from "../../components/dashboard/dashboard-quick-nav";
import {
  DASHBOARD_STAT_GRADIENTS,
  formatRelativeTime,
} from "../../components/dashboard/dashboard-utils";

const STATUS_BACKDROPS = [
  "gradient-thumb-2",
  "gradient-thumb-4",
  "gradient-thumb-7",
] as const;

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

  const workerLed = loading
    ? "led-idle"
    : hasActiveJobs
      ? "led-active"
      : hasWarnings
        ? "led-warning"
        : "led-idle";
  const workerLabel = loading
    ? "—"
    : hasActiveJobs
      ? "Active"
      : hasWarnings
        ? "Warning"
        : "Idle";
  const workerDetail = loading
    ? "Loading…"
    : hasActiveJobs
      ? `${jobs!.activeJobs.length} job${jobs!.activeJobs.length !== 1 ? "s" : ""} running`
      : hasWarnings
        ? "Queue has failed jobs"
        : "No active jobs";

  const libraryLed = loading
    ? "led-idle"
    : jobs?.lastScanAt
      ? "led-active"
      : "led-idle";
  const libraryLabel = loading ? "—" : jobs?.lastScanAt ? "Scanned" : "Not scanned";
  const libraryDetail = loading
    ? "Loading…"
    : jobs?.lastScanAt
      ? `Last scan ${formatRelativeTime(jobs.lastScanAt)}`
      : "Add library roots in Settings";

  const storageLed = loading
    ? "led-idle"
    : stats?.totalSize
      ? "led-accent"
      : "led-idle";
  const storageLabel = loading ? "—" : (stats?.totalSizeFormatted ?? "—");
  const storageDetail = loading
    ? "Loading…"
    : stats?.totalScenes
      ? `${stats.totalScenes} file${stats.totalScenes !== 1 ? "s" : ""} indexed`
      : "No media indexed";

  return (
    <div className="space-y-8">
      <DashboardHero
        loading={loading}
        sceneCount={stats?.totalScenes ?? null}
        scheduleEnabled={jobs?.schedule.enabled ?? false}
        intervalMinutes={jobs?.schedule.intervalMinutes ?? 0}
        queueCount={jobs?.queues.length ?? 0}
      />

      <section>
        <h4 className="text-kicker mb-3">Library metrics</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <DashboardStatTile
            icon={<Film className="h-3.5 w-3.5" />}
            label="Scenes"
            value={loading ? "—" : String(stats?.totalScenes ?? 0)}
            gradientClass={DASHBOARD_STAT_GRADIENTS[0]}
          />
          <DashboardStatTile
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Total duration"
            value={loading ? "—" : (stats?.totalDurationFormatted ?? "—")}
            gradientClass={DASHBOARD_STAT_GRADIENTS[1]}
          />
          <DashboardStatTile
            icon={<HardDrive className="h-3.5 w-3.5" />}
            label="Storage"
            value={loading ? "—" : (stats?.totalSizeFormatted ?? "—")}
            gradientClass={DASHBOARD_STAT_GRADIENTS[2]}
          />
          <DashboardStatTile
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="This week"
            value={loading ? "—" : `+${stats?.recentCount ?? 0} new`}
            accent
            gradientClass={DASHBOARD_STAT_GRADIENTS[3]}
          />
        </div>
      </section>

      <section>
        <h4 className="text-kicker mb-3">System channels</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <DashboardStatusChannel
            section="Workers"
            ledClass={workerLed}
            label={workerLabel}
            detail={workerDetail}
            gradientClass={STATUS_BACKDROPS[0]}
          />
          <DashboardStatusChannel
            section="Library"
            ledClass={libraryLed}
            label={libraryLabel}
            detail={libraryDetail}
            gradientClass={STATUS_BACKDROPS[1]}
          />
          <DashboardStatusChannel
            section="Storage"
            ledClass={storageLed}
            label={storageLabel}
            detail={storageDetail}
            gradientClass={STATUS_BACKDROPS[2]}
          />
        </div>
      </section>

      {jobs && jobs.queues.length > 0 && (
        <DashboardQueueRack queues={jobs.queues} />
      )}

      <DashboardRecentActivity loading={loading} jobs={jobs?.recentJobs} />

      <DashboardQuickNav sceneCount={stats?.totalScenes} />
    </div>
  );
}
