import type { FastifyInstance } from "fastify";
import type { EntityKind } from "@obscura/contracts";
import { executeSearch } from "../search/search.service";

export async function searchRoutes(app: FastifyInstance) {
  app.get("/search", async (request) => {
    const q = request.query as Record<string, string>;
    const query = (q.q ?? "").trim();

    if (query.length < 2) {
      return { query, groups: [], durationMs: 0 };
    }

    return executeSearch({
      q: query.slice(0, 200),
      kinds: q.kinds ? (q.kinds.split(",") as EntityKind[]) : undefined,
      kind: q.kind as EntityKind | undefined,
      limit: q.limit ? Math.min(Number(q.limit), 50) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
      rating: q.rating ? Number(q.rating) : undefined,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      tags: q.tags ? q.tags.split(",") : undefined,
    });
  });
}
