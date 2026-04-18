import type { PageServerLoad } from "./$types";
import { fetchCollectionDetail } from "$lib/server/media";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params, depends, fetch }) => {
  depends(`collections:${params.id}`);
  try {
    const collection = await fetchCollectionDetail(params.id, { fetch });
    return { collection };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Collection not found");
    throw err;
  }
};
