import type { PageServerLoad } from "./$types";
import { fetchTags } from "$lib/server/media";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { loadUiPrefObject } from "$lib/server/ui-prefs";

export const load: PageServerLoad = async ({ cookies, depends, fetch }) => {
  depends("tags");

  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));

  const response = await fetchTags({ nsfw: nsfwMode }, { fetch }).catch(() => ({ tags: [] }));

  return {
    tags: response.tags,
    viewPrefs: await loadUiPrefObject("tags:view", { cols: 2 }),
  };
};
