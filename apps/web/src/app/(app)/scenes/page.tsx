import { ScenesPageClient } from "../../../components/routes/scenes-page-client";
import {
  fetchSceneStats,
  fetchScenes,
  fetchStudios,
  fetchTags,
} from "../../../lib/api";

export default async function ScenesPage() {
  const [scenesResponse, stats, studiosResponse, tagsResponse] = await Promise.all([
    fetchScenes({ sort: "recent", order: "desc", limit: 50 }),
    fetchSceneStats().catch(() => null),
    fetchStudios().catch(() => ({ studios: [] })),
    fetchTags().catch(() => ({ tags: [] })),
  ]);

  return (
    <ScenesPageClient
      initialScenes={scenesResponse.scenes}
      initialStats={stats}
      initialStudios={studiosResponse.studios}
      initialTags={tagsResponse.tags}
      initialTotal={scenesResponse.total}
    />
  );
}
