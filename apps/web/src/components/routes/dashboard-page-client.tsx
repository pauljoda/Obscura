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
    <div className="space-y-8">
      <DashboardHero />

      {/* Top Row: Quick Nav & System Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardQuickNav sceneCount={stats?.totalScenes} />

        <section aria-label="Library totals">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">System Stats</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2.5">
            <DashboardStatTile
              icon={<Film className="h-4 w-4" />}
              label="Scenes"
              value={String(stats?.totalScenes ?? 0)}
              gradientClass={DASHBOARD_STAT_GRADIENTS[0]}
            />
            <DashboardStatTile
              icon={<Clock className="h-4 w-4" />}
              label="Duration"
              value={stats?.totalDurationFormatted ?? "—"}
              gradientClass={DASHBOARD_STAT_GRADIENTS[1]}
            />
            <DashboardStatTile
              icon={<HardDrive className="h-4 w-4" />}
              label="Storage"
              value={stats?.totalSizeFormatted ?? "—"}
              gradientClass={DASHBOARD_STAT_GRADIENTS[2]}
            />
            <DashboardStatTile
              icon={<TrendingUp className="h-4 w-4" />}
              label="This Week"
              value={`+${stats?.recentCount ?? 0}`}
              accent
              gradientClass={DASHBOARD_STAT_GRADIENTS[3]}
            />
          </div>
        </section>
      </div>

      {/* Middle Section: Media Additions */}
      <DashboardRecentAdditions
        loading={loading}
        scenes={recentScenes}
        galleries={recentGalleries}
      />

      {/* Bottom Row: System Activity & Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {jobs && jobs.queues.length > 0 ? (
          <DashboardQueueRack queues={jobs.queues} />
        ) : <div />}

        <DashboardRecentActivity loading={loading} jobs={jobs?.recentJobs} />
      </div>
    </div>
  );
}
