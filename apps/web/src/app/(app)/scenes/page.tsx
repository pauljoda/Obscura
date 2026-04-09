export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { ScenesPageClient } from "../../../components/routes/scenes-page-client";
import {
  fetchPerformers,
  fetchSceneStats,
  fetchScenes,
  fetchStudios,
  fetchTags,
} from "../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../lib/nsfw-cookie";
import {
  defaultScenesListPrefs,
  scenesListPrefsToFetchParams,
  SCENES_LIST_PREFS_COOKIE,
  parseScenesListPrefs,
} from "../../../lib/scenes-list-prefs";

export default async function ScenesPage() {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);
  const listPrefs =
    parseScenesListPrefs(cookieStore.get(SCENES_LIST_PREFS_COOKIE)?.value) ?? defaultScenesListPrefs();
  const sceneFetchParams = scenesListPrefsToFetchParams(listPrefs, nsfwMode);

  const [scenesResponse, stats, studiosResponse, tagsResponse, performersResponse] = await Promise.all([
    fetchScenes(sceneFetchParams),
    fetchSceneStats(nsfwMode).catch(() => null),
    fetchStudios({ nsfw: nsfwMode }).catch(() => ({ studios: [] })),
    fetchTags({ nsfw: nsfwMode }).catch(() => ({ tags: [] })),
    fetchPerformers({
      nsfw: nsfwMode,
      sort: "scenes",
      order: "desc",
      limit: 400,
    }).catch(() => ({ performers: [], total: 0, limit: 400, offset: 0 })),
  ]);

  return (
    <ScenesPageClient
      initialScenes={scenesResponse.scenes}
      initialStats={stats}
      initialStudios={studiosResponse.studios}
      initialTags={tagsResponse.tags}
      initialPerformers={performersResponse.performers}
      initialTotal={scenesResponse.total}
      initialListPrefs={listPrefs}
    />
  );
}
