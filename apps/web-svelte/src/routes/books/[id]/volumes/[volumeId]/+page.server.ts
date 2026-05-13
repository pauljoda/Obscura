import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { fetchBookDetail } from "$lib/v1/server/media-v1";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { redirectHiddenNsfwDetail } from "$lib/v1/server/nsfw-page-guard-v1";

export const load: PageServerLoad = async ({ params, depends, fetch, cookies }) => {
  depends(`books:${params.id}`);
  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  try {
    const book = await fetchBookDetail(params.id, { nsfw: nsfwMode }, { fetch });
    redirectHiddenNsfwDetail(nsfwMode, book);
    const volume = book.volumes.find((item) => item.id === params.volumeId);
    if (!volume) error(404, "Volume not found");
    return { book, volume, nsfwMode };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Volume not found");
    throw err;
  }
};
