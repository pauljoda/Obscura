import type { PageServerLoad } from "./$types";
import {
  fetchVideoCards,
  fetchSeries,
  fetchSeriesDetail,
} from "$lib/server/videos";
import { parseNsfwModeCookie } from "$lib/nsfw-cookie";

const PAGE_SIZE = 60;

export const load: PageServerLoad = async ({ cookies, url, depends, fetch }) => {
  depends("video-series");

  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  const seriesParam = url.searchParams.get("series");
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

  const seriesResponse = !seriesParam
    ? await fetchSeries(
        { root: "all", search, limit: 200, nsfw: nsfwMode },
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
  };
};
