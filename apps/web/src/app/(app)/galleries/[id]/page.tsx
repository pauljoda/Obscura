export const dynamic = "force-dynamic";

import { fetchGalleryDetail } from "../../../../lib/server-api";
import { GalleryDetailClient } from "../../../../components/routes/gallery-detail-client";

interface GalleryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function GalleryDetailPage({ params }: GalleryDetailPageProps) {
  const { id } = await params;
  const gallery = await fetchGalleryDetail(id);

  return <GalleryDetailClient initialGallery={gallery} />;
}
