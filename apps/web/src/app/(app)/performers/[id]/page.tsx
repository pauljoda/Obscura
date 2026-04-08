export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { PerformerPageClient } from "../../../../components/routes/performer-page-client";
import {
  fetchPerformerDetail,
  fetchScenes,
  type PerformerDetail,
  type SceneListItem,
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
  const scenesResponse = performer
    ? await fetchScenes({ performer: [performer.name], limit: 100, nsfw: nsfwMode }).catch(() => ({
        scenes: [] as SceneListItem[],
        total: 0,
        limit: 100,
        offset: 0,
      }))
    : { scenes: [] as SceneListItem[], total: 0, limit: 100, offset: 0 };

  return (
    <PerformerPageClient
      id={id}
      initialPerformer={performer}
      initialScenes={scenesResponse.scenes}
      initialTotalScenes={scenesResponse.total}
    />
  );
}
