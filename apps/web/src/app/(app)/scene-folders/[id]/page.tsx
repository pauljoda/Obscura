export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { fetchSceneFolderDetail, fetchScenes } from "../../../../lib/server-api";
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
  const [folder, scenesResponse] = await Promise.all([
    fetchSceneFolderDetail(id, { nsfw: nsfwMode }),
    fetchScenes({
      sceneFolderId: id,
      folderScope: "direct",
      limit: 100,
      nsfw: nsfwMode,
    }).catch(() => ({ scenes: [], total: 0, limit: 100, offset: 0 })),
  ]);

  return (
    <SceneFolderDetailClient
      initialFolder={folder}
      initialScenes={scenesResponse.scenes}
      nsfwMode={nsfwMode}
    />
  );
}
