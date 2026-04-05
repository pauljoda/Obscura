export const dynamic = "force-dynamic";

import { fetchGalleries, fetchStudios, fetchTags } from "../../../lib/server-api";
import { GalleriesPageClient } from "../../../components/routes/galleries-page-client";

export default async function GalleriesPage() {
  const [galleriesData, studiosData, tagsData] = await Promise.all([
    fetchGalleries({ limit: 60 }),
    fetchStudios(),
    fetchTags(),
  ]);

  return (
    <GalleriesPageClient
      initialGalleries={galleriesData.galleries}
      initialStudios={studiosData.studios}
      initialTags={tagsData.tags}
      initialTotal={galleriesData.total}
    />
  );
}
