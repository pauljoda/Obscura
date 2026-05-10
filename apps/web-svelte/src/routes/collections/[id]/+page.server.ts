import type { PageServerLoad } from "./$types";
import { fetchCollectionDetail } from "$lib/server/media";
import { serverFetch } from "$lib/server/core";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { buildQueryString } from "$lib/query-string";
import { error } from "@sveltejs/kit";

const ITEM_LIMIT = 120;

export const load: PageServerLoad = async ({ params, cookies, depends, fetch }) => {
  depends(`collections:${params.id}`);
  const nsfw = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));

  let collection;
  try {
    collection = await fetchCollectionDetail(params.id, {
      fetch,
      nsfw: nsfw === "off" ? "off" : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404/.test(message)) error(404, "Collection not found");
    throw err;
  }

  const itemsQs = buildQueryString({ limit: ITEM_LIMIT, nsfw });
  const itemsRes = await serverFetch<{
    items: import("@obscura/contracts").CollectionItemDto[];
    total: number;
    limit: number;
    offset: number;
  }>(`/collections/${params.id}/items${itemsQs}`, { fetch }).catch(() => ({
    items: [],
    total: 0,
    limit: ITEM_LIMIT,
    offset: 0,
  }));

  return { collection, items: itemsRes.items, totalItems: itemsRes.total };
};
