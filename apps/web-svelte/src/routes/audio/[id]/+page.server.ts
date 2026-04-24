import type { PageServerLoad } from "./$types";
import { fetchAudioLibraryDetail } from "$lib/server/media";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params, depends, fetch }) => {
  depends(`audio-libraries:${params.id}`);
  try {
    const library = await fetchAudioLibraryDetail(params.id, { fetch });
    return { library };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Audio library not found");
    throw err;
  }
};
