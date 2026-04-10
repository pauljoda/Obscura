export const dynamic = "force-dynamic";

import { fetchAudioLibraries, fetchAudioLibraryStats, fetchTags, fetchStudios } from "../../../lib/server-api";
import { AudioPageClient } from "../../../components/routes/audio-page-client";

export default async function AudioPage() {
  const [librariesData, statsData, tagsData, studiosData] = await Promise.all([
    fetchAudioLibraries({ limit: 60 }),
    fetchAudioLibraryStats(),
    fetchTags(),
    fetchStudios(),
  ]);

  return (
    <AudioPageClient
      initialLibraries={librariesData.items}
      initialTotal={librariesData.total}
      initialStats={statsData}
      initialTags={tagsData.tags}
      initialStudios={studiosData.studios}
    />
  );
}
