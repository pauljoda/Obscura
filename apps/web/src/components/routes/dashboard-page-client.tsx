"use client";

import { Film, Clock, HardDrive, TrendingUp } from "lucide-react";
import { DashboardHero } from "../dashboard/dashboard-hero";
import { DashboardStatTile } from "../dashboard/dashboard-stat-tile";
import { DashboardQueueRack } from "../dashboard/dashboard-queue-rack";
import { DashboardRecentAdditions } from "../dashboard/dashboard-recent-additions";
import { DashboardRecentActivity } from "../dashboard/dashboard-recent-activity";
import { DashboardQuickNav } from "../dashboard/dashboard-quick-nav";
import { DASHBOARD_STAT_GRADIENTS } from "../dashboard/dashboard-utils";
import type {
  GalleryListItem,
  JobsDashboard,
  SceneListItem,
  SceneStats,
} from "../../lib/api";

interface DashboardPageClientProps {
  jobs: JobsDashboard | null;
  recentGalleries: GalleryListItem[];
  recentScenes: SceneListItem[];
  stats: SceneStats | null;
}

export function DashboardPageClient({
  jobs,
  recentGalleries,
  recentScenes,
  stats,
}: DashboardPageClientProps) {
  const loading = false;

  return (
    <div className="space-y-7">
      <DashboardHero
        loading={loading}
        sceneCount={stats?.totalScenes ?? null}
        scheduleEnabled={jobs?.schedule.enabled ?? false}
        intervalMinutes={jobs?.schedule.intervalMinutes ?? 0}
        queueCount={jobs?.queues.length ?? 0}
      />

      <section aria-label="Library totals">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <DashboardStatTile
            icon={<Film className="h-3.5 w-3.5" />}
            label="Scenes"
            value={String(stats?.totalScenes ?? 0)}
            gradientClass={DASHBOARD_STAT_GRADIENTS[0]}
          />
          <DashboardStatTile
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Total duration"
            value={stats?.totalDurationFormatted ?? "—"}
            gradientClass={DASHBOARD_STAT_GRADIENTS[1]}
          />
          <DashboardStatTile
            icon={<HardDrive className="h-3.5 w-3.5" />}
            label="Storage"
            value={stats?.totalSizeFormatted ?? "—"}
            gradientClass={DASHBOARD_STAT_GRADIENTS[2]}
          />
          <DashboardStatTile
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="This week"
            value={`+${stats?.recentCount ?? 0} new`}
            accent
            gradientClass={DASHBOARD_STAT_GRADIENTS[3]}
          />
        </div>
      </section>

      <DashboardRecentAdditions
        loading={loading}
        scenes={recentScenes}
        galleries={recentGalleries}
      />

      {jobs && jobs.queues.length > 0 ? (
        <DashboardQueueRack queues={jobs.queues} />
      ) : null}

      <DashboardRecentActivity loading={loading} jobs={jobs?.recentJobs} />

      <DashboardQuickNav sceneCount={stats?.totalScenes} />
    </div>
  );
}
