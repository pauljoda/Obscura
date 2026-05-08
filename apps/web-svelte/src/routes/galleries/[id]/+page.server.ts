import type { PageServerLoad } from "./$types";
import { fetchGalleryDetail } from "$lib/server/media";
import { error } from "@sveltejs/kit";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { loadFormFactorUiPrefObjects } from "$lib/server/ui-prefs";

const PAGE_SIZE = 120;

export const load: PageServerLoad = async ({ params, depends, fetch, cookies }) => {
  depends(`galleries:${params.id}`);
  try {
    const gallery = await fetchGalleryDetail(params.id, {
      fetch,
      imageLimit: PAGE_SIZE,
      imageOffset: 0,
    });
    return {
      gallery,
      pageSize: PAGE_SIZE,
      nsfwMode: parseNsfwModeCookie(cookies.get("obscura-nsfw-mode")),
      surfacePrefs: await loadFormFactorUiPrefObjects(
        `surface:gallery:${params.id}:images`,
        {},
        ":prefs",
      ),
      viewPrefsByFormFactor: await loadFormFactorUiPrefObjects(
        "galleries:interiorView",
        { cols: 3 },
      ),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Gallery not found");
    throw err;
  }
};
