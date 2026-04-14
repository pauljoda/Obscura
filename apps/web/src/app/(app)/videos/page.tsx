export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { ScenesPageClient } from "../../../components/routes/scenes-page-client";
import {
  fetchPerformers,
  fetchStudios,
  fetchTags,
  fetchVideoFolderDetail,
  fetchVideoFolders,
  fetchVideoStats,
  fetchVideos,
} from "../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../lib/nsfw-cookie";
import {
  defaultScenesListPrefs,
  scenesListPrefsToFetchParams,
  SCENES_LIST_PREFS_COOKIE,
  parseScenesListPrefs,
} from "../../../lib/scenes-list-prefs";

interface VideosPageProps {
  searchParams?: Promise<{ folder?: string }>;
}

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);
  const listPrefs =
    parseScenesListPrefs(cookieStore.get(SCENES_LIST_PREFS_COOKIE)?.value) ??
    defaultScenesListPrefs();
  const sceneFetchParams = scenesListPrefsToFetchParams(listPrefs, nsfwMode);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedFolderId =
    typeof resolvedSearchParams.folder === "string"
      ? resolvedSearchParams.folder
      : undefined;
  const hasFolderScopedSceneQuery =
    Boolean(sceneFetchParams.search) || listPrefs.activeFilters.length > 0;
  const activeFolder =
    listPrefs.viewMode === "folders" && requestedFolderId
      ? await fetchVideoFolderDetail(requestedFolderId, { nsfw: nsfwMode }).catch(
          () => null,
        )
      : null;

  const [
    rootFoldersResponse,
    videosResponse,
    stats,
    studiosResponse,
    tagsResponse,
    performersResponse,
  ] = await Promise.all([
    listPrefs.viewMode === "folders" && !activeFolder
      ? fetchVideoFolders({
          search: sceneFetchParams.search,
          root: sceneFetchParams.search ? "all" : undefined,
          limit: 200,
          nsfw: nsfwMode,
        }).catch(() => ({ items: [], total: 0, limit: 200, offset: 0 }))
      : Promise.resolve({ items: [], total: 0, limit: 0, offset: 0 }),
    fetchVideos(
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
    fetchVideoStats(nsfwMode).catch(() => null),
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
      initialScenes={videosResponse.scenes}
      initialStats={stats}
      initialStudios={studiosResponse.studios}
      initialTags={tagsResponse.tags}
      initialPerformers={performersResponse.performers}
      initialTotal={videosResponse.total}
      initialListPrefs={listPrefs}
      initialRootFolders={rootFoldersResponse.items}
      initialActiveFolder={activeFolder}
    />
  );
}
