import type { PageServerLoad } from "./$types";
import { fetchPerformers } from "$lib/server/media";
import { parseNsfwModeCookie } from "$lib/nsfw-cookie";
import { loadUiPrefObject } from "$lib/server/ui-prefs";

const PAGE_SIZE = 120;

function optionalNumber(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const load: PageServerLoad = async ({ cookies, url, depends, fetch }) => {
  depends("performers");
  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  const sortRaw = url.searchParams.get("sort");
  const sort =
    sortRaw === "recent" || sortRaw === "rating" || sortRaw === "name"
      ? sortRaw
      : "name";
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

  const params = {
    search,
    sort,
    order,
    gender: url.searchParams.get("gender") ?? undefined,
    favorite: url.searchParams.get("favorite") ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
    hasImage: url.searchParams.get("hasImage") ?? undefined,
    ratingMin: optionalNumber(url.searchParams.get("ratingMin")),
    ratingMax: optionalNumber(url.searchParams.get("ratingMax")),
    counts: "false",
    nsfw: nsfwMode,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const response = await fetchPerformers(params, { fetch }).catch(() => ({
    performers: [],
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  }));

  return {
    performers: response.performers,
    total: response.total,
    page,
    pageSize: PAGE_SIZE,
    search: search ?? "",
    sort,
    order,
    nsfwMode,
    viewPrefs: await loadUiPrefObject("performers:view", { cols: 5 }),
  };
};
