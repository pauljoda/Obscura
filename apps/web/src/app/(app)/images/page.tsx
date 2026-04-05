export const dynamic = "force-dynamic";

import { fetchImages, fetchTags } from "../../../lib/server-api";
import { ImagesPageClient } from "../../../components/routes/images-page-client";

export default async function ImagesPage() {
  const [imagesData, tagsData] = await Promise.all([
    fetchImages({ limit: 80 }),
    fetchTags(),
  ]);

  return (
    <ImagesPageClient
      initialImages={imagesData.images}
      initialTags={tagsData.tags}
      initialTotal={imagesData.total}
    />
  );
}
