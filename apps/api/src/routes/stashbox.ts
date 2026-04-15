import type { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import { eq, and, desc, inArray } from "drizzle-orm";
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
  performers,
  scraperPackages,
  fingerprintSubmissions,
  videoEpisodes,
  videoMovies,
} = schema;

type VideoEntityKind = "video_episode" | "video_movie";

interface VideoFingerprintSource {
  kind: VideoEntityKind;
  id: string;
  title: string | null;
  duration: number | null;
  checksumMd5: string | null;
  oshash: string | null;
  phash: string | null;
}

async function loadVideoFingerprintSource(
  videoId: string,
): Promise<VideoFingerprintSource | null> {
  const [episode] = await db
    .select({
      id: videoEpisodes.id,
      title: videoEpisodes.title,
      duration: videoEpisodes.duration,
      checksumMd5: videoEpisodes.checksumMd5,
      oshash: videoEpisodes.oshash,
      phash: videoEpisodes.phash,
    })
    .from(videoEpisodes)
    .where(eq(videoEpisodes.id, videoId))
    .limit(1);
  if (episode) return { kind: "video_episode", ...episode };

  const [movie] = await db
    .select({
      id: videoMovies.id,
      title: videoMovies.title,
      duration: videoMovies.duration,
      checksumMd5: videoMovies.checksumMd5,
      oshash: videoMovies.oshash,
      phash: videoMovies.phash,
    })
    .from(videoMovies)
    .where(eq(videoMovies.id, videoId))
    .limit(1);
  if (movie) return { kind: "video_movie", ...movie };

  return null;
}

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

    // Load the target video entity (episode or movie). The body parameter
    // is still called `sceneId` for wire compatibility with existing web
    // clients.
    const scene = await loadVideoFingerprintSource(body.sceneId);

    if (!scene) {
      return reply.code(404).send({ error: "Video not found" });
    }

    const client = getStashBoxClient(ep);
    const triedMethods: string[] = [];

    // Priority 0: Short-circuit via known remote stash_id.
    // When the scene is already linked to a StashBox scene ID (from a previous
    // identify+accept, a manual paste, or an import), fetch it directly. That
    // skips the fingerprint/title cascade and keeps the contribution target
    // stable even when the file was re-encoded (new md5/oshash/phash).
    const [linkedStashId] = await db
      .select({ stashId: stashIds.stashId })
      .from(stashIds)
      .where(
        and(
          eq(stashIds.entityType, scene.kind),
          eq(stashIds.entityId, scene.id),
          eq(stashIds.stashBoxEndpointId, ep.id),
        ),
      )
      .limit(1);

    if (linkedStashId) {
      triedMethods.push("stashid");
      try {
        const stashScene = await client.findSceneById(linkedStashId.stashId);
        if (stashScene) {
          const normalized = normalizeStashBoxScene(stashScene);
          if (hasUsableNormalizedSceneResult(normalized)) {
            const rawResult = stashBoxSceneToRawResult(stashScene);
            const [result] = await db
              .insert(scrapeResults)
              .values({
                entityType: scene.kind, entityId: scene.id,
                stashBoxEndpointId: ep.id,
                action: "findById",
                matchType: "stashid",
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

            return { result, normalized, matchType: "stashid", triedMethods };
          }
        }
        // null or unusable → fall through to existing cascade so a deleted
        // upstream scene does not trap the user.
      } catch (err) {
        if (!(err instanceof StashBoxError)) throw err;
        // Non-fatal — fall through to fingerprint/title.
      }
    }

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
                entityType: scene.kind, entityId: scene.id,
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
                entityType: scene.kind, entityId: scene.id,
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

  // ─── POST /stashbox-endpoints/:id/submit-fingerprints ────────────
  // Submit every algorithm we have on a scene (md5/oshash/phash) to the
  // remote endpoint via the submitFingerprint mutation. Mirrors Stash's
  // SubmitFingerprints loop — one mutation per (scene, algorithm) pair,
  // serialized through the cached client's 240-rpm bucket.
  app.post(
    "/stashbox-endpoints/:id/submit-fingerprints",
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as {
        sceneId?: string;
        algorithms?: Array<"MD5" | "OSHASH" | "PHASH">;
      };

      if (!body.sceneId) {
        return reply.code(400).send({ error: "sceneId is required" });
      }

      const [ep] = await db
        .select()
        .from(stashBoxEndpoints)
        .where(eq(stashBoxEndpoints.id, id))
        .limit(1);
      if (!ep) return reply.code(404).send({ error: "StashBox endpoint not found" });
      if (!ep.enabled)
        return reply.code(400).send({ error: "StashBox endpoint is disabled" });

      const scene = await loadVideoFingerprintSource(body.sceneId);
      if (!scene) return reply.code(404).send({ error: "Video not found" });

      if (!scene.duration || scene.duration <= 0) {
        return reply
          .code(400)
          .send({ error: "Video duration is required to submit fingerprints" });
      }

      const [link] = await db
        .select({ stashId: stashIds.stashId })
        .from(stashIds)
        .where(
          and(
            eq(stashIds.entityType, scene.kind),
            eq(stashIds.entityId, scene.id),
            eq(stashIds.stashBoxEndpointId, ep.id),
          ),
        )
        .limit(1);
      if (!link) {
        return reply.code(404).send({
          error:
            "Video is not linked to this StashBox endpoint — run identify and accept a match first",
        });
      }

      const requested = body.algorithms
        ? new Set(body.algorithms)
        : new Set<"MD5" | "OSHASH" | "PHASH">(["MD5", "OSHASH", "PHASH"]);

      const candidates: Array<{
        algorithm: "MD5" | "OSHASH" | "PHASH";
        hash: string;
      }> = [];
      if (requested.has("MD5") && scene.checksumMd5)
        candidates.push({ algorithm: "MD5", hash: scene.checksumMd5 });
      if (requested.has("OSHASH") && scene.oshash)
        candidates.push({ algorithm: "OSHASH", hash: scene.oshash });
      if (requested.has("PHASH") && scene.phash)
        candidates.push({ algorithm: "PHASH", hash: scene.phash });

      if (candidates.length === 0) {
        return reply
          .code(400)
          .send({ error: "Scene has no fingerprints to submit" });
      }

      const client = getStashBoxClient(ep);
      const durationSeconds = Math.max(1, Math.round(scene.duration));
      const submissions: Array<{
        algorithm: "MD5" | "OSHASH" | "PHASH";
        hash: string;
        status: "success" | "error";
        error?: string;
      }> = [];

      for (const c of candidates) {
        let status: "success" | "error" = "error";
        let error: string | undefined;
        try {
          const ok = await client.submitFingerprint({
            scene_id: link.stashId,
            fingerprint: {
              hash: c.hash,
              algorithm: c.algorithm,
              duration: durationSeconds,
            },
          });
          status = ok ? "success" : "error";
          if (!ok) error = "Endpoint returned false";
        } catch (err) {
          status = "error";
          error = err instanceof Error ? err.message : String(err);
        }

        await db
          .insert(fingerprintSubmissions)
          .values({
            // sceneId is retained as the unique-constraint key post-finalize;
            // it no longer has an FK to scenes and is reused for the video
            // entity id. entityType / entityId mirror the key for new code
            // that wants a typed read path.
            sceneId: scene.id,
            entityType: scene.kind,
            entityId: scene.id,
            stashBoxEndpointId: ep.id,
            algorithm: c.algorithm,
            hash: c.hash,
            status,
            error: error ?? null,
          })
          .onConflictDoUpdate({
            target: [
              fingerprintSubmissions.sceneId,
              fingerprintSubmissions.stashBoxEndpointId,
              fingerprintSubmissions.algorithm,
              fingerprintSubmissions.hash,
            ],
            set: {
              status,
              error: error ?? null,
              submittedAt: new Date(),
            },
          });

        submissions.push({
          algorithm: c.algorithm,
          hash: c.hash,
          status,
          ...(error ? { error } : {}),
        });
      }

      return { submissions };
    },
  );

  // ─── GET /phash-contributions ────────────────────────────────────
  // Paginated list of scenes that have at least one linked stash_id,
  // with their stash_id chips, available fingerprint hashes, and the
  // latest submission state per (endpoint, algorithm). Drives the web
  // pHashes tab.
  app.get("/phash-contributions", async (request) => {
    const query = request.query as { page?: string; pageSize?: string };
    const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(query.pageSize ?? "25", 10) || 25),
    );
    const offset = (page - 1) * pageSize;

    // Pull all stash-id rows that point at a video entity (episode or
    // movie). The legacy `entityType = 'scene'` string is queried too so
    // pre-port rows continue to show up until the post-finalize data
    // migration rewrites them.
    const stashIdRows = await db
      .selectDistinct({
        entityId: stashIds.entityId,
        entityType: stashIds.entityType,
      })
      .from(stashIds)
      .where(
        inArray(stashIds.entityType, ["video_episode", "video_movie", "scene"]),
      )
      .orderBy(stashIds.entityId);

    const total = stashIdRows.length;
    const pageRows = stashIdRows.slice(offset, offset + pageSize);
    const pageIds = pageRows.map((r) => r.entityId);

    if (pageIds.length === 0) {
      return { total, page, pageSize, items: [] };
    }

    // Fetch matching video rows from both episode and movie tables.
    const [episodeRows, movieRows] = await Promise.all([
      db
        .select({
          id: videoEpisodes.id,
          title: videoEpisodes.title,
          thumbnailPath: videoEpisodes.thumbnailPath,
          duration: videoEpisodes.duration,
          checksumMd5: videoEpisodes.checksumMd5,
          oshash: videoEpisodes.oshash,
          phash: videoEpisodes.phash,
        })
        .from(videoEpisodes)
        .where(inArray(videoEpisodes.id, pageIds)),
      db
        .select({
          id: videoMovies.id,
          title: videoMovies.title,
          thumbnailPath: videoMovies.thumbnailPath,
          duration: videoMovies.duration,
          checksumMd5: videoMovies.checksumMd5,
          oshash: videoMovies.oshash,
          phash: videoMovies.phash,
        })
        .from(videoMovies)
        .where(inArray(videoMovies.id, pageIds)),
    ]);
    const sceneRows = [...episodeRows, ...movieRows];

    const linkRows = await db
      .select({
        id: stashIds.id,
        entityId: stashIds.entityId,
        endpointId: stashIds.stashBoxEndpointId,
        stashId: stashIds.stashId,
        endpointName: stashBoxEndpoints.name,
      })
      .from(stashIds)
      .innerJoin(
        stashBoxEndpoints,
        eq(stashIds.stashBoxEndpointId, stashBoxEndpoints.id),
      )
      .where(
        and(
          inArray(stashIds.entityType, [
            "video_episode",
            "video_movie",
            "scene",
          ]),
          inArray(stashIds.entityId, pageIds),
        ),
      );

    const submissionRows = await db
      .select({
        sceneId: fingerprintSubmissions.sceneId,
        endpointId: fingerprintSubmissions.stashBoxEndpointId,
        algorithm: fingerprintSubmissions.algorithm,
        hash: fingerprintSubmissions.hash,
        status: fingerprintSubmissions.status,
        error: fingerprintSubmissions.error,
        submittedAt: fingerprintSubmissions.submittedAt,
      })
      .from(fingerprintSubmissions)
      .where(inArray(fingerprintSubmissions.sceneId, pageIds))
      .orderBy(desc(fingerprintSubmissions.submittedAt));

    const items = sceneRows.map((scene) => ({
      scene: {
        id: scene.id,
        title: scene.title,
        thumbnailPath: scene.thumbnailPath,
        duration: scene.duration,
        checksumMd5: scene.checksumMd5,
        oshash: scene.oshash,
        phash: scene.phash,
      },
      stashIds: linkRows
        .filter((l) => l.entityId === scene.id)
        .map((l) => ({
          id: l.id,
          endpointId: l.endpointId,
          endpointName: l.endpointName,
          stashId: l.stashId,
        })),
      submissions: submissionRows
        .filter((s) => s.sceneId === scene.id)
        .map((s) => ({
          endpointId: s.endpointId,
          algorithm: s.algorithm,
          hash: s.hash,
          status: s.status,
          error: s.error,
          submittedAt: s.submittedAt.toISOString(),
        })),
    }));

    return { total, page, pageSize, items };
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
