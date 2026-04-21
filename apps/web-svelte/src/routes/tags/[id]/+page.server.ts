import type { PageServerLoad } from "./$types";
import { serverFetch } from "$lib/server/core";
import { parseNsfwModeCookie } from "$lib/nsfw-cookie";
import { buildQueryString } from "$lib/query-string";
import { error } from "@sveltejs/kit";

const VIDEO_LIMIT = 60;
const GALLERY_LIMIT = 24;
const IMAGE_LIMIT = 48;

export const load: PageServerLoad = async ({ params, cookies, depends, fetch }) => {
  depends(`tags:${params.id}`);
  const nsfw = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));

  let tag;
  try {
    tag = await serverFetch<{
      id: string;
      name: string;
      description?: string | null;
      aliases?: string[];
      isNsfw?: boolean;
      favorite?: boolean;
      imagePath?: string | null;
      videoCount?: number;
      imageCount?: number;
    }>(`/tags/${params.id}`, { fetch });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Tag not found");
    throw err;
  }

  const tagName = tag.name;
  // The /videos + /galleries + /images API accepts a `tag=` filter by name.
  const videoQs = buildQueryString({
    tag: tagName,
    nsfw,
    limit: VIDEO_LIMIT,
    sort: "recent",
    order: "desc",
  });
  const galleriesQs = buildQueryString({
    tag: tagName,
    nsfw,
    limit: GALLERY_LIMIT,
  });
  const imagesQs = buildQueryString({
    tag: tagName,
    nsfw,
    limit: IMAGE_LIMIT,
  });

  const [videosRes, galleriesRes, imagesRes] = await Promise.all([
    serverFetch<{ videos: unknown[]; total: number }>(`/videos${videoQs}`, { fetch }).catch(
      () => ({ videos: [], total: 0 }),
    ),
    serverFetch<{ galleries: unknown[]; total: number }>(`/galleries${galleriesQs}`, {
      fetch,
    }).catch(() => ({ galleries: [], total: 0 })),
    serverFetch<{ images: unknown[]; total: number }>(`/images${imagesQs}`, { fetch }).catch(
      () => ({ images: [], total: 0 }),
    ),
  ]);

  return {
    tag,
    videos: videosRes.videos,
    totalVideos: videosRes.total,
    galleries: galleriesRes.galleries,
    totalGalleries: galleriesRes.total,
    images: imagesRes.images,
    totalImages: imagesRes.total,
  };
};
