export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import {
  fetchGalleries,
  fetchGalleryStats,
  fetchStudios,
  fetchTags,
} from "../../../lib/server-api";
import { GalleriesPageClient } from "../../../components/routes/galleries-page-client";
import {
  defaultGalleriesListPrefs,
  galleriesListPrefsToFetchParams,
  GALLERIES_LIST_PREFS_COOKIE,
  parseGalleriesListPrefs,
} from "../../../lib/galleries-list-prefs";

export default async function GalleriesPage() {
  const cookieStore = await cookies();
  const listPrefs =
    parseGalleriesListPrefs(cookieStore.get(GALLERIES_LIST_PREFS_COOKIE)?.value) ??
    defaultGalleriesListPrefs();
  const galleryFetchParams = galleriesListPrefsToFetchParams(listPrefs);

  const [galleriesData, studiosData, tagsData, galleryStats] = await Promise.all([
    fetchGalleries(galleryFetchParams),
    fetchStudios(),
    fetchTags(),
    fetchGalleryStats().catch(() => ({
      totalGalleries: 0,
      totalImages: 0,
      recentCount: 0,
    })),
  ]);

  return (
    <GalleriesPageClient
      initialGalleries={galleriesData.galleries}
      initialStudios={studiosData.studios}
      initialTags={tagsData.tags}
      initialTotal={galleriesData.total}
      initialListPrefs={listPrefs}
      initialStats={galleryStats}
    />
  );
}
