import { buildQueryString, fetchApi, uploadFile } from "./core";
import type {
  NormalizedPerformerScrapeResult,
  PerformerDetail,
  PerformerItem,
  StudioDetail,
  StudioItem,
  TagDetail,
  TagItem,
} from "./types";

export async function fetchStudios(params?: { nsfw?: string }): Promise<{ studios: StudioItem[] }> {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return fetchApi(`/studios${qs}`);
}

export async function findOrCreateStudio(data: {
  name: string;
  url?: string | null;
  imageUrl?: string | null;
  parentName?: string | null;
  parentUrl?: string | null;
  parentImageUrl?: string | null;
}): Promise<{ ok: true; id: string }> {
  return fetchApi("/studios/find-or-create", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchPerformers(params?: {
  search?: string;
  sort?: string;
  order?: string;
  gender?: string;
  favorite?: string;
  country?: string;
  ratingMin?: number;
  ratingMax?: number;
  hasImage?: string;
  sceneCountMin?: number;
  limit?: number;
  offset?: number;
  nsfw?: string;
}): Promise<{ performers: PerformerItem[]; total: number; limit: number; offset: number }> {
  const qs = buildQueryString({
    search: params?.search,
    sort: params?.sort,
    order: params?.order,
    gender: params?.gender,
    favorite: params?.favorite,
    country: params?.country,
    ratingMin: params?.ratingMin,
    ratingMax: params?.ratingMax,
    hasImage: params?.hasImage,
    sceneCountMin: params?.sceneCountMin,
    limit: params?.limit,
    offset: params?.offset,
    nsfw: params?.nsfw,
  });

  return fetchApi(`/performers${qs}`);
}

const FETCH_ALL_PERFORMERS_PAGE_SIZE = 2000;

/** Fetches every matching performer by paging until `total` is reached (Identify / bulk flows). */
export async function fetchAllPerformers(
  params?: Omit<NonNullable<Parameters<typeof fetchPerformers>[0]>, "limit" | "offset">,
): Promise<{ performers: PerformerItem[]; total: number }> {
  const performers: PerformerItem[] = [];
  let offset = 0;
  let total = 0;
  for (;;) {
    const res = await fetchPerformers({
      ...params,
      limit: FETCH_ALL_PERFORMERS_PAGE_SIZE,
      offset,
    });
    total = res.total;
    performers.push(...res.performers);
    if (res.performers.length < FETCH_ALL_PERFORMERS_PAGE_SIZE || performers.length >= total) break;
    offset += FETCH_ALL_PERFORMERS_PAGE_SIZE;
  }
  return { performers, total };
}

export async function fetchTags(params?: { nsfw?: string }): Promise<{ tags: TagItem[] }> {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return fetchApi(`/tags${qs}`);
}

export async function fetchPerformerDetail(id: string, params?: { nsfw?: string }): Promise<PerformerDetail> {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return fetchApi(`/performers/${id}${qs}`);
}

export async function createPerformer(
  data: Partial<PerformerDetail> & { name: string; tagNames?: string[] },
): Promise<{ ok: true; id: string }> {
  return fetchApi("/performers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePerformer(
  id: string,
  data: Record<string, unknown>,
): Promise<{ ok: true; id: string }> {
  return fetchApi(`/performers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deletePerformer(id: string): Promise<{ ok: true }> {
  return fetchApi(`/performers/${id}`, { method: "DELETE" });
}

export async function togglePerformerFavorite(
  id: string,
  favorite: boolean,
): Promise<{ ok: true; favorite: boolean }> {
  return fetchApi(`/performers/${id}/favorite`, {
    method: "PATCH",
    body: JSON.stringify({ favorite }),
  });
}

export async function setPerformerRating(
  id: string,
  rating: number | null,
): Promise<{ ok: true; rating: number | null }> {
  return fetchApi(`/performers/${id}/rating`, {
    method: "PATCH",
    body: JSON.stringify({ rating }),
  });
}

export async function uploadPerformerImage(
  id: string,
  file: File,
): Promise<{ ok: true; imagePath: string }> {
  return uploadFile(`/performers/${id}/image`, file);
}

export async function uploadPerformerImageFromUrl(
  id: string,
  imageUrl: string,
): Promise<{ ok: true; imagePath: string }> {
  return fetchApi(`/performers/${id}/image/from-url`, {
    method: "POST",
    body: JSON.stringify({ imageUrl }),
  });
}

export async function deletePerformerImage(id: string): Promise<{ ok: true }> {
  return fetchApi(`/performers/${id}/image`, { method: "DELETE" });
}

export async function scrapePerformerApi(
  scraperId: string,
  performerId: string,
  options?: { action?: string; url?: string; query?: string },
): Promise<{
  result?: NormalizedPerformerScrapeResult;
  results?: NormalizedPerformerScrapeResult[];
  message?: string;
  action?: string;
  triedActions?: string[];
}> {
  return fetchApi(`/scrapers/${scraperId}/scrape-performer`, {
    method: "POST",
    body: JSON.stringify({
      performerId,
      action: options?.action || "auto",
      url: options?.url,
      query: options?.query,
    }),
  });
}

export async function applyPerformerScrape(
  id: string,
  fields: Record<string, unknown>,
  selectedFields: string[],
): Promise<{ ok: true; id: string }> {
  return fetchApi(`/performers/${id}/apply-scrape`, {
    method: "POST",
    body: JSON.stringify({ fields, selectedFields }),
  });
}

export async function fetchStudioDetail(id: string, params?: { nsfw?: string }): Promise<StudioDetail> {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return fetchApi(`/studios/${id}${qs}`);
}

export async function updateStudio(
  id: string,
  data: Record<string, unknown>,
): Promise<StudioDetail> {
  return fetchApi(`/studios/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function createStudio(data: {
  name: string;
  description?: string;
  aliases?: string;
  url?: string;
  parentId?: string;
}): Promise<{ ok: true; id: string }> {
  return fetchApi("/studios", { method: "POST", body: JSON.stringify(data) });
}

export async function deleteStudio(id: string): Promise<{ ok: true }> {
  return fetchApi(`/studios/${id}`, { method: "DELETE" });
}

export async function toggleStudioFavorite(
  id: string,
  favorite: boolean,
): Promise<{ ok: true; favorite: boolean }> {
  return fetchApi(`/studios/${id}/favorite`, {
    method: "PATCH",
    body: JSON.stringify({ favorite }),
  });
}

export async function setStudioRating(
  id: string,
  rating: number | null,
): Promise<{ ok: true; rating: number | null }> {
  return fetchApi(`/studios/${id}/rating`, {
    method: "PATCH",
    body: JSON.stringify({ rating }),
  });
}

export async function uploadStudioImage(
  id: string,
  file: File,
): Promise<{ ok: true; imagePath: string }> {
  return uploadFile(`/studios/${id}/image`, file);
}

export async function uploadStudioImageFromUrl(
  id: string,
  imageUrl: string,
): Promise<{ ok: true; imagePath: string }> {
  return fetchApi(`/studios/${id}/image/from-url`, {
    method: "POST",
    body: JSON.stringify({ imageUrl }),
  });
}

export async function deleteStudioImage(id: string): Promise<{ ok: true }> {
  return fetchApi(`/studios/${id}/image`, { method: "DELETE" });
}

export async function fetchTagDetail(id: string, params?: { nsfw?: string }): Promise<TagDetail> {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return fetchApi(`/tags/${id}${qs}`);
}

export async function updateTag(
  id: string,
  data: Record<string, unknown>,
): Promise<TagDetail> {
  return fetchApi(`/tags/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function createTag(
  data: { name: string; description?: string; aliases?: string },
): Promise<{ ok: true; id: string }> {
  return fetchApi("/tags", { method: "POST", body: JSON.stringify(data) });
}

export async function deleteTag(id: string): Promise<{ ok: true }> {
  return fetchApi(`/tags/${id}`, { method: "DELETE" });
}

export async function toggleTagFavorite(
  id: string,
  favorite: boolean,
): Promise<{ ok: true; favorite: boolean }> {
  return fetchApi(`/tags/${id}/favorite`, {
    method: "PATCH",
    body: JSON.stringify({ favorite }),
  });
}

export async function setTagRating(
  id: string,
  rating: number | null,
): Promise<{ ok: true; rating: number | null }> {
  return fetchApi(`/tags/${id}/rating`, {
    method: "PATCH",
    body: JSON.stringify({ rating }),
  });
}

export async function uploadTagImage(
  id: string,
  file: File,
): Promise<{ ok: true; imagePath: string }> {
  return uploadFile(`/tags/${id}/image`, file);
}

export async function uploadTagImageFromUrl(
  id: string,
  imageUrl: string,
): Promise<{ ok: true; imagePath: string }> {
  return fetchApi(`/tags/${id}/image/from-url`, {
    method: "POST",
    body: JSON.stringify({ imageUrl }),
  });
}

export async function deleteTagImage(id: string): Promise<{ ok: true }> {
  return fetchApi(`/tags/${id}/image`, { method: "DELETE" });
}
