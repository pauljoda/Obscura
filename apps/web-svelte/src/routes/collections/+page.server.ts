import type { PageServerLoad } from "./$types";
import { fetchCollections } from "$lib/server/media";

const PAGE_SIZE = 60;

export const load: PageServerLoad = async ({ url, depends, fetch }) => {
  depends("collections");
  const search = url.searchParams.get("search") ?? undefined;
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const response = await fetchCollections(
    { search, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
    { fetch },
  ).catch(() => ({ items: [], total: 0, limit: PAGE_SIZE, offset: 0 }));

  return {
    collections: response.items,
    total: response.total,
    page,
    pageSize: PAGE_SIZE,
    search: search ?? "",
  };
};
