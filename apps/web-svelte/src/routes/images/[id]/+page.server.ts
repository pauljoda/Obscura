import type { PageServerLoad } from "./$types";
import { fetchImageDetail } from "$lib/server/media";
import { error } from "@sveltejs/kit";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { redirectHiddenNsfwDetail } from "$lib/server/nsfw-page-guard";

export const load: PageServerLoad = async ({ params, cookies, depends, fetch }) => {
  depends(`images:${params.id}`);
  try {
    const image = await fetchImageDetail(params.id, { fetch });
    redirectHiddenNsfwDetail(
      parseNsfwModeCookie(cookies.get("obscura-nsfw-mode")),
      image,
    );
    return { image };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Image not found");
    throw err;
  }
};
