import type { EntityKind, SearchResponseDto } from "@obscura/contracts";
import { searchProviders } from "./registry";

interface SearchParams {
  q: string;
  kinds?: EntityKind[];
  limit?: number;
  offset?: number;
  kind?: EntityKind;
  rating?: number;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  nsfw?: string;
}

export async function executeSearch(params: SearchParams): Promise<SearchResponseDto> {
  const start = Date.now();
  const { q, kinds, limit, offset = 0, kind, rating, dateFrom, dateTo, tags, nsfw } = params;
  const filters = { rating, dateFrom, dateTo, tags, nsfw };

  // Single-kind mode: full pagination for /search page "show more"
  if (kind) {
    const provider = searchProviders.get(kind);
    if (!provider) return { query: q, groups: [], durationMs: Date.now() - start };
    const result = await provider.query({ q, limit: limit ?? 20, offset, filters });
    return {
      query: q,
      groups: [{
        kind,
        label: provider.label,
        items: result.items,
        total: result.total,
        hasMore: result.total > offset + (limit ?? 20),
      }],
      durationMs: Date.now() - start,
    };
  }

  // Multi-kind preview mode: parallel fan-out to all requested providers
  const activeKinds: EntityKind[] = kinds?.length
    ? kinds
    : (Array.from(searchProviders.keys()) as EntityKind[]);

  const results = await Promise.all(
    activeKinds.map(async (k) => {
      const provider = searchProviders.get(k);
      if (!provider) return null;
      const previewLimit = limit ?? provider.defaultPreviewLimit;
      const result = await provider.query({ q, limit: previewLimit, offset: 0, filters });
      return {
        kind: k,
        label: provider.label,
        items: result.items,
        total: result.total,
        hasMore: result.total > previewLimit,
      };
    })
  );

  return {
    query: q,
    groups: results.filter((r): r is NonNullable<typeof r> => r !== null),
    durationMs: Date.now() - start,
  };
}
