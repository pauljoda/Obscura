import { json, type RequestHandler } from "@sveltejs/kit";
import type { EntityKind } from "@obscura/contracts";
import { executeSearch } from "@obscura/app-core";
import { getSearchProviders } from "$lib/server/search";

export const GET: RequestHandler = async ({ url }) => {
  const query = (url.searchParams.get("q") ?? "").trim();

  if (query.length < 2) {
    return json({ query, groups: [], durationMs: 0 });
  }

  const providers = await getSearchProviders();
  const kinds = url.searchParams.get("kinds");
  const kind = url.searchParams.get("kind");
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");
  const rating = url.searchParams.get("rating");
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;
  const tags = url.searchParams.get("tags");
  const nsfw = url.searchParams.get("nsfw") ?? undefined;

  const result = await executeSearch(providers, {
    q: query.slice(0, 200),
    kinds: kinds ? (kinds.split(",") as EntityKind[]) : undefined,
    kind: (kind as EntityKind | null) ?? undefined,
    limit: limit ? Math.min(Number(limit), 50) : undefined,
    offset: offset ? Number(offset) : undefined,
    rating: rating ? Number(rating) : undefined,
    dateFrom,
    dateTo,
    tags: tags ? tags.split(",") : undefined,
    nsfw,
  });

  return json(result);
};
