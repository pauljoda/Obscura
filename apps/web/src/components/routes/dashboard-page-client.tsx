"use client";

import { useEffect, useState } from "react";
import { DashboardHero } from "../dashboard/dashboard-hero";
import { DashboardQueueRack } from "../dashboard/dashboard-queue-rack";
import { DashboardRecentAdditions } from "../dashboard/dashboard-recent-additions";
import { DashboardRecentActivity } from "../dashboard/dashboard-recent-activity";
import { DashboardQuickNav } from "../dashboard/dashboard-quick-nav";
import { useNsfw } from "../nsfw/nsfw-context";
import {
  fetchSceneStats,
  type GalleryListItem,
  type JobsDashboard,
  type SceneListItem,
  type SceneStats,
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
  stats: initialStats,
}: DashboardPageClientProps) {
  const { mode } = useNsfw();
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    setStats(initialStats);
  }, [initialStats]);

  // Refetch when NSFW mode changes (including LAN auto-enable vs SSR cookie default).
  useEffect(() => {
    void fetchSceneStats(mode)
      .then(setStats)
      .catch(() => {});
  }, [mode]);

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
