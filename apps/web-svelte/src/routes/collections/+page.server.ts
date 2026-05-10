import type { PageServerLoad } from "./$types";
import { fetchCollections } from "$lib/server/media";
import {
  loadFormFactorUiPrefObjects,
  loadUiPrefObject,
} from "$lib/server/ui-prefs";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";

const PAGE_SIZE = 60;

export const load: PageServerLoad = async ({ cookies, url, depends, fetch }) => {
  depends("collections");
  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  const search = url.searchParams.get("search") ?? undefined;
  const sort = url.searchParams.get("sort") ?? "recent";
  const orderRaw = url.searchParams.get("order");
  const order: "asc" | "desc" = orderRaw === "asc" || orderRaw === "desc" ? orderRaw : "desc";
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const response = await fetchCollections(
    {
      search,
      sort,
      order,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      nsfw: nsfwMode === "off" ? "off" : undefined,
    },
    { fetch },
  ).catch(() => ({ items: [], total: 0, limit: PAGE_SIZE, offset: 0 }));

  return {
    collections: response.items,
    total: response.total,
    page,
    pageSize: PAGE_SIZE,
    search: search ?? "",
    sort,
    order,
    nsfwMode,
    surfacePrefs: await loadFormFactorUiPrefObjects("surface:collections", {}, ":prefs"),
    viewPrefs: await loadUiPrefObject("collections:view", { cols: 2 }),
  };
};
