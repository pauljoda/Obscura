import { SceneEdit } from "../../../../../components/scene-edit";

interface VideoEditPageProps {
  params: Promise<{ id: string }>;
}

// NOTE(videos): SceneEdit fetches /scenes/:id internally. Until it's
// parameterized to choose between /scenes and /videos, editing a
// video from this route will not load fresh data. Tracked as a
// follow-up; see /videos/[id]/page.tsx for the same caveat.
export default async function VideoEditPage({ params }: VideoEditPageProps) {
  const { id } = await params;
  return <SceneEdit id={id} />;
}
