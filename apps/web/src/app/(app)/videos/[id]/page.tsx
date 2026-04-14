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

// NOTE(videos): SceneDetail is the same client component the /scenes
// route uses. On initial render it receives `initialScene` from the
// videos backend, so the page shows correct data. On a subsequent
// client-side refresh the component currently refetches from
// /scenes/:id — that path will 404 for video ids until scene-detail
// and scene-edit are parameterized. Tracked as a follow-up.
export default async function VideoPage({ params }: VideoPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);

  const [scene, tagsResponse] = await Promise.all([
    fetchVideoDetail(id).catch(() => null as SceneDetailType | null),
    fetchTags({ nsfw: nsfwMode }).catch(() => ({ tags: [] as TagItem[] })),
  ]);

  return <SceneDetail id={id} initialScene={scene} initialTags={tagsResponse.tags} />;
}
