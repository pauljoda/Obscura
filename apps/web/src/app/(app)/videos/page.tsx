import { cookies } from "next/headers";
import { VideosPageClient } from "../../../components/routes/videos-page-client";
import {
  fetchVideoCards,
  fetchSeriesDetail,
  fetchSeries,
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
  const activeSeriesPromise =
    listPrefs.viewMode === "series" && requestedSeriesId
      ? fetchSeriesDetail(requestedSeriesId, { nsfw: nsfwMode }).catch(
          () => null,
        )
      : Promise.resolve(null);
  const rootSeriesPromise =
    listPrefs.viewMode === "series" && !requestedSeriesId
      ? fetchSeries({
          search: videoFetchParams.search,
          root: videoFetchParams.search ? "all" : undefined,
          limit: 200,
          nsfw: nsfwMode,
        }).catch(() => ({ items: [], total: 0, limit: 200, offset: 0 }))
      : Promise.resolve({ items: [], total: 0, limit: 0, offset: 0 });
  const videosPromise = fetchVideoCards(
    listPrefs.viewMode === "series"
      ? requestedSeriesId
        ? {
            ...videoFetchParams,
            videoSeriesId: requestedSeriesId,
            seriesScope: hasSeriesScopedVideoQuery ? "subtree" : "direct",
          }
        : {
            ...videoFetchParams,
            uncategorized: true,
          }
      : videoFetchParams,
  );
  const activeSeries = await activeSeriesPromise;

  const [rootSeriesResponse, videosResponse] = await Promise.all([
    rootSeriesPromise,
    videosPromise,
  ]);

  return (
    <VideosPageClient
      initialVideos={videosResponse.videos}
      initialStats={null}
      initialStudios={[]}
      initialTags={[]}
      initialPerformers={[]}
      initialTotal={videosResponse.total}
      initialListPrefs={listPrefs}
      initialRootSeries={rootSeriesResponse.items}
      initialActiveSeries={activeSeries}
    />
  );
}
