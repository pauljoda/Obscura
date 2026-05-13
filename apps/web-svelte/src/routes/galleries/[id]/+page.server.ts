import type { PageServerLoad } from "./$types";
import { fetchGalleryDetail } from "$lib/v1/server/media-v1";
import { error, redirect } from "@sveltejs/kit";
import { getBookLegacyGalleryRedirectRead } from "@obscura/app-core";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { redirectHiddenNsfwDetail } from "$lib/v1/server/nsfw-page-guard-v1";
import { loadFormFactorUiPrefObjects } from "$lib/v1/server/ui-prefs-v1";
import { getWebDb } from "$lib/v1/server/db-v1";

const PAGE_SIZE = 120;

export const load: PageServerLoad = async ({ params, depends, fetch, cookies }) => {
  depends(`galleries:${params.id}`);
  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  try {
    const gallery = await fetchGalleryDetail(params.id, {
      fetch,
      imageLimit: PAGE_SIZE,
      imageOffset: 0,
    });
    redirectHiddenNsfwDetail(nsfwMode, gallery);
    return {
      gallery,
      pageSize: PAGE_SIZE,
      nsfwMode,
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
    if (/404/.test(message)) {
      const legacy = await getBookLegacyGalleryRedirectRead(await getWebDb(), params.id);
      if (legacy) {
        const chapter = legacy.chapterId ? `?chapter=${legacy.chapterId}` : "";
        redirect(308, `/books/${legacy.bookId}${chapter}`);
      }
      error(404, "Gallery not found");
    }
    throw err;
  }
};
