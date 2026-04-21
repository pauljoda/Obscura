import type { PageServerLoad } from "./$types";
import {
  fetchVideoCards,
  fetchSeries,
  fetchSeriesDetail,
} from "$lib/server/videos";
import { parseNsfwModeCookie } from "$lib/nsfw-cookie";

const PAGE_SIZE = 60;

export const load: PageServerLoad = async ({ cookies, url, depends, fetch }) => {
  depends("videos");

  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));

  const seriesParam = url.searchParams.get("series");
  const seasonRaw = url.searchParams.get("season");
  const seasonNumber =
    seasonRaw != null && /^\d+$/.test(seasonRaw) ? seasonRaw : undefined;
  const search = url.searchParams.get("search") ?? undefined;
  // When drilling into a series the default sort flips to episode-asc so
  // the first-season-first-episode ordering is correct without the user
  // having to pick it manually. Matches the React page's reset-on-enter
  // behaviour.
  const defaultSort = seriesParam ? "episode" : "recent";
  const sort = url.searchParams.get("sort") ?? defaultSort;
  const orderRaw = url.searchParams.get("order");
  const defaultOrder: "asc" | "desc" = seriesParam ? "asc" : "desc";
  const order: "asc" | "desc" =
    orderRaw === "asc" || orderRaw === "desc" ? orderRaw : defaultOrder;
  const viewRaw = url.searchParams.get("view");
  const view: "grid" | "list" | "series" =
    viewRaw === "list" ? "list" : viewRaw === "series" ? "series" : "grid";
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  // In series view at root (no `?series=`), fetch the root-level series
  // grid alongside the regular video list — React's /videos series view
  // renders both `Series` and `Videos` sections stacked.
  const fetchSeriesList = view === "series" && !seriesParam;
  // When a series is active AND we're in series view, fetch its detail
  // (hero metadata + child series + seasons) along with the videos.
  const fetchSeriesActive = view === "series" && !!seriesParam;
  // Child series for the active series drill-down.
  const fetchChildSeries = fetchSeriesActive;

  const [response, seriesResponse, activeSeries, childSeriesResponse] =
    await Promise.all([
      fetchVideoCards(
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
      ).catch(() => ({ videos: [], total: 0, limit: PAGE_SIZE, offset: 0 })),
      fetchSeriesList
        ? fetchSeries(
            { root: "all", search, limit: 200, nsfw: nsfwMode },
            { fetch },
          ).catch(() => ({ items: [], total: 0, limit: 200, offset: 0 }))
        : Promise.resolve({ items: [], total: 0, limit: 200, offset: 0 }),
      fetchSeriesActive && seriesParam
        ? fetchSeriesDetail(seriesParam, { nsfw: nsfwMode }, { fetch }).catch(
            () => null,
          )
        : Promise.resolve(null),
      fetchChildSeries && seriesParam
        ? fetchSeries(
            { parent: seriesParam, limit: 200, nsfw: nsfwMode },
            { fetch },
          ).catch(() => ({ items: [], total: 0, limit: 200, offset: 0 }))
        : Promise.resolve({ items: [], total: 0, limit: 200, offset: 0 }),
    ]);

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
