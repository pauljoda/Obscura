export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { ScenesPageClient } from "../../../components/routes/scenes-page-client";
import {
  fetchSceneStats,
  fetchScenes,
  fetchStudios,
  fetchTags,
} from "../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../lib/nsfw-cookie";

export default async function ScenesPage() {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);

  const [scenesResponse, stats, studiosResponse, tagsResponse] = await Promise.all([
    fetchScenes({ sort: "recent", order: "desc", limit: 50, nsfw: nsfwMode }),
    fetchSceneStats(nsfwMode).catch(() => null),
    fetchStudios({ nsfw: nsfwMode }).catch(() => ({ studios: [] })),
    fetchTags({ nsfw: nsfwMode }).catch(() => ({ tags: [] })),
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
