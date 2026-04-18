import { VideoDetail } from "../../../../components/video-detail";
import { fetchVideoDetail } from "../../../../lib/server-api/videos";
import type { VideoDetail as VideoDetailType } from "../../../../lib/api/types";

interface VideoPageProps {
  params: Promise<{ id: string }>;
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { id } = await params;
  // Keep first paint scoped to the video detail fetch. Preloading global tag
  // data here drags in unrelated work and made dev navigation to /videos/[id]
  // appear stuck behind the Next route spinner.
  const video = await fetchVideoDetail(id).catch(
    () => null as VideoDetailType | null,
  );

  return <VideoDetail id={id} initialVideo={video} />;
}
