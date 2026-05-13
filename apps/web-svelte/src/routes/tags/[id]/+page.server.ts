import type { PageServerLoad } from "./$types";
import { serverFetch } from "$lib/v1/server/core-v1";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { buildQueryString } from "$lib/query-string";
import { error } from "@sveltejs/kit";
import { redirectHiddenNsfwDetail } from "$lib/v1/server/nsfw-page-guard-v1";

const VIDEO_LIMIT = 60;
const SERIES_LIMIT = 24;
const GALLERY_LIMIT = 24;
const BOOK_LIMIT = 24;
const IMAGE_LIMIT = 48;
const AUDIO_LIMIT = 24;
const AUDIO_TRACK_LIMIT = 36;

type TagDetail = {
  id: string;
  name: string;
  description?: string | null;
  aliases?: string | null;
  isNsfw?: boolean;
  favorite?: boolean;
  ignoreAutoTag?: boolean;
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
  redirectHiddenNsfwDetail(nsfw, tag);
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
    root: "all",
  });
  const booksQs = buildQueryString({
    tag: tagName,
    nsfw,
    limit: BOOK_LIMIT,
  });
  const seriesQs = buildQueryString({
    tag: tagName,
    nsfw,
    limit: SERIES_LIMIT,
  });
  const imagesQs = buildQueryString({
    tag: tagName,
    nsfw,
    limit: IMAGE_LIMIT,
  });
  const audioQs = buildQueryString({
    tag: tagName,
    nsfw,
    limit: AUDIO_LIMIT,
    root: "all",
  });
  const audioTracksQs = buildQueryString({
    tag: tagName,
    nsfw,
    limit: AUDIO_TRACK_LIMIT,
    sort: "recent",
    order: "desc",
  });

  const [videosRes, seriesRes, galleriesRes, booksRes, imagesRes, audioRes, audioTracksRes] = await Promise.all([
    serverFetch<{ videos: unknown[]; total: number }>(`/videos${videoQs}`, { fetch }).catch(
      () => ({ videos: [], total: 0 }),
    ),
    serverFetch<{ items: unknown[]; total: number }>(`/video-series${seriesQs}`, { fetch }).catch(
      () => ({ items: [], total: 0 }),
    ),
    serverFetch<{ galleries: unknown[]; total: number }>(`/galleries${galleriesQs}`, {
      fetch,
    }).catch(() => ({ galleries: [], total: 0 })),
    serverFetch<{ books: unknown[]; total: number }>(`/books${booksQs}`, { fetch }).catch(
      () => ({ books: [], total: 0 }),
    ),
    serverFetch<{ images: unknown[]; total: number }>(`/images${imagesQs}`, { fetch }).catch(
      () => ({ images: [], total: 0 }),
    ),
    serverFetch<{ items: unknown[]; total: number }>(`/audio-libraries${audioQs}`, {
      fetch,
    }).catch(() => ({ items: [], total: 0 })),
    serverFetch<{ items: unknown[]; total: number }>(`/audio-tracks${audioTracksQs}`, {
      fetch,
    }).catch(() => ({ items: [], total: 0 })),
  ]);

  return {
    tag,
    videos: videosRes.videos,
    totalVideos: videosRes.total,
    series: seriesRes.items,
    totalSeries: seriesRes.total,
    galleries: galleriesRes.galleries,
    totalGalleries: galleriesRes.total,
    books: booksRes.books,
    totalBooks: booksRes.total,
    images: imagesRes.images,
    totalImages: imagesRes.total,
    audioLibraries: audioRes.items,
    totalAudioLibraries: audioRes.total,
    audioTracks: audioTracksRes.items,
    totalAudioTracks: audioTracksRes.total,
  };
};
