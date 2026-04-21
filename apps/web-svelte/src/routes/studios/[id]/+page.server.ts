import type { PageServerLoad } from "./$types";
import { serverFetch } from "$lib/server/core";
import { parseNsfwModeCookie } from "$lib/nsfw-cookie";
import { buildQueryString } from "$lib/query-string";
import { error } from "@sveltejs/kit";

const VIDEO_LIMIT = 60;
const SERIES_LIMIT = 24;
const GALLERY_LIMIT = 24;
const AUDIO_LIMIT = 24;

export const load: PageServerLoad = async ({ params, cookies, depends, fetch }) => {
  depends(`studios:${params.id}`);
  const nsfw = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));

  let studio;
  try {
    studio = await serverFetch<{
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
    }>(`/studios/${encodeURIComponent(params.id)}${buildQueryString({ nsfw })}`, { fetch });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Studio not found");
    throw err;
  }

  const videoQs = buildQueryString({
    studio: studio.id,
    nsfw,
    limit: VIDEO_LIMIT,
    sort: "recent",
    order: "desc",
  });
  const seriesQs = buildQueryString({
    studio: studio.id,
    nsfw,
    limit: SERIES_LIMIT,
  });
  const galleryQs = buildQueryString({
    studio: studio.id,
    nsfw,
    limit: GALLERY_LIMIT,
  });
  const audioQs = buildQueryString({
    studio: studio.id,
    nsfw,
    limit: AUDIO_LIMIT,
  });

  const [videosRes, seriesRes, galleriesRes, audioRes] = await Promise.all([
    serverFetch<{ videos: unknown[]; total: number }>(`/videos${videoQs}`, { fetch }).catch(
      () => ({ videos: [], total: 0 }),
    ),
    serverFetch<{ items: unknown[]; total: number }>(`/video-series${seriesQs}`, { fetch }).catch(
      () => ({ items: [], total: 0 }),
    ),
    serverFetch<{ galleries: unknown[]; total: number }>(`/galleries${galleryQs}`, {
      fetch,
    }).catch(() => ({ galleries: [], total: 0 })),
    serverFetch<{ items: unknown[]; total: number }>(`/audio-libraries${audioQs}`, {
      fetch,
    }).catch(() => ({ items: [], total: 0 })),
  ]);

  return {
    studio,
    videos: videosRes.videos,
    totalVideos: videosRes.total,
    series: seriesRes.items,
    totalSeries: seriesRes.total,
    galleries: galleriesRes.galleries,
    totalGalleries: galleriesRes.total,
    audioLibraries: audioRes.items,
    totalAudioLibraries: audioRes.total,
  };
};
