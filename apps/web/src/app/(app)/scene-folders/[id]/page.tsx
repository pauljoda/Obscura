export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { fetchSceneFolderDetail } from "../../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../../lib/nsfw-cookie";
import { SceneFolderDetailClient } from "../../../../components/routes/scene-folder-detail-client";

interface SceneFolderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SceneFolderDetailPage({
  params,
}: SceneFolderDetailPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);
  const folder = await fetchSceneFolderDetail(id, { nsfw: nsfwMode });

  return <SceneFolderDetailClient initialFolder={folder} nsfwMode={nsfwMode} />;
}
