export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { ImagesPageClient } from "../../../components/routes/images-page-client";
import {
  defaultImagesListPrefs,
  imagesListPrefsToFetchParams,
  IMAGES_LIST_PREFS_COOKIE,
  parseImagesListPrefs,
} from "../../../lib/images-list-prefs";
import { parseNsfwModeCookie } from "../../../lib/nsfw-cookie";
import {
  fetchImages,
  fetchPerformers,
  fetchStudios,
  fetchTags,
} from "../../../lib/server-api";

export default async function ImagesPage() {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);
  const listPrefs =
    parseImagesListPrefs(cookieStore.get(IMAGES_LIST_PREFS_COOKIE)?.value) ?? defaultImagesListPrefs();
  const imageParams = { ...imagesListPrefsToFetchParams(listPrefs, nsfwMode), limit: 80 };

  const [imagesData, tagsData, studiosData, performersData] = await Promise.all([
    fetchImages(imageParams),
    fetchTags({ nsfw: nsfwMode }).catch(() => ({ tags: [] })),
    fetchStudios({ nsfw: nsfwMode }).catch(() => ({ studios: [] })),
    fetchPerformers({
      nsfw: nsfwMode,
      sort: "scenes",
      order: "desc",
      limit: 300,
    }).catch(() => ({ performers: [], total: 0, limit: 300, offset: 0 })),
  ]);

  return (
    <ImagesPageClient
      initialImages={imagesData.images}
      initialTags={tagsData.tags}
      initialTotal={imagesData.total}
      initialStudios={studiosData.studios}
      initialPerformers={performersData.performers}
      initialListPrefs={listPrefs}
    />
  );
}
