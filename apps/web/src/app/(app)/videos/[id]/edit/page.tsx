import { SceneEdit } from "../../../../../components/scene-edit";

interface VideoEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function VideoEditPage({ params }: VideoEditPageProps) {
  const { id } = await params;
  return <SceneEdit id={id} source="videos" />;
}
