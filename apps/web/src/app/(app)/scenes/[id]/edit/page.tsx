import { SceneEdit } from "../../../../../components/scene-edit";

interface SceneEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function SceneEditPage({ params }: SceneEditPageProps) {
  const { id } = await params;

  return <SceneEdit id={id} />;
}
