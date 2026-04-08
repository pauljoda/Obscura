export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { SceneDetail } from "../../../../components/scene-detail";
import {
  fetchSceneDetail,
  fetchTags,
  type SceneDetail as SceneDetailType,
  type TagItem,
} from "../../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../../lib/nsfw-cookie";

interface ScenePageProps {
  params: Promise<{ id: string }>;
}

export default async function ScenePage({ params }: ScenePageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);

  const [scene, tagsResponse] = await Promise.all([
    fetchSceneDetail(id).catch(() => null as SceneDetailType | null),
    fetchTags({ nsfw: nsfwMode }).catch(() => ({ tags: [] as TagItem[] })),
  ]);

  return <SceneDetail id={id} initialScene={scene} initialTags={tagsResponse.tags} />;
}
