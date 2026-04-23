import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { fetchVideoCards } from "$lib/server/videos";
import { parseNsfwModeCookie } from "$lib/nsfw-cookie";

const PAGE_SIZE = 60;

export const load: PageServerLoad = async ({ cookies, url, depends, fetch }) => {
  depends("videos");

  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));

  const seriesParam = url.searchParams.get("series");
  const viewRaw = url.searchParams.get("view");
  if (seriesParam || viewRaw === "series") {
    const params = new URLSearchParams(url.searchParams);
    params.delete("view");
    const qs = params.toString();
    throw redirect(307, qs ? `/series?${qs}` : "/series");
  }
  const seasonRaw = url.searchParams.get("season");
  const seasonNumber =
    seasonRaw != null && /^\d+$/.test(seasonRaw) ? seasonRaw : undefined;
  const search = url.searchParams.get("search") ?? undefined;
  const defaultSort = "recent";
  const sort = url.searchParams.get("sort") ?? defaultSort;
  const orderRaw = url.searchParams.get("order");
  const defaultOrder: "asc" | "desc" = "desc";
  const order: "asc" | "desc" =
    orderRaw === "asc" || orderRaw === "desc" ? orderRaw : defaultOrder;
  const view: "grid" | "list" = viewRaw === "list" ? "list" : "grid";
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const response = await fetchVideoCards(
    {
      search,
      sort,
      order,
      seasonNumber,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      nsfw: nsfwMode,
    },
    { fetch },
  ).catch(() => ({ videos: [], total: 0, limit: PAGE_SIZE, offset: 0 }));

  return {
    videos: response.videos,
    total: response.total,
    page,
    pageSize: PAGE_SIZE,
    search: search ?? "",
    sort,
    order,
    view,
  };
};
