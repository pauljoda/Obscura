import type { PageServerLoad } from "./$types";
import { fetchImageDetail } from "$lib/server/media";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params, depends, fetch }) => {
  depends(`images:${params.id}`);
  try {
    const image = await fetchImageDetail(params.id, { fetch });
    return { image };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Image not found");
    throw err;
  }
};
