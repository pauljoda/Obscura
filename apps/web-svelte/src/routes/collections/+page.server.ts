import type { PageServerLoad } from "./$types";
import { fetchCollections } from "$lib/server/media";
import { loadUiPrefObject } from "$lib/server/ui-prefs";

const PAGE_SIZE = 60;

export const load: PageServerLoad = async ({ url, depends, fetch }) => {
  depends("collections");
  const search = url.searchParams.get("search") ?? undefined;
  const sort = url.searchParams.get("sort") ?? "recent";
  const orderRaw = url.searchParams.get("order");
  const order: "asc" | "desc" = orderRaw === "asc" || orderRaw === "desc" ? orderRaw : "desc";
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const response = await fetchCollections(
    { search, sort, order, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
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
    viewPrefs: await loadUiPrefObject("collections:view", { cols: 5 }),
  };
};
