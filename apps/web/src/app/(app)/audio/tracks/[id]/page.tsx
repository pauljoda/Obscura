export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import {
  fetchAudioTrackDetail,
  fetchTags,
  fetchPerformers,
} from "../../../../../lib/server-api";
import { AudioTrackDetailClient } from "../../../../../components/routes/audio-track-detail-client";
import { parseNsfwModeCookie } from "../../../../../lib/nsfw-cookie";

interface AudioTrackDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AudioTrackDetailPage({ params }: AudioTrackDetailPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);

  const [track, tagsData, performersData] = await Promise.all([
    fetchAudioTrackDetail(id),
    fetchTags({ nsfw: nsfwMode }).catch(() => ({ tags: [] })),
    fetchPerformers({
      nsfw: nsfwMode,
      sort: "scenes",
      order: "desc",
      limit: 400,
    }).catch(() => ({ performers: [], total: 0, limit: 400, offset: 0 })),
  ]);

  return (
    <AudioTrackDetailClient
      track={track}
      availableTags={tagsData.tags}
      availablePerformers={performersData.performers}
    />
  );
}
