export const dynamic = "force-dynamic";

import { fetchAudioLibraryDetail, fetchTags } from "../../../../lib/server-api";
import { AudioLibraryDetailClient } from "../../../../components/routes/audio-library-detail-client";

interface AudioLibraryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AudioLibraryDetailPage({ params }: AudioLibraryDetailPageProps) {
  const { id } = await params;
  const [library, tagsData] = await Promise.all([
    fetchAudioLibraryDetail(id),
    fetchTags(),
  ]);

  return (
    <AudioLibraryDetailClient
      library={library}
      allTags={tagsData.tags}
    />
  );
}
