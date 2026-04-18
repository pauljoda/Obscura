import type { PageServerLoad } from "./$types";
import { serverFetch } from "$lib/server/core";
import { parseNsfwModeCookie } from "$lib/nsfw-cookie";
import { buildQueryString } from "$lib/query-string";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params, cookies, depends, fetch }) => {
  depends(`performers:${params.id}`);
  const nsfw = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  const qs = buildQueryString({ nsfw });
  try {
    const performer = await serverFetch<Record<string, unknown> & { id: string; name: string }>(
      `/performers/${encodeURIComponent(params.id)}${qs}`,
      { fetch },
    );
    return { performer };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Actor not found");
    throw err;
  }
};
