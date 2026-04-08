export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { DashboardPageClient } from "../../components/routes/dashboard-page-client";
import {
  fetchGalleries,
  fetchJobsDashboard,
  fetchSceneStats,
  fetchScenes,
  type GalleryListItem,
  type JobsDashboard,
  type SceneListItem,
  type SceneStats,
} from "../../lib/server-api";
import { parseNsfwModeCookie } from "../../lib/nsfw-cookie";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);

  const [stats, jobs, scenesResponse, galleriesResponse] = await Promise.all([
    fetchSceneStats(nsfwMode).catch(() => null as SceneStats | null),
    fetchJobsDashboard().catch(() => null as JobsDashboard | null),
    fetchScenes({ sort: "recent", order: "desc", limit: 16, nsfw: nsfwMode }).catch(() => ({
      scenes: [] as SceneListItem[],
      total: 0,
      limit: 0,
      offset: 0,
    })),
    fetchGalleries({ limit: 16 }).catch(() => ({
      galleries: [] as GalleryListItem[],
      total: 0,
    })),
  ]);

  return (
    <DashboardPageClient
      jobs={jobs}
      recentGalleries={galleriesResponse.galleries}
      recentScenes={scenesResponse.scenes}
      stats={stats}
    />
  );
}
