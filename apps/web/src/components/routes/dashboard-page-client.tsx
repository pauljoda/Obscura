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
      <DashboardHero stats={stats} />

      <DashboardQuickNav sceneCount={stats?.totalScenes} />

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
