export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { ScenesPageClient } from "../../../components/routes/scenes-page-client";
import {
  fetchPerformers,
  fetchSceneFolderDetail,
  fetchSceneFolders,
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

interface ScenesPageProps {
  searchParams?: Promise<{ folder?: string }>;
}

export default async function ScenesPage({ searchParams }: ScenesPageProps) {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);
  const listPrefs =
    parseScenesListPrefs(cookieStore.get(SCENES_LIST_PREFS_COOKIE)?.value) ?? defaultScenesListPrefs();
  const sceneFetchParams = scenesListPrefsToFetchParams(listPrefs, nsfwMode);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedFolderId =
    typeof resolvedSearchParams.folder === "string" ? resolvedSearchParams.folder : undefined;
  const hasFolderScopedSceneQuery =
    Boolean(sceneFetchParams.search) || listPrefs.activeFilters.length > 0;
  const activeFolder =
    listPrefs.viewMode === "folders" && requestedFolderId
      ? await fetchSceneFolderDetail(requestedFolderId, { nsfw: nsfwMode }).catch(() => null)
      : null;

  const [rootFoldersResponse, scenesResponse, stats, studiosResponse, tagsResponse, performersResponse] =
    await Promise.all([
      listPrefs.viewMode === "folders" && !activeFolder
        ? fetchSceneFolders({
            search: sceneFetchParams.search,
            root: sceneFetchParams.search ? "all" : undefined,
            limit: 200,
            nsfw: nsfwMode,
          }).catch(() => ({ items: [], total: 0, limit: 200, offset: 0 }))
        : Promise.resolve({ items: [], total: 0, limit: 0, offset: 0 }),
      fetchScenes(
        listPrefs.viewMode === "folders"
          ? activeFolder
            ? {
                ...sceneFetchParams,
                sceneFolderId: activeFolder.id,
                folderScope: hasFolderScopedSceneQuery ? "subtree" : "direct",
              }
            : {
                ...sceneFetchParams,
                uncategorized: true,
              }
          : sceneFetchParams,
      ),
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
      initialRootFolders={rootFoldersResponse.items}
      initialActiveFolder={activeFolder}
    />
  );
}
