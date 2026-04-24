import type { PageServerLoad } from "./$types";
import { fetchGalleryDetail } from "$lib/server/media";
import { error } from "@sveltejs/kit";
import { loadUiPrefObject } from "$lib/server/ui-prefs";

export const load: PageServerLoad = async ({ params, depends, fetch }) => {
  depends(`galleries:${params.id}`);
  try {
    const gallery = await fetchGalleryDetail(params.id, { fetch });
    return {
      gallery,
      viewPrefs: await loadUiPrefObject("galleries:interiorView", { cols: 6 }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Gallery not found");
    throw err;
  }
};
