export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import {
  fetchGalleryDetail,
  fetchPerformers,
  fetchTags,
} from "../../../../lib/server-api";
import { GalleryDetailClient } from "../../../../components/routes/gallery-detail-client";
import { parseNsfwModeCookie } from "../../../../lib/nsfw-cookie";

interface GalleryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function GalleryDetailPage({ params }: GalleryDetailPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);

  const [gallery, tagsData, performersData] = await Promise.all([
    fetchGalleryDetail(id),
    fetchTags({ nsfw: nsfwMode }).catch(() => ({ tags: [] })),
    fetchPerformers({
      nsfw: nsfwMode,
      sort: "scenes",
      order: "desc",
      limit: 400,
    }).catch(() => ({ performers: [], total: 0, limit: 400, offset: 0 })),
  ]);

  return (
    <GalleryDetailClient
      initialGallery={gallery}
      availableTags={tagsData.tags}
      availablePerformers={performersData.performers}
    />
  );
}
