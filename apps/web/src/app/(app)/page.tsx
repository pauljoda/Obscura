export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { DashboardPageClient } from "../../components/routes/dashboard-page-client";
import {
  fetchGalleries,
  fetchScenes,
  fetchImages,
  fetchAudioLibraries,
  fetchSceneFolders,
  fetchPerformers,
  fetchStudios,
  type GalleryListItem,
  type SceneListItem,
  type PerformerItem,
  type StudioItem,
} from "../../lib/server-api";
import type { ImageListItemDto, AudioLibraryListItemDto, SceneFolderListItemDto } from "@obscura/contracts";
import { parseNsfwModeCookie } from "../../lib/nsfw-cookie";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);

  const [
    scenesResponse,
    galleriesResponse,
    imagesResponse,
    audioResponse,
    foldersResponse,
    performersResponse,
    studiosResponse,
  ] = await Promise.all([
    fetchScenes({ sort: "recent", order: "desc", limit: 20, nsfw: nsfwMode }).catch(() => ({
      scenes: [] as SceneListItem[],
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
    fetchSceneFolders({ limit: 12, nsfw: nsfwMode }).catch(() => ({
      items: [] as SceneFolderListItemDto[],
    })),
    fetchPerformers({ limit: 12, sort: "recent", order: "desc", nsfw: nsfwMode }).catch(() => ({
      performers: [] as PerformerItem[],
    })),
    fetchStudios({ nsfw: nsfwMode }).catch(() => ({
      studios: [] as StudioItem[],
    })),
  ]);

  return (
    <DashboardPageClient
      scenes={scenesResponse.scenes}
      galleries={galleriesResponse.galleries}
      images={imagesResponse.images}
      audioLibraries={audioResponse.items}
      sceneFolders={foldersResponse.items}
      performers={performersResponse.performers}
      studios={studiosResponse.studios.slice(0, 12)}
    />
  );
}
