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

export async function fetchStudios(): Promise<{ studios: StudioItem[] }> {
  return fetchApi("/studios");
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
  limit?: number;
  offset?: number;
}): Promise<{ performers: PerformerItem[]; total: number; limit: number; offset: number }> {
  const qs = buildQueryString({
    search: params?.search,
    sort: params?.sort,
    order: params?.order,
    gender: params?.gender,
    favorite: params?.favorite,
    country: params?.country,
    limit: params?.limit,
    offset: params?.offset,
  });

  return fetchApi(`/performers${qs}`);
}

export async function fetchTags(): Promise<{ tags: TagItem[] }> {
  return fetchApi("/tags");
}

export async function fetchPerformerDetail(id: string): Promise<PerformerDetail> {
  return fetchApi(`/performers/${id}`);
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

export async function fetchStudioDetail(id: string): Promise<StudioDetail> {
  return fetchApi(`/studios/${id}`);
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

export async function fetchTagDetail(id: string): Promise<TagDetail> {
  return fetchApi(`/tags/${id}`);
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
