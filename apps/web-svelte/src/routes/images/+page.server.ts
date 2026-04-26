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
  const ratingMin = parseNumberParam(url.searchParams.get("ratingMin"));
  const ratingMax = parseNumberParam(url.searchParams.get("ratingMax"));
  const orderRaw = url.searchParams.get("order");
  const order: "asc" | "desc" = orderRaw === "asc" || orderRaw === "desc" ? orderRaw : "desc";
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const response = await fetchImages(
    {
      search,
      sort,
      order,
      studio: url.searchParams.get("studio") ?? undefined,
      tag: url.searchParams.getAll("tag"),
      performer: url.searchParams.getAll("performer"),
      format: url.searchParams.getAll("format"),
      animated: url.searchParams.get("animated") ?? undefined,
      dimension: url.searchParams.getAll("dimension"),
      ratingMin,
      ratingMax,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      resolution: url.searchParams.get("resolution") ?? undefined,
      organized: url.searchParams.get("organized") ?? undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      nsfw: nsfwMode,
    },
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
    viewPrefs: await loadUiPrefObject("images:view", { cols: 3 }),
  };
};

function parseNumberParam(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}
