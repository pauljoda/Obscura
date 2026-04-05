import { PerformerPageClient } from "../../../../components/routes/performer-page-client";
import {
  fetchPerformerDetail,
  fetchScenes,
  type PerformerDetail,
  type SceneListItem,
} from "../../../../lib/server-api";

interface PerformerPageProps {
  params: Promise<{ id: string }>;
}

export default async function PerformerPage({ params }: PerformerPageProps) {
  const { id } = await params;

  const performer = await fetchPerformerDetail(id).catch(() => null as PerformerDetail | null);
  const scenesResponse = performer
    ? await fetchScenes({ performer: [performer.name], limit: 100 }).catch(() => ({
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
