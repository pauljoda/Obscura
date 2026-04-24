import type { PageServerLoad } from "./$types";
import { fetchVideoDetail } from "$lib/server/videos";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params, depends, fetch }) => {
  depends(`videos:${params.id}`);
  try {
    const video = await fetchVideoDetail(params.id, { fetch });
    return { video };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Video not found");
    throw err;
  }
};
