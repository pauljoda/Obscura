export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { fetchAudioLibraries, fetchAudioLibraryStats, fetchTags, fetchStudios } from "../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../lib/nsfw-cookie";
import { AudioPageClient } from "../../../components/routes/audio-page-client";

export default async function AudioPage() {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);
  const [librariesData, statsData, tagsData, studiosData] = await Promise.all([
    fetchAudioLibraries({ limit: 60, nsfw: nsfwMode }),
    fetchAudioLibraryStats(nsfwMode),
    fetchTags({ nsfw: nsfwMode }),
    fetchStudios({ nsfw: nsfwMode }),
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
