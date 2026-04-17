export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { PerformerPageClient } from "../../../../components/routes/performer-page-client";
import type {
  AudioLibraryListItemDto,
  GalleryListItemDto,
  VideoSeriesListItemDto,
} from "@obscura/contracts";
import {
  fetchAudioLibraries,
  fetchGalleries,
  fetchPerformerDetail,
  fetchScenes,
  fetchSeries,
  type PerformerDetail,
  type VideoListItem,
} from "../../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../../lib/nsfw-cookie";

interface PerformerPageProps {
  params: Promise<{ id: string }>;
}

export default async function PerformerPage({ params }: PerformerPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);

  const performer = await fetchPerformerDetail(id, { nsfw: nsfwMode }).catch(() => null as PerformerDetail | null);

  const emptyScenes = {
    scenes: [] as VideoListItem[],
    total: 0,
    limit: 100,
    offset: 0,
  };
  const emptySeries = {
    items: [] as VideoSeriesListItemDto[],
    total: 0,
    limit: 100,
    offset: 0,
  };
  const emptyGalleries = {
    galleries: [] as GalleryListItemDto[],
    total: 0,
    limit: 100,
    offset: 0,
  };
  const emptyAudio = { items: [] as AudioLibraryListItemDto[], total: 0 };

  const [scenesResponse, seriesResponse, galleriesResponse, audioResponse] = performer
    ? await Promise.all([
        fetchScenes({ performer: [performer.name], limit: 100, nsfw: nsfwMode }).catch(() => emptyScenes),
        fetchSeries({ performer: performer.name, limit: 50, nsfw: nsfwMode }).catch(() => emptySeries),
        fetchGalleries({
          performer: [performer.name],
          root: "all",
          limit: 100,
          nsfw: nsfwMode,
        }).catch(() => emptyGalleries),
        fetchAudioLibraries({
          performer: [performer.name],
          root: "all",
          limit: 100,
          nsfw: nsfwMode,
        }).catch(() => emptyAudio),
      ])
    : [emptyScenes, emptySeries, emptyGalleries, emptyAudio];

  return (
    <PerformerPageClient
      id={id}
      initialPerformer={performer}
      initialScenes={scenesResponse.scenes}
      initialTotalScenes={scenesResponse.total}
      initialSeries={seriesResponse.items}
      initialTotalSeries={seriesResponse.total}
      initialGalleries={galleriesResponse.galleries}
      initialTotalGalleries={galleriesResponse.total}
      initialAudioLibraries={audioResponse.items}
      initialTotalAudioLibraries={audioResponse.total}
    />
  );
}
