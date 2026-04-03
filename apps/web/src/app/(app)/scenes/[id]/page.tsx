import { SceneDetail } from "../../../../components/scene-detail";

interface ScenePageProps {
  params: Promise<{ id: string }>;
}

export default async function ScenePage({ params }: ScenePageProps) {
  const { id } = await params;

  return <SceneDetail id={id} />;
}
