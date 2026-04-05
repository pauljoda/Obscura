import { SceneDetail } from "../../../../components/scene-detail";
import {
  fetchSceneDetail,
  fetchTags,
  type SceneDetail as SceneDetailType,
  type TagItem,
} from "../../../../lib/server-api";

interface ScenePageProps {
  params: Promise<{ id: string }>;
}

export default async function ScenePage({ params }: ScenePageProps) {
  const { id } = await params;

  const [scene, tagsResponse] = await Promise.all([
    fetchSceneDetail(id).catch(() => null as SceneDetailType | null),
    fetchTags().catch(() => ({ tags: [] as TagItem[] })),
  ]);

  return <SceneDetail id={id} initialScene={scene} initialTags={tagsResponse.tags} />;
}
