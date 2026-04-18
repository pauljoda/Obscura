import type { PageServerLoad } from "./$types";
import { fetchStudios } from "$lib/server/media";
import { parseNsfwModeCookie } from "$lib/nsfw-cookie";

export const load: PageServerLoad = async ({ cookies, depends, fetch }) => {
  depends("studios");
  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  const response = await fetchStudios({ nsfw: nsfwMode }, { fetch }).catch(() => ({
    studios: [],
  }));
  return { studios: response.studios };
};
