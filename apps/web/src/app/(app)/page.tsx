"use client";

import { useEffect, useState } from "react";
import { Film, Clock, HardDrive, TrendingUp } from "lucide-react";
import {
  fetchSceneStats,
  fetchJobsDashboard,
  fetchScenes,
  fetchGalleries,
  type SceneStats,
  type JobsDashboard,
  type SceneListItem,
  type GalleryListItem,
} from "../../lib/api";
import { DashboardHero } from "../../components/dashboard/dashboard-hero";
import { DashboardStatTile } from "../../components/dashboard/dashboard-stat-tile";
import { DashboardQueueRack } from "../../components/dashboard/dashboard-queue-rack";
import { DashboardRecentAdditions } from "../../components/dashboard/dashboard-recent-additions";
import { DashboardRecentActivity } from "../../components/dashboard/dashboard-recent-activity";
import { DashboardQuickNav } from "../../components/dashboard/dashboard-quick-nav";
import { DASHBOARD_STAT_GRADIENTS } from "../../components/dashboard/dashboard-utils";

export default function DashboardPage() {
  const [stats, setStats] = useState<SceneStats | null>(null);
  const [jobs, setJobs] = useState<JobsDashboard | null>(null);
  const [recentScenes, setRecentScenes] = useState<SceneListItem[]>([]);
  const [recentGalleries, setRecentGalleries] = useState<GalleryListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchSceneStats().catch(() => null),
      fetchJobsDashboard().catch(() => null),
      fetchScenes({ sort: "recent", order: "desc", limit: 16 }).catch(() => ({
        scenes: [] as SceneListItem[],
        total: 0,
        limit: 0,
        offset: 0,
      })),
      fetchGalleries({ limit: 16 }).catch(() => ({ galleries: [] as GalleryListItem[], total: 0 })),
    ]).then(([statsData, jobsData, scenesRes, galleriesRes]) => {
      setStats(statsData);
      setJobs(jobsData);
      setRecentScenes(scenesRes.scenes);
      setRecentGalleries(galleriesRes.galleries);
      setLoading(false);
    });
  }, []);

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

      <DashboardRecentAdditions
        loading={loading}
        scenes={recentScenes}
        galleries={recentGalleries}
      />

      {jobs && jobs.queues.length > 0 && (
        <DashboardQueueRack queues={jobs.queues} />
      )}

      <DashboardRecentActivity loading={loading} jobs={jobs?.recentJobs} />

      <DashboardQuickNav sceneCount={stats?.totalScenes} />
    </div>
  );
}
