import type { PageServerLoad } from "./$types";
import { serverFetch } from "$lib/server/core";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params, depends, fetch }) => {
  depends(`studios:${params.id}`);
  try {
    const studio = await serverFetch<{
      id: string;
      name: string;
      description?: string | null;
      url?: string | null;
      imagePath?: string | null;
      imageUrl?: string | null;
      aliases?: string | null;
      favorite?: boolean;
      rating?: number | null;
      isNsfw?: boolean;
      videoCount?: number;
      imageAppearanceCount?: number;
      audioLibraryCount?: number;
    }>(`/studios/${encodeURIComponent(params.id)}`, { fetch });
    return { studio };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Studio not found");
    throw err;
  }
};
