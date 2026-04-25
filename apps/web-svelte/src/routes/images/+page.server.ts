import type { PageServerLoad } from "./$types";
import { fetchImages } from "$lib/server/media";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { loadUiPrefObject } from "$lib/server/ui-prefs";

const PAGE_SIZE = 120;

export const load: PageServerLoad = async ({ cookies, url, depends, fetch }) => {
  depends("images");
  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  const search = url.searchParams.get("search") ?? undefined;
  const sort = url.searchParams.get("sort") ?? "recent";
  const orderRaw = url.searchParams.get("order");
  const order: "asc" | "desc" = orderRaw === "asc" || orderRaw === "desc" ? orderRaw : "desc";
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const response = await fetchImages(
    { search, sort, order, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, nsfw: nsfwMode },
    { fetch },
  ).catch(() => ({ images: [], total: 0, limit: PAGE_SIZE, offset: 0 }));

  return {
    images: response.images,
    total: response.total,
    page,
    pageSize: PAGE_SIZE,
    search: search ?? "",
    sort,
    order,
    nsfwMode,
    viewPrefs: await loadUiPrefObject("images:view", { cols: 8 }),
  };
};
