import { VideoEdit } from "../../../../../components/video-edit";

interface VideoEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function VideoEditPage({ params }: VideoEditPageProps) {
  const { id } = await params;
  return <VideoEdit id={id} source="videos" />;
}
