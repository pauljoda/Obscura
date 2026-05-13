import type { PageServerLoad } from "./$types";
import { fetchGalleries } from "$lib/v1/server/media-v1";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import {
  loadFormFactorUiPrefObjects,
  loadUiPrefObject,
} from "$lib/v1/server/ui-prefs-v1";

const PAGE_SIZE = 60;

export const load: PageServerLoad = async ({ cookies, url, depends, fetch }) => {
  depends("galleries");
  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  const search = url.searchParams.get("search") ?? undefined;
  const sort = url.searchParams.get("sort") ?? "recent";
  const orderRaw = url.searchParams.get("order");
  const order: "asc" | "desc" = orderRaw === "asc" || orderRaw === "desc" ? orderRaw : "desc";
  const viewRaw = url.searchParams.get("view");
  const view: "grid" | "list" = viewRaw === "list" ? "list" : "grid";
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const response = await fetchGalleries(
    {
      search,
      sort,
      order,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      nsfw: nsfwMode,
    },
    { fetch },
  ).catch(() => ({ galleries: [], total: 0, limit: PAGE_SIZE, offset: 0 }));

  return {
    galleries: response.galleries,
    total: response.total,
    page,
    pageSize: PAGE_SIZE,
    search: search ?? "",
    sort,
    order,
    view,
    nsfwMode,
    surfacePrefs: await loadFormFactorUiPrefObjects("surface:galleries", {}, ":prefs"),
    viewPrefs: await loadUiPrefObject("galleries:view", { cols: 2 }),
  };
};
