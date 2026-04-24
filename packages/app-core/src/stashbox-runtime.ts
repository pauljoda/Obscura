import { and, desc, eq, inArray } from "drizzle-orm";
import { schema, type AppDb } from "@obscura/db";
import {
  StashBoxClient,
  StashBoxError,
  normalizeStashBoxPerformer,
  normalizeStashBoxScene,
  stashBoxSceneToRawResult,
  type StashBoxFingerprint,
} from "@obscura/stash-import/stashbox";
import { hasUsableNormalizedSceneResult } from "@obscura/stash-import/normalizer";
import {
  NotFoundError,
  UnprocessableError,
  UpstreamError,
  ValidationError,
} from "./errors";

const {
  fingerprintSubmissions,
  performers,
  scrapeResults,
  scraperPackages,
  stashBoxEndpoints,
  stashIds,
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

type EndpointLike = { id: string; endpoint: string; apiKey: string };

export interface CreateStashBoxEndpointInput {
  name: string;
  endpoint: string;
  apiKey: string;
}

export interface UpdateStashBoxEndpointInput {
  id: string;
  name?: string;
  endpoint?: string;
  apiKey?: string;
  enabled?: boolean;
}

export interface DeleteStashBoxEndpointInput {
  id: string;
}

export interface TestStashBoxEndpointInput {
  id: string;
}

export interface IdentifyVideoViaStashBoxInput {
  endpointId: string;
  videoId: string;
}

export interface IdentifyPerformerViaStashBoxInput {
  endpointId: string;
  performerId: string;
}

export interface LookupStashBoxEntityInput {
  endpointId: string;
  query: string;
}

export interface ListStashIdsInput {
  entityType?: string;
  entityId?: string;
}

export interface CreateStashIdInput {
  entityType: string;
  entityId: string;
  stashBoxEndpointId: string;
  stashId: string;
}

export interface DeleteStashIdInput {
  id: string;
}

export interface SubmitFingerprintsToEndpointInput {
  endpointId: string;
  videoId?: string;
  algorithms?: Array<"MD5" | "OSHASH" | "PHASH">;
}

export interface ListPhashContributionsInput {
  page?: string | number;
  pageSize?: string | number;
}

const clients = new Map<string, StashBoxClient>();

function getStashBoxClient(endpoint: EndpointLike): StashBoxClient {
  const existing = clients.get(endpoint.id);
  if (existing) return existing;
  const client = new StashBoxClient(endpoint.endpoint, endpoint.apiKey);
  clients.set(endpoint.id, client);
  return client;
}

function invalidateStashBoxClient(endpointId: string) {
  clients.delete(endpointId);
}

function maskApiKey(key: string): string {
  if (key.length <= 4) return "••••";
  return "••••" + key.slice(-4);
}

function normalizeEndpointUrl(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed.endsWith("/graphql")) {
    return trimmed.replace(/\/$/, "") + "/graphql";
  }
  return trimmed;
}

function toEndpointEntry(row: typeof stashBoxEndpoints.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    endpoint: row.endpoint,
    apiKeyPreview: maskApiKey(row.apiKey),
    enabled: row.enabled,
    isNsfw: true as const,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadVideoFingerprintSource(
  db: AppDb,
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

async function requireEndpoint(db: AppDb, endpointId: string) {
  const [ep] = await db
    .select()
    .from(stashBoxEndpoints)
    .where(eq(stashBoxEndpoints.id, endpointId))
    .limit(1);
  if (!ep) {
    throw new NotFoundError("StashBox endpoint not found");
  }
  return ep;
}

function mapStashBoxError(error: unknown): never {
  if (error instanceof StashBoxError) {
    throw new UpstreamError(error.message);
  }
  throw error;
}

export async function createStashBoxEndpointWrite(
  db: AppDb,
  input: CreateStashBoxEndpointInput,
) {
  if (!input.name || !input.endpoint || !input.apiKey) {
    throw new ValidationError("name, endpoint, and apiKey are required");
  }

  const endpoint = normalizeEndpointUrl(input.endpoint);
  const client = new StashBoxClient(endpoint, input.apiKey);
  const test = await client.testConnection();
  if (!test.valid) {
    throw new UnprocessableError("Could not connect to StashBox endpoint", {
      detail: test.error,
    });
  }

  const [created] = await db
    .insert(stashBoxEndpoints)
    .values({
      name: input.name.trim(),
      endpoint,
      apiKey: input.apiKey.trim(),
    })
    .returning();

  invalidateStashBoxClient(created.id);
  return toEndpointEntry(created);
}

export async function updateStashBoxEndpointWrite(
  db: AppDb,
  input: UpdateStashBoxEndpointInput,
) {
  const existing = await requireEndpoint(db, input.id);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.endpoint !== undefined) updates.endpoint = normalizeEndpointUrl(input.endpoint);
  if (input.apiKey !== undefined) updates.apiKey = input.apiKey.trim();
  if (input.enabled !== undefined) updates.enabled = input.enabled;

  await db
    .update(stashBoxEndpoints)
    .set(updates)
    .where(eq(stashBoxEndpoints.id, input.id));
  if (
    input.endpoint !== undefined ||
    input.apiKey !== undefined ||
    input.enabled !== undefined ||
    existing.endpoint !== updates.endpoint
  ) {
    invalidateStashBoxClient(input.id);
  }

  const updated = await requireEndpoint(db, input.id);
  return toEndpointEntry(updated);
}

export async function deleteStashBoxEndpointWrite(
  db: AppDb,
  input: DeleteStashBoxEndpointInput,
) {
  const [deleted] = await db
    .delete(stashBoxEndpoints)
    .where(eq(stashBoxEndpoints.id, input.id))
    .returning({ id: stashBoxEndpoints.id });
  if (!deleted) {
    throw new NotFoundError("StashBox endpoint not found");
  }
  invalidateStashBoxClient(input.id);
  return { ok: true as const };
}

export async function testStashBoxEndpointWrite(
  db: AppDb,
  input: TestStashBoxEndpointInput,
) {
  const ep = await requireEndpoint(db, input.id);
  return getStashBoxClient(ep).testConnection();
}

export async function identifyVideoViaStashBoxWrite(
  db: AppDb,
  input: IdentifyVideoViaStashBoxInput,
) {
  if (!input.videoId) {
    throw new ValidationError("Video id is required");
  }

  const ep = await requireEndpoint(db, input.endpointId);
  if (!ep.enabled) {
    throw new ValidationError("StashBox endpoint is disabled");
  }

  const scene = await loadVideoFingerprintSource(db, input.videoId);
  if (!scene) {
    throw new NotFoundError("Video not found");
  }

  const client = getStashBoxClient(ep);
  const triedMethods: string[] = [];

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
              entityType: scene.kind,
              entityId: scene.id,
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
    } catch (error) {
      if (!(error instanceof StashBoxError)) throw error;
    }
  }

  const fingerprints: StashBoxFingerprint[] = [];
  if (scene.oshash) fingerprints.push({ hash: scene.oshash, algorithm: "OSHASH" });
  if (scene.checksumMd5) {
    fingerprints.push({ hash: scene.checksumMd5, algorithm: "MD5" });
  }
  if (scene.phash) fingerprints.push({ hash: scene.phash, algorithm: "PHASH" });

  if (fingerprints.length > 0) {
    triedMethods.push("fingerprint");
    try {
      const results = await client.findScenesByFingerprints([fingerprints]);
      const matches = results[0];
      if (matches && matches.length > 0) {
        const stashScene = matches[0];
        const normalized = normalizeStashBoxScene(stashScene);
        if (hasUsableNormalizedSceneResult(normalized)) {
          const rawResult = stashBoxSceneToRawResult(stashScene);
          const [result] = await db
            .insert(scrapeResults)
            .values({
              entityType: scene.kind,
              entityId: scene.id,
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
    } catch (error) {
      if (!(error instanceof StashBoxError)) throw error;
    }
  }

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
              entityType: scene.kind,
              entityId: scene.id,
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

          const allNormalized = searchResults.map((sceneResult) =>
            normalizeStashBoxScene(sceneResult),
          );
          return {
            result,
            normalized,
            matchType: "title",
            triedMethods,
            additionalResults: allNormalized.slice(1),
          };
        }
      }
    } catch (error) {
      if (!(error instanceof StashBoxError)) throw error;
    }
  }

  return {
    result: null,
    message: `No results found. Tried: ${triedMethods.join(" → ")}`,
    triedMethods,
  };
}

export async function identifyPerformerViaStashBoxWrite(
  db: AppDb,
  input: IdentifyPerformerViaStashBoxInput,
) {
  if (!input.performerId) {
    throw new ValidationError("Actor id is required");
  }

  const ep = await requireEndpoint(db, input.endpointId);
  if (!ep.enabled) {
    throw new ValidationError("StashBox endpoint is disabled");
  }

  const [performer] = await db
    .select({ id: performers.id, name: performers.name })
    .from(performers)
    .where(eq(performers.id, input.performerId))
    .limit(1);
  if (!performer) {
    throw new NotFoundError("Actor not found");
  }

  try {
    const results = await getStashBoxClient(ep).searchPerformers(performer.name);
    if (results.length === 0) {
      return { result: null, message: "No results found" };
    }

    return {
      results: results.map((item) => normalizeStashBoxPerformer(item)),
      rawResults: results,
      source: { type: "stashbox" as const, endpointId: ep.id, endpointName: ep.name },
    };
  } catch (error) {
    mapStashBoxError(error);
  }
}

export async function lookupStudioViaStashBoxWrite(
  db: AppDb,
  input: LookupStashBoxEntityInput,
) {
  if (!input.query) {
    throw new ValidationError("query is required");
  }
  const ep = await requireEndpoint(db, input.endpointId);
  try {
    const studio = await getStashBoxClient(ep).findStudio(input.query);
    return { studio };
  } catch (error) {
    mapStashBoxError(error);
  }
}

export async function lookupTagViaStashBoxWrite(
  db: AppDb,
  input: LookupStashBoxEntityInput,
) {
  if (!input.query) {
    throw new ValidationError("query is required");
  }
  const ep = await requireEndpoint(db, input.endpointId);
  try {
    const tags = await getStashBoxClient(ep).queryTags(input.query);
    return { tags };
  } catch (error) {
    mapStashBoxError(error);
  }
}

export async function lookupPerformerViaStashBoxWrite(
  db: AppDb,
  input: LookupStashBoxEntityInput,
) {
  if (!input.query) {
    throw new ValidationError("query is required");
  }
  const ep = await requireEndpoint(db, input.endpointId);
  try {
    const performers = await getStashBoxClient(ep).searchPerformers(input.query);
    return {
      performers: performers.map((item) => normalizeStashBoxPerformer(item)),
      rawPerformers: performers,
    };
  } catch (error) {
    mapStashBoxError(error);
  }
}

export async function listMetadataProvidersRead(db: AppDb) {
  const [scrapers, stashBoxes] = await Promise.all([
    db.select().from(scraperPackages),
    db.select().from(stashBoxEndpoints),
  ]);

  return {
    providers: [
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
      ...scrapers.map((scraper) => ({
        id: scraper.id,
        name: scraper.name,
        type: "scraper" as const,
        enabled: scraper.enabled,
        capabilities: (scraper.capabilities ?? {}) as Record<string, boolean>,
      })),
    ],
  };
}

export async function listStashIdsRead(db: AppDb, input: ListStashIdsInput = {}) {
  const conditions = [];
  if (input.entityType) conditions.push(eq(stashIds.entityType, input.entityType));
  if (input.entityId) conditions.push(eq(stashIds.entityId, input.entityId));

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
    stashIds: rows.map((row) => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      endpointId: row.stashBoxEndpointId,
      endpointName: row.endpointName,
      stashId: row.stashId,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function createStashIdWrite(db: AppDb, input: CreateStashIdInput) {
  if (
    !input.entityType ||
    !input.entityId ||
    !input.stashBoxEndpointId ||
    !input.stashId
  ) {
    throw new ValidationError(
      "entityType, entityId, stashBoxEndpointId, and stashId are required",
    );
  }

  const validTypes = [
    "video",
    "video_episode",
    "video_movie",
    "scene",
    "performer",
    "studio",
    "tag",
  ];
  if (!validTypes.includes(input.entityType)) {
    throw new ValidationError(
      `entityType must be one of: ${validTypes.join(", ")}`,
    );
  }

  const [created] = await db
    .insert(stashIds)
    .values({
      entityType: input.entityType,
      entityId: input.entityId,
      stashBoxEndpointId: input.stashBoxEndpointId,
      stashId: input.stashId.trim(),
    })
    .onConflictDoUpdate({
      target: [stashIds.entityType, stashIds.entityId, stashIds.stashBoxEndpointId],
      set: { stashId: input.stashId.trim(), updatedAt: new Date() },
    })
    .returning();

  const [ep] = await db
    .select({ name: stashBoxEndpoints.name })
    .from(stashBoxEndpoints)
    .where(eq(stashBoxEndpoints.id, input.stashBoxEndpointId))
    .limit(1);

  return {
    id: created.id,
    entityType: created.entityType,
    entityId: created.entityId,
    endpointId: created.stashBoxEndpointId,
    endpointName: ep?.name ?? "Unknown",
    stashId: created.stashId,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function deleteStashIdWrite(db: AppDb, input: DeleteStashIdInput) {
  const [deleted] = await db
    .delete(stashIds)
    .where(eq(stashIds.id, input.id))
    .returning({ id: stashIds.id });
  if (!deleted) {
    throw new NotFoundError("Stash ID not found");
  }
  return { ok: true as const };
}

export async function submitFingerprintsToEndpointWrite(
  db: AppDb,
  input: SubmitFingerprintsToEndpointInput,
) {
  if (!input.videoId) {
    throw new ValidationError("videoId is required");
  }

  const ep = await requireEndpoint(db, input.endpointId);
  if (!ep.enabled) {
    throw new ValidationError("StashBox endpoint is disabled");
  }

  const scene = await loadVideoFingerprintSource(db, input.videoId);
  if (!scene) {
    throw new NotFoundError("Video not found");
  }
  if (!scene.duration || scene.duration <= 0) {
    throw new ValidationError("Video duration is required to submit fingerprints");
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
    throw new NotFoundError(
      "Video is not linked to this StashBox endpoint — run identify and accept a match first",
    );
  }

  const requested = input.algorithms
    ? new Set(input.algorithms)
    : new Set<"MD5" | "OSHASH" | "PHASH">(["MD5", "OSHASH", "PHASH"]);
  const candidates: Array<{ algorithm: "MD5" | "OSHASH" | "PHASH"; hash: string }> =
    [];
  if (requested.has("MD5") && scene.checksumMd5) {
    candidates.push({ algorithm: "MD5", hash: scene.checksumMd5 });
  }
  if (requested.has("OSHASH") && scene.oshash) {
    candidates.push({ algorithm: "OSHASH", hash: scene.oshash });
  }
  if (requested.has("PHASH") && scene.phash) {
    candidates.push({ algorithm: "PHASH", hash: scene.phash });
  }
  if (candidates.length === 0) {
    throw new ValidationError("Video has no fingerprints to submit");
  }

  const durationSeconds = Math.max(1, Math.round(scene.duration));
  const submissions: Array<{
    algorithm: "MD5" | "OSHASH" | "PHASH";
    hash: string;
    status: "success" | "error";
    error?: string;
  }> = [];

  for (const candidate of candidates) {
    let status: "success" | "error" = "error";
    let error: string | undefined;
    try {
      const ok = await getStashBoxClient(ep).submitFingerprint({
        scene_id: link.stashId,
        fingerprint: {
          hash: candidate.hash,
          algorithm: candidate.algorithm,
          duration: durationSeconds,
        },
      });
      status = ok ? "success" : "error";
      if (!ok) error = "Endpoint returned false";
    } catch (cause) {
      status = "error";
      error = cause instanceof Error ? cause.message : String(cause);
    }

    await db
      .insert(fingerprintSubmissions)
      .values({
        sceneId: scene.id,
        entityType: scene.kind,
        entityId: scene.id,
        stashBoxEndpointId: ep.id,
        algorithm: candidate.algorithm,
        hash: candidate.hash,
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
      algorithm: candidate.algorithm,
      hash: candidate.hash,
      status,
      ...(error ? { error } : {}),
    });
  }

  return { submissions };
}

export async function listPhashContributionsRead(
  db: AppDb,
  input: ListPhashContributionsInput = {},
) {
  const page = Math.max(1, Number.parseInt(String(input.page ?? "1"), 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(String(input.pageSize ?? "25"), 10) || 25),
  );
  const offset = (page - 1) * pageSize;

  const stashIdRows = await db
    .selectDistinct({ entityId: stashIds.entityId, entityType: stashIds.entityType })
    .from(stashIds)
    .where(inArray(stashIds.entityType, ["video_episode", "video_movie", "video"]))
    .orderBy(stashIds.entityId);

  const total = stashIdRows.length;
  const pageRows = stashIdRows.slice(offset, offset + pageSize);
  const pageIds = pageRows.map((row) => row.entityId);

  if (pageIds.length === 0) {
    return { total, page, pageSize, items: [] };
  }

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
    .innerJoin(stashBoxEndpoints, eq(stashIds.stashBoxEndpointId, stashBoxEndpoints.id))
    .where(
      and(
        inArray(stashIds.entityType, ["video_episode", "video_movie", "scene"]),
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

  const items = sceneRows.map((video) => ({
    video: {
      id: video.id,
      title: video.title,
      thumbnailPath: video.thumbnailPath,
      duration: video.duration,
      checksumMd5: video.checksumMd5,
      oshash: video.oshash,
      phash: video.phash,
    },
    stashIds: linkRows
      .filter((row) => row.entityId === video.id)
      .map((row) => ({
        id: row.id,
        endpointId: row.endpointId,
        endpointName: row.endpointName,
        stashId: row.stashId,
      })),
    submissions: submissionRows
      .filter((row) => row.sceneId === video.id)
      .map((row) => ({
        endpointId: row.endpointId,
        algorithm: row.algorithm,
        hash: row.hash,
        status: row.status,
        error: row.error,
        submittedAt: row.submittedAt.toISOString(),
      })),
  }));

  return { total, page, pageSize, items };
}
