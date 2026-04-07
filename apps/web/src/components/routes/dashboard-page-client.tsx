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
    <div className="space-y-6">
      <DashboardHero />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Content Column */}
        <div className="xl:col-span-2 space-y-6">
          <DashboardRecentAdditions
            loading={loading}
            scenes={recentScenes}
            galleries={recentGalleries}
          />
          
          <DashboardQuickNav sceneCount={stats?.totalScenes} />
        </div>

        {/* System Status Column */}
        <div className="space-y-6">
          <section aria-label="Library totals">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">System Stats</h2>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
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

          {jobs && jobs.queues.length > 0 ? (
            <DashboardQueueRack queues={jobs.queues} />
          ) : null}

          <DashboardRecentActivity loading={loading} jobs={jobs?.recentJobs} />
        </div>
      </div>
    </div>
  );
}
