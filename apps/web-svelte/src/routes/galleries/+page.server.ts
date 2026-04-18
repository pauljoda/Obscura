import type { PageServerLoad } from "./$types";
import { fetchGalleries } from "$lib/server/media";
import { parseNsfwModeCookie } from "$lib/nsfw-cookie";

const PAGE_SIZE = 60;

export const load: PageServerLoad = async ({ cookies, url, depends, fetch }) => {
  depends("galleries");
  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  const search = url.searchParams.get("search") ?? undefined;
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const response = await fetchGalleries(
    { search, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, nsfw: nsfwMode },
    { fetch },
  ).catch(() => ({ galleries: [], total: 0, limit: PAGE_SIZE, offset: 0 }));

  return {
    galleries: response.galleries,
    total: response.total,
    page,
    pageSize: PAGE_SIZE,
    search: search ?? "",
  };
};
