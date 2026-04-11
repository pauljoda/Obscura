import type { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import { eq, and, desc } from "drizzle-orm";
import {
  StashBoxClient,
  StashBoxError,
  normalizeStashBoxScene,
  normalizeStashBoxPerformer,
  stashBoxSceneToRawResult,
  hasUsableNormalizedSceneResult,
  type StashBoxFingerprint,
} from "@obscura/stash-import";
import {
  getStashBoxClient,
  invalidateStashBoxClient,
} from "../lib/stashbox-clients";

const {
  stashBoxEndpoints,
  stashIds,
  scrapeResults,
  scenes,
  performers,
  scraperPackages,
} = schema;

// ─── Helpers ───────────────────────────────────────────────────────

function maskApiKey(key: string): string {
  if (key.length <= 4) return "••••";
  return "••••" + key.slice(-4);
}

// ─── Routes ────────────────────────────────────────────────────────

export async function stashboxRoutes(app: FastifyInstance) {
  // ─── GET /stashbox-endpoints ─────────────────────────────────────
  app.get("/stashbox-endpoints", async () => {
    const rows = await db
      .select()
      .from(stashBoxEndpoints)
      .orderBy(stashBoxEndpoints.name);

    return {
      endpoints: rows.map((r) => ({
        id: r.id,
        name: r.name,
        endpoint: r.endpoint,
        apiKeyPreview: maskApiKey(r.apiKey),
        enabled: r.enabled,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  });

  // ─── POST /stashbox-endpoints ────────────────────────────────────
  app.post("/stashbox-endpoints", async (request, reply) => {
    const body = request.body as {
      name: string;
      endpoint: string;
      apiKey: string;
    };

    if (!body.name || !body.endpoint || !body.apiKey) {
      return reply.code(400).send({ error: "name, endpoint, and apiKey are required" });
    }

    // Normalize endpoint URL
    let endpoint = body.endpoint.trim();
    if (!endpoint.endsWith("/graphql")) {
      endpoint = endpoint.replace(/\/$/, "") + "/graphql";
    }

    // Test connection before saving
    const client = new StashBoxClient(endpoint, body.apiKey);
    const test = await client.testConnection();
    if (!test.valid) {
      return reply.code(422).send({
        error: "Could not connect to StashBox endpoint",
        detail: test.error,
      });
    }

    const [created] = await db
      .insert(stashBoxEndpoints)
      .values({
        name: body.name.trim(),
        endpoint,
        apiKey: body.apiKey.trim(),
      })
      .returning();

    return reply.code(201).send({
      id: created.id,
      name: created.name,
      endpoint: created.endpoint,
      apiKeyPreview: maskApiKey(created.apiKey),
      enabled: created.enabled,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  });

  // ─── PATCH /stashbox-endpoints/:id ───────────────────────────────
  app.patch("/stashbox-endpoints/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      endpoint?: string;
      apiKey?: string;
      enabled?: boolean;
    };

    const [existing] = await db
      .select()
      .from(stashBoxEndpoints)
      .where(eq(stashBoxEndpoints.id, id))
      .limit(1);

    if (!existing) {
      return reply.code(404).send({ error: "StashBox endpoint not found" });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.endpoint !== undefined) {
      let endpoint = body.endpoint.trim();
      if (!endpoint.endsWith("/graphql")) {
        endpoint = endpoint.replace(/\/$/, "") + "/graphql";
      }
      updates.endpoint = endpoint;
    }
    if (body.apiKey !== undefined) updates.apiKey = body.apiKey.trim();
    if (body.enabled !== undefined) updates.enabled = body.enabled;

    await db
      .update(stashBoxEndpoints)
      .set(updates)
      .where(eq(stashBoxEndpoints.id, id));

    // URL or API key may have changed — drop any cached client so the next
    // request rebuilds with current credentials (and a fresh rate-limit bucket).
    invalidateStashBoxClient(id);

    const [updated] = await db
      .select()
      .from(stashBoxEndpoints)
      .where(eq(stashBoxEndpoints.id, id))
      .limit(1);

    return {
      id: updated.id,
      name: updated.name,
      endpoint: updated.endpoint,
      apiKeyPreview: maskApiKey(updated.apiKey),
      enabled: updated.enabled,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });

  // ─── DELETE /stashbox-endpoints/:id ──────────────────────────────
  app.delete("/stashbox-endpoints/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [deleted] = await db
      .delete(stashBoxEndpoints)
      .where(eq(stashBoxEndpoints.id, id))
      .returning({ id: stashBoxEndpoints.id });

    if (!deleted) {
      return reply.code(404).send({ error: "StashBox endpoint not found" });
    }
    invalidateStashBoxClient(id);
    return { ok: true };
  });

  // ─── POST /stashbox-endpoints/:id/test ───────────────────────────
  app.post("/stashbox-endpoints/:id/test", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [ep] = await db
      .select()
      .from(stashBoxEndpoints)
      .where(eq(stashBoxEndpoints.id, id))
      .limit(1);

    if (!ep) {
      return reply.code(404).send({ error: "StashBox endpoint not found" });
    }

    const client = getStashBoxClient(ep);
    const result = await client.testConnection();
    return result;
  });

  // ─── POST /stashbox-endpoints/:id/identify ───────────────────────
  // Scene identification via StashBox (fingerprint-first, then title)
  app.post("/stashbox-endpoints/:id/identify", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { sceneId: string };

    if (!body.sceneId) {
      return reply.code(400).send({ error: "Video id is required" });
    }

    const [ep] = await db
      .select()
      .from(stashBoxEndpoints)
      .where(eq(stashBoxEndpoints.id, id))
      .limit(1);

    if (!ep) {
      return reply.code(404).send({ error: "StashBox endpoint not found" });
    }

    if (!ep.enabled) {
      return reply.code(400).send({ error: "StashBox endpoint is disabled" });
    }

    // Load scene with fingerprints
    const [scene] = await db
      .select({
        id: scenes.id,
        title: scenes.title,
        checksumMd5: scenes.checksumMd5,
        oshash: scenes.oshash,
        phash: scenes.phash,
      })
      .from(scenes)
      .where(eq(scenes.id, body.sceneId))
      .limit(1);

    if (!scene) {
      return reply.code(404).send({ error: "Video not found" });
    }

    const client = getStashBoxClient(ep);
    const triedMethods: string[] = [];

    // Priority 1: Fingerprint lookup
    const fingerprints: StashBoxFingerprint[] = [];
    if (scene.oshash) fingerprints.push({ hash: scene.oshash, algorithm: "OSHASH" });
    if (scene.checksumMd5) fingerprints.push({ hash: scene.checksumMd5, algorithm: "MD5" });
    if (scene.phash) fingerprints.push({ hash: scene.phash, algorithm: "PHASH" });

    if (fingerprints.length > 0) {
      triedMethods.push("fingerprint");
      try {
        const results = await client.findScenesByFingerprints([fingerprints]);
        const matches = results[0];
        if (matches && matches.length > 0) {
          // Use first match
          const stashScene = matches[0];
          const normalized = normalizeStashBoxScene(stashScene);

          if (hasUsableNormalizedSceneResult(normalized)) {
            const rawResult = stashBoxSceneToRawResult(stashScene);
            const [result] = await db
              .insert(scrapeResults)
              .values({
                sceneId: scene.id,
                stashBoxEndpointId: ep.id,
                action: "findByFingerprint",
                matchType: "fingerprint",
                status: "pending",
                rawResult,
                proposedTitle: normalized.title,
                proposedDate: normalized.date,
                proposedDetails: normalized.details,
                proposedUrl: normalized.url,
                proposedStudioName: normalized.studioName,
                proposedPerformerNames: normalized.performerNames,
                proposedTagNames: normalized.tagNames,
                proposedImageUrl: normalized.imageUrl,
              })
              .returning();

            return { result, normalized, matchType: "fingerprint", triedMethods };
          }
        }
      } catch (err) {
        if (!(err instanceof StashBoxError)) throw err;
        // Non-fatal — try title search next
      }
    }

    // Priority 2: Title search
    if (scene.title) {
      triedMethods.push("title");
      try {
        const searchResults = await client.searchScenes(scene.title);
        if (searchResults.length > 0) {
          const stashScene = searchResults[0];
          const normalized = normalizeStashBoxScene(stashScene);

          if (hasUsableNormalizedSceneResult(normalized)) {
            const rawResult = stashBoxSceneToRawResult(stashScene);
            const [result] = await db
              .insert(scrapeResults)
              .values({
                sceneId: scene.id,
                stashBoxEndpointId: ep.id,
                action: "searchByTitle",
                matchType: "title",
                status: "pending",
                rawResult,
                proposedTitle: normalized.title,
                proposedDate: normalized.date,
                proposedDetails: normalized.details,
                proposedUrl: normalized.url,
                proposedStudioName: normalized.studioName,
                proposedPerformerNames: normalized.performerNames,
                proposedTagNames: normalized.tagNames,
                proposedImageUrl: normalized.imageUrl,
              })
              .returning();

            // For title search, also return additional results for selection
            const allNormalized = searchResults.map((s) => normalizeStashBoxScene(s));
            return {
              result,
              normalized,
              matchType: "title",
              triedMethods,
              additionalResults: allNormalized.slice(1),
            };
          }
        }
      } catch (err) {
        if (!(err instanceof StashBoxError)) throw err;
      }
    }

    return {
      result: null,
      message: `No results found. Tried: ${triedMethods.join(" → ")}`,
      triedMethods,
    };
  });

  // ─── POST /stashbox-endpoints/:id/identify-performer ─────────────
  app.post("/stashbox-endpoints/:id/identify-performer", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { performerId: string };

    if (!body.performerId) {
      return reply.code(400).send({ error: "Actor id is required" });
    }

    const [ep] = await db
      .select()
      .from(stashBoxEndpoints)
      .where(eq(stashBoxEndpoints.id, id))
      .limit(1);

    if (!ep || !ep.enabled) {
      return reply.code(ep ? 400 : 404).send({
        error: ep ? "StashBox endpoint is disabled" : "StashBox endpoint not found",
      });
    }

    const [performer] = await db
      .select({ id: performers.id, name: performers.name })
      .from(performers)
      .where(eq(performers.id, body.performerId))
      .limit(1);

    if (!performer) {
      return reply.code(404).send({ error: "Actor not found" });
    }

    const client = getStashBoxClient(ep);

    try {
      const results = await client.searchPerformers(performer.name);
      if (results.length === 0) {
        return { result: null, message: "No results found" };
      }

      const normalized = results.map((p) => normalizeStashBoxPerformer(p));
      return {
        results: normalized,
        rawResults: results,
        source: { type: "stashbox" as const, endpointId: ep.id, endpointName: ep.name },
      };
    } catch (err) {
      if (err instanceof StashBoxError) {
        return reply.code(502).send({ error: err.message });
      }
      throw err;
    }
  });

  // ─── Standalone Lookups ──────────────────────────────────────────

  // POST /stashbox-endpoints/:id/lookup/studio
  app.post("/stashbox-endpoints/:id/lookup/studio", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { query: string };

    if (!body.query) {
      return reply.code(400).send({ error: "query is required" });
    }

    const [ep] = await db
      .select()
      .from(stashBoxEndpoints)
      .where(eq(stashBoxEndpoints.id, id))
      .limit(1);

    if (!ep) return reply.code(404).send({ error: "StashBox endpoint not found" });

    const client = getStashBoxClient(ep);
    try {
      const studio = await client.findStudio(body.query);
      return { studio };
    } catch (err) {
      if (err instanceof StashBoxError) {
        return reply.code(502).send({ error: err.message });
      }
      throw err;
    }
  });

  // POST /stashbox-endpoints/:id/lookup/tag
  app.post("/stashbox-endpoints/:id/lookup/tag", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { query: string };

    if (!body.query) {
      return reply.code(400).send({ error: "query is required" });
    }

    const [ep] = await db
      .select()
      .from(stashBoxEndpoints)
      .where(eq(stashBoxEndpoints.id, id))
      .limit(1);

    if (!ep) return reply.code(404).send({ error: "StashBox endpoint not found" });

    const client = getStashBoxClient(ep);
    try {
      const tags = await client.queryTags(body.query);
      return { tags };
    } catch (err) {
      if (err instanceof StashBoxError) {
        return reply.code(502).send({ error: err.message });
      }
      throw err;
    }
  });

  // POST /stashbox-endpoints/:id/lookup/performer
  app.post("/stashbox-endpoints/:id/lookup/performer", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { query: string };

    if (!body.query) {
      return reply.code(400).send({ error: "query is required" });
    }

    const [ep] = await db
      .select()
      .from(stashBoxEndpoints)
      .where(eq(stashBoxEndpoints.id, id))
      .limit(1);

    if (!ep) return reply.code(404).send({ error: "StashBox endpoint not found" });

    const client = getStashBoxClient(ep);
    try {
      const performers = await client.searchPerformers(body.query);
      const normalized = performers.map((p) => normalizeStashBoxPerformer(p));
      return { performers: normalized, rawPerformers: performers };
    } catch (err) {
      if (err instanceof StashBoxError) {
        return reply.code(502).send({ error: err.message });
      }
      throw err;
    }
  });

  // ─── Stash ID CRUD ──────────────────────────────────────────────

  // GET /stash-ids?entityType=performer&entityId=xxx
  app.get("/stash-ids", async (request) => {
    const query = request.query as { entityType?: string; entityId?: string };
    const conditions = [];
    if (query.entityType) conditions.push(eq(stashIds.entityType, query.entityType));
    if (query.entityId) conditions.push(eq(stashIds.entityId, query.entityId));

    const rows = await db
      .select({
        id: stashIds.id,
        entityType: stashIds.entityType,
        entityId: stashIds.entityId,
        stashBoxEndpointId: stashIds.stashBoxEndpointId,
        stashId: stashIds.stashId,
        endpointName: stashBoxEndpoints.name,
        createdAt: stashIds.createdAt,
      })
      .from(stashIds)
      .innerJoin(stashBoxEndpoints, eq(stashIds.stashBoxEndpointId, stashBoxEndpoints.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(stashIds.createdAt);

    return {
      stashIds: rows.map((r) => ({
        id: r.id,
        entityType: r.entityType,
        entityId: r.entityId,
        endpointId: r.stashBoxEndpointId,
        endpointName: r.endpointName,
        stashId: r.stashId,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  // POST /stash-ids
  app.post("/stash-ids", async (request, reply) => {
    const body = request.body as {
      entityType: string;
      entityId: string;
      stashBoxEndpointId: string;
      stashId: string;
    };

    if (!body.entityType || !body.entityId || !body.stashBoxEndpointId || !body.stashId) {
      return reply.code(400).send({ error: "entityType, entityId, stashBoxEndpointId, and stashId are required" });
    }

    const validTypes = ["scene", "performer", "studio", "tag"];
    if (!validTypes.includes(body.entityType)) {
      return reply.code(400).send({ error: `entityType must be one of: ${validTypes.join(", ")}` });
    }

    try {
      const [created] = await db
        .insert(stashIds)
        .values({
          entityType: body.entityType,
          entityId: body.entityId,
          stashBoxEndpointId: body.stashBoxEndpointId,
          stashId: body.stashId.trim(),
        })
        .onConflictDoUpdate({
          target: [stashIds.entityType, stashIds.entityId, stashIds.stashBoxEndpointId],
          set: { stashId: body.stashId.trim(), updatedAt: new Date() },
        })
        .returning();

      // Fetch endpoint name for the response
      const [ep] = await db
        .select({ name: stashBoxEndpoints.name })
        .from(stashBoxEndpoints)
        .where(eq(stashBoxEndpoints.id, body.stashBoxEndpointId))
        .limit(1);

      return reply.code(201).send({
        id: created.id,
        entityType: created.entityType,
        entityId: created.entityId,
        endpointId: created.stashBoxEndpointId,
        endpointName: ep?.name ?? "Unknown",
        stashId: created.stashId,
        createdAt: created.createdAt.toISOString(),
      });
    } catch (err) {
      return reply.code(500).send({ error: err instanceof Error ? err.message : "Failed to create stash ID" });
    }
  });

  // DELETE /stash-ids/:id
  app.delete("/stash-ids/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [deleted] = await db
      .delete(stashIds)
      .where(eq(stashIds.id, id))
      .returning({ id: stashIds.id });

    if (!deleted) {
      return reply.code(404).send({ error: "Stash ID not found" });
    }
    return { ok: true };
  });

  // ─── GET /metadata-providers ─────────────────────────────────────
  // Unified list of all metadata sources (scrapers + stashbox endpoints)
  app.get("/metadata-providers", async () => {
    const [scrapers, stashBoxes] = await Promise.all([
      db.select().from(scraperPackages),
      db.select().from(stashBoxEndpoints),
    ]);

    const providers = [
      ...stashBoxes.map((sb) => ({
        id: sb.id,
        name: sb.name,
        type: "stashbox" as const,
        enabled: sb.enabled,
        capabilities: {
          sceneByFingerprint: true,
          sceneByName: true,
          performerByName: true,
          studioByName: true,
          tagByName: true,
        },
      })),
      ...scrapers.map((s) => ({
        id: s.id,
        name: s.name,
        type: "scraper" as const,
        enabled: s.enabled,
        capabilities: (s.capabilities ?? {}) as Record<string, boolean>,
      })),
    ];

    return { providers };
  });
}
