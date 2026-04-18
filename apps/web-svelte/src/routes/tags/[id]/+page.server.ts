import type { PageServerLoad } from "./$types";
import { serverFetch } from "$lib/server/core";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params, depends, fetch }) => {
  depends(`tags:${params.id}`);

  try {
    const tag = await serverFetch<{ id: string; name: string; aliases?: string[] }>(
      `/tags/${params.id}`,
      { fetch },
    );
    return { tag };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) {
      error(404, "Tag not found");
    }
    throw err;
  }
};
