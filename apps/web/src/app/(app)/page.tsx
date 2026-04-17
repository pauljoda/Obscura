export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { DashboardPageClient } from "../../components/routes/dashboard-page-client";
import {
  fetchGalleries,
  fetchVideos,
  fetchImages,
  fetchAudioLibraries,
  fetchSeries,
  fetchPerformers,
  fetchStudios,
  type GalleryListItem,
  type VideoListItem,
  type PerformerItem,
  type StudioItem,
} from "../../lib/server-api";
import type { ImageListItemDto, AudioLibraryListItemDto, VideoSeriesListItemDto } from "@obscura/contracts";
import { parseNsfwModeCookie } from "../../lib/nsfw-cookie";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);

  const [
    videosResponse,
    galleriesResponse,
    imagesResponse,
    audioResponse,
    seriesResponse,
    performersResponse,
    studiosResponse,
  ] = await Promise.all([
    fetchVideos({ sort: "recent", order: "desc", limit: 50, nsfw: nsfwMode }).catch(() => ({
      videos: [] as VideoListItem[],
    })),
    fetchGalleries({ limit: 12, nsfw: nsfwMode }).catch(() => ({
      galleries: [] as GalleryListItem[],
    })),
    fetchImages({ limit: 12, nsfw: nsfwMode }).catch(() => ({
      images: [] as ImageListItemDto[],
    })),
    fetchAudioLibraries({ limit: 12, sort: "recent", order: "desc", nsfw: nsfwMode }).catch(() => ({
      items: [] as AudioLibraryListItemDto[],
    })),
    fetchSeries({ limit: 12, nsfw: nsfwMode }).catch(() => ({
      items: [] as VideoSeriesListItemDto[],
    })),
    fetchPerformers({ limit: 12, sort: "recent", order: "desc", nsfw: nsfwMode }).catch(() => ({
      performers: [] as PerformerItem[],
    })),
    fetchStudios({ nsfw: nsfwMode }).catch(() => ({
      studios: [] as StudioItem[],
    })),
  ]);

      const allVideos = videosResponse.videos;

      const scoredVideos = [...allVideos].map((video) => {
        let score = Math.random() * 20;
        if (video.playCount === 0) score += 50;
        if (video.rating) score += video.rating;
        return { video, score };
      });

      scoredVideos.sort((a, b) => b.score - a.score);
      const featuredVideos = scoredVideos.slice(0, 5).map((item) => item.video);

      const featuredIds = new Set(featuredVideos.map((video) => video.id));
      const recentVideos = allVideos.filter((video) => !featuredIds.has(video.id)).slice(0, 15);

  return (
    <DashboardPageClient
      videos={recentVideos}
      featuredVideos={featuredVideos}
      galleries={galleriesResponse.galleries}
      images={imagesResponse.images}
      audioLibraries={audioResponse.items}
      series={seriesResponse.items}
      performers={performersResponse.performers}
      studios={studiosResponse.studios.slice(0, 12)}
    />
  );
}
