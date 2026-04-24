import type { PageServerLoad } from "./$types";
import { serverFetch } from "$lib/server/core";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { buildQueryString } from "$lib/query-string";
import { error } from "@sveltejs/kit";

const VIDEO_LIMIT = 60;
const GALLERY_LIMIT = 24;
const IMAGE_LIMIT = 36;
const AUDIO_LIMIT = 24;
const AUDIO_TRACK_LIMIT = 36;
const SERIES_LIMIT = 24;

export const load: PageServerLoad = async ({ params, cookies, depends, fetch }) => {
  depends(`performers:${params.id}`);
  const nsfw = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  const qs = buildQueryString({ nsfw });

  let performer;
  try {
    performer = await serverFetch<Record<string, unknown> & { id: string; name: string }>(
      `/performers/${encodeURIComponent(params.id)}${qs}`,
      { fetch },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Actor not found");
    throw err;
  }

  // Fetch performer appearances in parallel. Errors fall back to empty
  // collections so a stale link to a broken endpoint still renders the
  // performer's own profile.
  const performerName = performer.name;
  const performerFilterQs = buildQueryString({
    performer: performerName,
    nsfw,
    limit: VIDEO_LIMIT,
    sort: "recent",
    order: "desc",
  });
  const seriesQs = buildQueryString({
    performer: performerName,
    nsfw,
    limit: SERIES_LIMIT,
  });
  const galleriesQs = buildQueryString({
    performer: performerName,
    nsfw,
    limit: GALLERY_LIMIT,
  });
  const imagesQs = buildQueryString({
    performer: performerName,
    nsfw,
    limit: IMAGE_LIMIT,
    sort: "recent",
    order: "desc",
  });
  const audioQs = buildQueryString({
    performer: performerName,
    nsfw,
    limit: AUDIO_LIMIT,
  });
  const audioTracksQs = buildQueryString({
    performer: performerName,
    nsfw,
    limit: AUDIO_TRACK_LIMIT,
    sort: "recent",
    order: "desc",
  });

  const [videosRes, seriesRes, galleriesRes, imagesRes, audioRes, audioTracksRes] = await Promise.all([
    serverFetch<{ videos: unknown[]; total: number }>(`/videos${performerFilterQs}`, { fetch })
      .catch(() => ({ videos: [], total: 0 })),
    serverFetch<{ items: unknown[]; total: number }>(`/video-series${seriesQs}`, { fetch })
      .catch(() => ({ items: [], total: 0 })),
    serverFetch<{ galleries: unknown[]; total: number }>(`/galleries${galleriesQs}`, { fetch })
      .catch(() => ({ galleries: [], total: 0 })),
    serverFetch<{ images: unknown[]; total: number }>(`/images${imagesQs}`, { fetch })
      .catch(() => ({ images: [], total: 0 })),
    serverFetch<{ items: unknown[]; total: number }>(`/audio-libraries${audioQs}`, { fetch })
      .catch(() => ({ items: [], total: 0 })),
    serverFetch<{ items: unknown[]; total: number }>(`/audio-tracks${audioTracksQs}`, { fetch })
      .catch(() => ({ items: [], total: 0 })),
  ]);

  return {
    performer,
    videos: videosRes.videos,
    totalVideos: videosRes.total,
    series: seriesRes.items,
    totalSeries: seriesRes.total,
    galleries: galleriesRes.galleries,
    totalGalleries: galleriesRes.total,
    images: imagesRes.images,
    totalImages: imagesRes.total,
    audioLibraries: audioRes.items,
    totalAudioLibraries: audioRes.total,
    audioTracks: audioTracksRes.items,
    totalAudioTracks: audioTracksRes.total,
  };
};
