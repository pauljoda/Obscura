export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { SceneDetail } from "../../../../components/scene-detail";
import {
  fetchTags,
  fetchVideoDetail,
  type SceneDetail as SceneDetailType,
  type TagItem,
} from "../../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../../lib/nsfw-cookie";

interface VideoPageProps {
  params: Promise<{ id: string }>;
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);

  const [scene, tagsResponse] = await Promise.all([
    fetchVideoDetail(id).catch(() => null as SceneDetailType | null),
    fetchTags({ nsfw: nsfwMode }).catch(() => ({ tags: [] as TagItem[] })),
  ]);

  return (
    <SceneDetail
      id={id}
      initialScene={scene}
      initialTags={tagsResponse.tags}
      source="videos"
    />
  );
}
