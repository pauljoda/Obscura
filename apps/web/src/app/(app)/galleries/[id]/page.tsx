export const dynamic = "force-dynamic";

import { fetchGalleryDetail, fetchTags } from "../../../../lib/server-api";
import { GalleryDetailClient } from "../../../../components/routes/gallery-detail-client";

interface GalleryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function GalleryDetailPage({ params }: GalleryDetailPageProps) {
  const { id } = await params;
  const [gallery, tagsData] = await Promise.all([
    fetchGalleryDetail(id),
    fetchTags(),
  ]);

  return <GalleryDetailClient initialGallery={gallery} availableTags={tagsData.tags} />;
}
