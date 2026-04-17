export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { VideosPageClient } from "../../../components/routes/videos-page-client";
import {
  fetchPerformers,
  fetchStudios,
  fetchTags,
  fetchSeriesDetail,
  fetchSeries,
  fetchVideoStats,
  fetchVideos,
} from "../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../lib/nsfw-cookie";
import {
  defaultVideosListPrefs,
  videosListPrefsToFetchParams,
  VIDEOS_LIST_PREFS_COOKIE,
  parseVideosListPrefs,
} from "../../../lib/videos-list-prefs";

interface VideosPageProps {
  searchParams?: Promise<{ series?: string }>;
}

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);
  const listPrefs =
    parseVideosListPrefs(cookieStore.get(VIDEOS_LIST_PREFS_COOKIE)?.value) ??
    defaultVideosListPrefs();
  const videoFetchParams = videosListPrefsToFetchParams(listPrefs, nsfwMode);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedSeriesId =
    typeof resolvedSearchParams.series === "string"
      ? resolvedSearchParams.series
      : undefined;
  const hasSeriesScopedVideoQuery =
    Boolean(videoFetchParams.search) || listPrefs.activeFilters.length > 0;
  const activeSeries =
    listPrefs.viewMode === "series" && requestedSeriesId
      ? await fetchSeriesDetail(requestedSeriesId, { nsfw: nsfwMode }).catch(
          () => null,
        )
      : null;

  const [
    rootSeriesResponse,
    videosResponse,
    stats,
    studiosResponse,
    tagsResponse,
    performersResponse,
  ] = await Promise.all([
    listPrefs.viewMode === "series" && !activeSeries
      ? fetchSeries({
          search: videoFetchParams.search,
          root: videoFetchParams.search ? "all" : undefined,
          limit: 200,
          nsfw: nsfwMode,
        }).catch(() => ({ items: [], total: 0, limit: 200, offset: 0 }))
      : Promise.resolve({ items: [], total: 0, limit: 0, offset: 0 }),
    fetchVideos(
      listPrefs.viewMode === "series"
        ? activeSeries
          ? {
              ...videoFetchParams,
              videoSeriesId: activeSeries.id,
              seriesScope: hasSeriesScopedVideoQuery ? "subtree" : "direct",
            }
          : {
              ...videoFetchParams,
              uncategorized: true,
            }
        : videoFetchParams,
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
    <VideosPageClient
      initialVideos={videosResponse.videos}
      initialStats={stats}
      initialStudios={studiosResponse.studios}
      initialTags={tagsResponse.tags}
      initialPerformers={performersResponse.performers}
      initialTotal={videosResponse.total}
      initialListPrefs={listPrefs}
      initialRootSeries={rootSeriesResponse.items}
      initialActiveSeries={activeSeries}
    />
  );
}
