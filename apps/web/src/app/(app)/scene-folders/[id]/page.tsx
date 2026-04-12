import { redirect } from "next/navigation";

interface SceneFolderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SceneFolderDetailPage({
  params,
}: SceneFolderDetailPageProps) {
  const { id } = await params;
  redirect(`/scenes?folder=${id}`);
}
