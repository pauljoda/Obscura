import type { PageServerLoad } from "./$types";
import { fetchAudioTrackDetail } from "$lib/server/media";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params, depends, fetch }) => {
  depends(`audio-tracks:${params.id}`);
  try {
    const track = await fetchAudioTrackDetail(params.id, { fetch });
    return { track };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Audio track not found");
    throw err;
  }
};
