import type { PageServerLoad } from "./$types";
import { serverFetch } from "$lib/server/core";
import { parseNsfwModeCookie } from "$lib/nsfw-cookie";
import { buildQueryString } from "$lib/query-string";
import { error } from "@sveltejs/kit";

const VIDEO_LIMIT = 60;
const GALLERY_LIMIT = 24;
const IMAGE_LIMIT = 48;

type TagDetail = {
  id: string;
  name: string;
  description?: string | null;
  aliases?: string[];
  isNsfw?: boolean;
  favorite?: boolean;
  imagePath?: string | null;
  videoCount?: number;
  imageCount?: number;
};

export const load: PageServerLoad = async ({ params, cookies, depends, fetch }) => {
  depends(`tags:${params.id}`);
  const nsfw = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));

  // The /tags landing page links by `encodeURIComponent(tag.name)`, but
  // the API's `/tags/:id` endpoint accepts IDs. Resolve name -> id by
  // searching the tag list, then fetch detail by id.
  const nameFromUrl = decodeURIComponent(params.id);

  let tag: TagDetail;
  try {
    tag = await serverFetch<TagDetail>(`/tags/${params.id}`, { fetch });
  } catch {
    const list = await serverFetch<{ tags: TagDetail[] }>(
      `/tags${buildQueryString({ nsfw })}`,
      { fetch },
    ).catch(() => ({ tags: [] as TagDetail[] }));
    const match = list.tags.find(
      (t) => t.name.toLowerCase() === nameFromUrl.toLowerCase(),
    );
    if (!match) error(404, "Tag not found");
    try {
      tag = await serverFetch<TagDetail>(`/tags/${match.id}`, { fetch });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/404/.test(message)) error(404, "Tag not found");
      throw err;
    }
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
