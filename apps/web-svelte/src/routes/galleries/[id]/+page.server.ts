import type { PageServerLoad } from "./$types";
import { fetchGalleryDetail } from "$lib/server/media";
import { error } from "@sveltejs/kit";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { loadFormFactorUiPrefObjects, loadUiPrefObject } from "$lib/server/ui-prefs";
import {
  comicReadingProgressKey,
  defaultComicProgress,
} from "$lib/components/comic-progress";

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
      comicProgress: await loadUiPrefObject(
        comicReadingProgressKey(params.id),
        defaultComicProgress,
      ),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Gallery not found");
    throw err;
  }
};
