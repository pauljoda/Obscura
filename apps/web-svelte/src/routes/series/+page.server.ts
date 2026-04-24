import type { PageServerLoad } from "./$types";
import { getUiPrefRead } from "@obscura/app-core";
import {
  fetchVideoCards,
  fetchSeries,
  fetchSeriesDetail,
} from "$lib/server/videos";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import {
  SERIES_LIST_PREFS_KEY,
  defaultSeriesListPrefs,
  validateSeriesListPrefs,
  seriesListPrefsToFetchParams,
} from "$lib/prefs/series-list-prefs";
import { getWebDb } from "$lib/server/db";
import { serverFetch } from "$lib/server/core";
import { loadUiPrefObject } from "$lib/server/ui-prefs";
import type { PerformerItem, StudioItem, TagItem } from "$lib/api/types";

const PAGE_SIZE = 60;

export const load: PageServerLoad = async ({ cookies, url, depends, fetch }) => {
  depends("video-series");

  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  const seriesParam = url.searchParams.get("series");
  const db = await getWebDb();
  const prefsRow = await getUiPrefRead(db, SERIES_LIST_PREFS_KEY).catch(() => null);
  const parsedPrefs =
    validateSeriesListPrefs(prefsRow?.value) ?? defaultSeriesListPrefs();
  const rootSort = url.searchParams.get("sort");
  const rootOrder = url.searchParams.get("order");
  const useUrlPrefs = !seriesParam && !prefsRow;
  const prefs = !useUrlPrefs
    ? parsedPrefs
    : {
        ...parsedPrefs,
        search: url.searchParams.get("search") ?? parsedPrefs.search,
        sortBy:
          rootSort === "recent" ||
          rootSort === "title" ||
          rootSort === "date" ||
          rootSort === "rating" ||
          rootSort === "videos"
            ? rootSort
            : parsedPrefs.sortBy,
        sortDir:
          rootOrder === "asc" || rootOrder === "desc"
            ? rootOrder
            : parsedPrefs.sortDir,
      };
  const seasonRaw = url.searchParams.get("season");
  const seasonNumber =
    seasonRaw != null && /^\d+$/.test(seasonRaw) ? seasonRaw : undefined;
  const search = url.searchParams.get("search") ?? undefined;
  const defaultSort = seriesParam ? "episode" : "recent";
  const sort = url.searchParams.get("sort") ?? defaultSort;
  const orderRaw = url.searchParams.get("order");
  const defaultOrder: "asc" | "desc" = seriesParam ? "asc" : "desc";
  const order: "asc" | "desc" =
    orderRaw === "asc" || orderRaw === "desc" ? orderRaw : defaultOrder;
  const viewRaw = url.searchParams.get("view");
  const view: "grid" | "list" = viewRaw === "list" ? "list" : "grid";
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const seriesFetchParams = seriesListPrefsToFetchParams(prefs, nsfwMode);

  const seriesResponse = !seriesParam
    ? await fetchSeries(
        {
          ...seriesFetchParams,
          root: "all",
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        },
        { fetch },
      ).catch(() => ({ items: [], total: 0, limit: 200, offset: 0 }))
    : { items: [], total: 0, limit: 200, offset: 0 };

  const activeSeries = seriesParam
    ? await fetchSeriesDetail(seriesParam, { nsfw: nsfwMode }, { fetch }).catch(
        () => null,
      )
    : null;

  const childSeriesResponse = seriesParam
    ? await fetchSeries(
        { parent: seriesParam, search, limit: 200, nsfw: nsfwMode },
        { fetch },
      ).catch(() => ({ items: [], total: 0, limit: 200, offset: 0 }))
    : { items: [], total: 0, limit: 200, offset: 0 };

  const shouldFetchVideos =
    activeSeries != null &&
    (activeSeries.renderingMode === "flat" || seasonNumber != null);

  const response = shouldFetchVideos
    ? await fetchVideoCards(
        {
          search,
          sort,
          order,
          videoSeriesId: seriesParam ?? undefined,
          seasonNumber,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          nsfw: nsfwMode,
        },
        { fetch },
      ).catch(() => ({ videos: [], total: 0, limit: PAGE_SIZE, offset: 0 }))
    : { videos: [], total: 0, limit: PAGE_SIZE, offset: 0 };

  const filterQs = nsfwMode ? `?nsfw=${nsfwMode}` : "";
  const performersQs = nsfwMode
    ? `?nsfw=${nsfwMode}&sort=videos&order=desc&limit=200`
    : "?sort=videos&order=desc&limit=200";
  const studiosPromise = serverFetch<{ studios: StudioItem[] }>(
    `/studios${filterQs}`,
    { fetch },
  )
    .then((r) => r.studios)
    .catch(() => [] as StudioItem[]);
  const tagsPromise = serverFetch<{ tags: TagItem[] }>(`/tags${filterQs}`, {
    fetch,
  })
    .then((r) => r.tags)
    .catch(() => [] as TagItem[]);
  const performersPromise = serverFetch<{ performers: PerformerItem[] }>(
    `/performers${performersQs}`,
    { fetch },
  )
    .then((r) => r.performers)
    .catch(() => [] as PerformerItem[]);

  return {
    videos: response.videos,
    total: response.total,
    series: seriesResponse.items,
    seriesTotal: seriesResponse.total,
    activeSeries,
    childSeries: childSeriesResponse.items,
    page,
    pageSize: PAGE_SIZE,
    seriesId: seriesParam ?? null,
    activeSeasonNumber: seasonNumber != null ? Number(seasonNumber) : null,
    search: search ?? "",
    sort,
    order,
    view,
    nsfwMode,
    prefs,
    viewPrefs: await loadUiPrefObject("series:view", { cols: 5 }),
    streamed: {
      studios: studiosPromise,
      tags: tagsPromise,
      performers: performersPromise,
    },
  };
};
