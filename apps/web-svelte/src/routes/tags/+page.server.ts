import type { PageServerLoad } from "./$types";
import { fetchTags } from "$lib/v1/server/media-v1";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { loadFormFactorUiPrefObjects } from "$lib/v1/server/ui-prefs-v1";

const PAGE_SIZE = 120;

function optionalNumber(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const load: PageServerLoad = async ({ cookies, url, depends, fetch }) => {
  depends("tags");

  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  const sortRaw = url.searchParams.get("sort");
  const sort =
    sortRaw === "name" || sortRaw === "rating" || sortRaw === "randomized"
      ? sortRaw
      : "videos";
  const orderRaw = url.searchParams.get("order");
  const order: "asc" | "desc" =
    orderRaw === "asc" || orderRaw === "desc"
      ? orderRaw
      : sort === "name"
        ? "asc"
        : "desc";
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const search = url.searchParams.get("search") ?? undefined;

  const response = await fetchTags(
    {
      search,
      sort,
      order,
      favorite: url.searchParams.get("favorite") ?? undefined,
      hasImage: url.searchParams.get("hasImage") ?? undefined,
      ratingMin: optionalNumber(url.searchParams.get("ratingMin")),
      nsfw: nsfwMode,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    },
    { fetch },
  ).catch(() => ({
    tags: [],
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  }));

  return {
    tags: response.tags,
    total: response.total,
    page,
    pageSize: PAGE_SIZE,
    search: search ?? "",
    sort,
    order,
    nsfwMode,
    surfacePrefs: await loadFormFactorUiPrefObjects("surface:tags", {}, ":prefs"),
  };
};
