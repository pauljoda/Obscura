import type { PageServerLoad } from "./$types";
import { fetchAudioLibraries } from "$lib/server/media";
import { parseNsfwModeCookie } from "$lib/nsfw-cookie";
import { loadUiPrefObject } from "$lib/server/ui-prefs";

const PAGE_SIZE = 60;

export const load: PageServerLoad = async ({ cookies, url, depends, fetch }) => {
  depends("audio-libraries");
  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  const search = url.searchParams.get("search") ?? undefined;
  const sort = url.searchParams.get("sort") ?? "recent";
  const orderRaw = url.searchParams.get("order");
  const order: "asc" | "desc" = orderRaw === "asc" || orderRaw === "desc" ? orderRaw : "desc";
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const studio = url.searchParams.get("studio") ?? undefined;
  const organized = url.searchParams.get("organized") ?? undefined;
  const ratingMinRaw = url.searchParams.get("ratingMin");
  const ratingMin = ratingMinRaw ? Number(ratingMinRaw) : undefined;
  const ratingMaxRaw = url.searchParams.get("ratingMax");
  const ratingMax = ratingMaxRaw ? Number(ratingMaxRaw) : undefined;

  const response = await fetchAudioLibraries(
    {
      search,
      sort,
      order,
      studio,
      organized,
      ratingMin: Number.isFinite(ratingMin) ? ratingMin : undefined,
      ratingMax: Number.isFinite(ratingMax) ? ratingMax : undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      nsfw: nsfwMode,
    },
    { fetch },
  ).catch(() => ({ items: [], total: 0 }));

  return {
    libraries: response.items,
    total: response.total,
    page,
    pageSize: PAGE_SIZE,
    search: search ?? "",
    sort,
    order,
    viewPrefs: await loadUiPrefObject("audio:view", { cols: 5 }),
  };
};
