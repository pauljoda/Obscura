import type { PageServerLoad } from "./$types";
import { fetchVideoCards } from "$lib/server/videos";
import { parseNsfwModeCookie } from "$lib/nsfw-cookie";

const PAGE_SIZE = 60;

export const load: PageServerLoad = async ({ cookies, url, depends, fetch }) => {
  depends("videos");

  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));

  const seriesParam = url.searchParams.get("series");
  const search = url.searchParams.get("search") ?? undefined;
  const sort = url.searchParams.get("sort") ?? undefined;
  const orderRaw = url.searchParams.get("order");
  const order: "asc" | "desc" | undefined =
    orderRaw === "asc" || orderRaw === "desc" ? orderRaw : undefined;
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const response = await fetchVideoCards(
    {
      search,
      sort,
      order,
      videoSeriesId: seriesParam ?? undefined,
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
    series: seriesParam ?? null,
    search: search ?? "",
  };
};
