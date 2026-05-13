import type { PageServerLoad } from "./$types";
import { fetchJobsDashboard } from "$lib/v1/server/system-v1";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";

export const load: PageServerLoad = async ({ cookies, depends, fetch }) => {
  depends("jobs");
  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  const dashboard = await fetchJobsDashboard({ fetch, nsfwMode }).catch(() => null);
  return { dashboard };
};
