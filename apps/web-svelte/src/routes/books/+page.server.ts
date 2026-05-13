import type { PageServerLoad } from "./$types";
import { fetchBooks } from "$lib/v1/server/media-v1";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { loadFormFactorUiPrefObjects } from "$lib/v1/server/ui-prefs-v1";

const PAGE_SIZE = 60;

export const load: PageServerLoad = async ({ cookies, url, depends, fetch }) => {
  depends("books");
  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  const search = url.searchParams.get("search") ?? undefined;
  const sort = url.searchParams.get("sort") ?? "recent";
  const orderRaw = url.searchParams.get("order");
  const order: "asc" | "desc" = orderRaw === "asc" || orderRaw === "desc" ? orderRaw : "desc";
  const ratingMin = url.searchParams.get("ratingMin");
  const ratingMax = url.searchParams.get("ratingMax");
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const response = await fetchBooks(
    {
      search,
      sort,
      order,
      read: url.searchParams.get("read") ?? undefined,
      ratingMin: ratingMin ? Number(ratingMin) : undefined,
      ratingMax: ratingMax ? Number(ratingMax) : undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      organized: url.searchParams.get("organized") ?? undefined,
      studio: url.searchParams.get("studio") ?? undefined,
      tag: url.searchParams.getAll("tag"),
      performer: url.searchParams.getAll("performer"),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      nsfw: nsfwMode,
    },
    { fetch },
  ).catch(() => ({ books: [], total: 0, limit: PAGE_SIZE, offset: 0 }));

  return {
    books: response.books,
    total: response.total,
    page,
    pageSize: PAGE_SIZE,
    search: search ?? "",
    sort,
    order,
    nsfwMode,
    surfacePrefs: await loadFormFactorUiPrefObjects("surface:books", {}, ":prefs"),
  };
};
