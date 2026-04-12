export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import {
  fetchImageDetail,
  fetchTags,
  fetchPerformers,
} from "../../../../lib/server-api";
import { ImageDetailClient } from "../../../../components/routes/image-detail-client";
import { parseNsfwModeCookie } from "../../../../lib/nsfw-cookie";

interface ImageDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ImageDetailPage({ params }: ImageDetailPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);

  const [image, tagsData, performersData] = await Promise.all([
    fetchImageDetail(id),
    fetchTags({ nsfw: nsfwMode }).catch(() => ({ tags: [] })),
    fetchPerformers({
      nsfw: nsfwMode,
      sort: "scenes",
      order: "desc",
      limit: 400,
    }).catch(() => ({ performers: [], total: 0, limit: 400, offset: 0 })),
  ]);

  return (
    <ImageDetailClient
      image={image}
      availableTags={tagsData.tags}
      availablePerformers={performersData.performers}
    />
  );
}
