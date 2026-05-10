import type { PageServerLoad } from "./$types";
import { fetchAudioLibraryDetail } from "$lib/server/media";
import { error } from "@sveltejs/kit";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { redirectHiddenNsfwDetail } from "$lib/server/nsfw-page-guard";

export const load: PageServerLoad = async ({ params, cookies, depends, fetch }) => {
  depends(`audio-libraries:${params.id}`);
  try {
    const library = await fetchAudioLibraryDetail(params.id, { fetch });
    redirectHiddenNsfwDetail(
      parseNsfwModeCookie(cookies.get("obscura-nsfw-mode")),
      library,
    );
    return { library };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Audio library not found");
    throw err;
  }
};
