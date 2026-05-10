import type { PageServerLoad } from "./$types";
import { fetchAudioLibraryDetail, fetchAudioTrackDetail } from "$lib/server/media";
import { error } from "@sveltejs/kit";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { redirectHiddenNsfwDetail } from "$lib/server/nsfw-page-guard";

export const load: PageServerLoad = async ({ params, cookies, depends, fetch }) => {
  depends(`audio-tracks:${params.id}`);
  try {
    const track = await fetchAudioTrackDetail(params.id, { fetch });
    redirectHiddenNsfwDetail(
      parseNsfwModeCookie(cookies.get("obscura-nsfw-mode")),
      track,
    );
    let libraryCoverImagePath: string | null = null;
    if (track.libraryId) {
      try {
        const library = await fetchAudioLibraryDetail(track.libraryId, { fetch });
        libraryCoverImagePath = library.coverImagePath ?? null;
      } catch {
        libraryCoverImagePath = null;
      }
    }
    return { track, libraryCoverImagePath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Audio track not found");
    throw err;
  }
};
