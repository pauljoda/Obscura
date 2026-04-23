import type { PageServerLoad } from "./$types";
import { fetchVideoCards, fetchSeries } from "$lib/server/videos";
import {
  fetchGalleries,
  fetchImages,
  fetchAudioLibraries,
  fetchPerformers,
  fetchStudios,
} from "$lib/server/media";
import { parseNsfwModeCookie } from "$lib/nsfw-cookie";
import type {
  GalleryListItemDto,
  ImageListItemDto,
  AudioLibraryListItemDto,
  VideoSeriesListItemDto,
} from "@obscura/contracts";

export const load: PageServerLoad = async ({ cookies, depends, fetch }) => {
  depends("dashboard");

  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));

  const [videosRes, galleriesRes, imagesRes, audioRes, seriesRes, performersRes, studiosRes] =
    await Promise.all([
      fetchVideoCards(
        { sort: "recent", order: "desc", limit: 50, nsfw: nsfwMode },
        { fetch },
      ).catch(() => ({ videos: [], total: 0, limit: 50, offset: 0 })),
      fetchGalleries({ limit: 12, nsfw: nsfwMode }, { fetch }).catch(() => ({
        galleries: [] as GalleryListItemDto[],
        total: 0,
        limit: 12,
        offset: 0,
      })),
      fetchImages({ limit: 12, nsfw: nsfwMode }, { fetch }).catch(() => ({
        images: [] as ImageListItemDto[],
        total: 0,
        limit: 12,
        offset: 0,
      })),
      fetchAudioLibraries(
        { limit: 12, sort: "recent", order: "desc", nsfw: nsfwMode },
        { fetch },
      ).catch(() => ({ items: [] as AudioLibraryListItemDto[], total: 0 })),
      fetchSeries({ limit: 12, sort: "recent", order: "desc", nsfw: nsfwMode }).catch(() => ({
        items: [] as VideoSeriesListItemDto[],
        total: 0,
        limit: 12,
        offset: 0,
      })),
      fetchPerformers(
        { limit: 12, sort: "recent", order: "desc", nsfw: nsfwMode },
        { fetch },
      ).catch(() => ({ performers: [], total: 0, limit: 12, offset: 0 })),
      fetchStudios({ nsfw: nsfwMode }, { fetch }).catch(() => ({ studios: [] })),
    ]);

  const allVideos = videosRes.videos;

  // Score-sort: featured = least-played with optional rating bias + a touch of randomness
  const scored = [...allVideos].map((video) => {
    let score = Math.random() * 20;
    if ((video.playCount ?? 0) === 0) score += 50;
    if (video.rating) score += video.rating;
    return { video, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const featuredVideos = scored.slice(0, 5).map((s) => s.video);

  const featuredIds = new Set(featuredVideos.map((v) => v.id));
  const recentVideos = allVideos.filter((v) => !featuredIds.has(v.id)).slice(0, 15);

  return {
    featuredVideos,
    recentVideos,
    galleries: galleriesRes.galleries,
    images: imagesRes.images,
    audioLibraries: audioRes.items,
    series: seriesRes.items,
    performers: performersRes.performers,
    studios: studiosRes.studios.slice(0, 12),
  };
};
