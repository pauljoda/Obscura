import type { PageServerLoad } from "./$types";
import { fetchPerformers } from "$lib/server/media";
import { parseNsfwModeCookie } from "$lib/nsfw-cookie";

export const load: PageServerLoad = async ({ cookies, url, depends, fetch }) => {
  depends("performers");
  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));

  const params = {
    search: url.searchParams.get("search") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    order: url.searchParams.get("order") ?? undefined,
    gender: url.searchParams.get("gender") ?? undefined,
    favorite: url.searchParams.get("favorite") ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
    nsfw: nsfwMode,
    limit: 120,
    offset: 0,
  };

  const response = await fetchPerformers(params, { fetch }).catch(() => ({
    performers: [],
    total: 0,
    limit: 120,
    offset: 0,
  }));

  return { performers: response.performers, total: response.total };
};
