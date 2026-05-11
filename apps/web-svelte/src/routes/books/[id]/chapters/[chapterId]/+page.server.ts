import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { fetchBookDetail } from "$lib/server/media";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { redirectHiddenNsfwDetail } from "$lib/server/nsfw-page-guard";

export const load: PageServerLoad = async ({ params, depends, fetch, cookies }) => {
  depends(`books:${params.id}`);
  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  try {
    const book = await fetchBookDetail(params.id, { nsfw: nsfwMode }, { fetch });
    redirectHiddenNsfwDetail(nsfwMode, book);
    const chapter = book.chapters.find((item) => item.id === params.chapterId);
    if (!chapter) error(404, "Chapter not found");
    return { book, chapter, nsfwMode };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Chapter not found");
    throw err;
  }
};
