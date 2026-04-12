export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { Design3Client } from "../../../components/routes/design3-client";
import {
  fetchGalleries,
  fetchScenes,
  fetchImages,
  type GalleryListItem,
  type SceneListItem,
} from "../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../lib/nsfw-cookie";

export default async function Design3Page() {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);

  const [scenesResponse, galleriesResponse, imagesResponse] = await Promise.all([
    fetchScenes({ sort: "recent", order: "desc", limit: 20, nsfw: nsfwMode }).catch(() => ({
      scenes: [] as SceneListItem[],
    })),
    fetchGalleries({ limit: 12, nsfw: nsfwMode }).catch(() => ({
      galleries: [] as GalleryListItem[],
    })),
    fetchImages({ limit: 12, nsfw: nsfwMode }).catch(() => ({
      images: [],
    })),
  ]);

  return (
    <Design3Client
      scenes={scenesResponse.scenes}
      galleries={galleriesResponse.galleries}
      images={imagesResponse.images}
    />
  );
}
