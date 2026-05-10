import type { PageServerLoad } from "./$types";
import { fetchVideoDetail } from "$lib/server/videos";
import { error } from "@sveltejs/kit";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { redirectHiddenNsfwDetail } from "$lib/server/nsfw-page-guard";

export const load: PageServerLoad = async ({ params, cookies, depends, fetch }) => {
  depends(`videos:${params.id}`);
  try {
    const video = await fetchVideoDetail(params.id, { fetch });
    redirectHiddenNsfwDetail(
      parseNsfwModeCookie(cookies.get("obscura-nsfw-mode")),
      video,
    );
    return { video };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Video not found");
    throw err;
  }
};
