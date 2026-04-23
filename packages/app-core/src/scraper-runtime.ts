import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";
import yaml from "js-yaml";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { getCacheRootDir, getGeneratedPerformerDir, getGeneratedVideoDir } from "@obscura/media-core";
import { schema, type AppDb } from "@obscura/db";
import {
  ScraperExecutionError,
  hasUsableNormalizedSceneResult,
  normalizePerformerResult,
  normalizeSceneResult,
  parseScraperYaml,
  scrapePerformer,
  scrapeScene,
  type ScraperPerformerFragment,
  type ScraperSceneFragment,
  type StashScrapedPerformer,
  type StashScrapedScene,
} from "@obscura/stash-import";
import {
  ConflictError,
  InternalError,
  NotFoundError,
  UpstreamError,
  ValidationError,
} from "./errors";

const {
  performers,
  pluginPackages,
  scrapeResults,
  scraperPackages,
  stashIds,
  studios,
  tags,
  videoEpisodePerformers,
  videoEpisodeTags,
  videoEpisodes,
  videoMoviePerformers,
  videoMovieTags,
  videoMovies,
  videoSeries,
  videoSeriesPerformers,
  videoSeriesTags,
} = schema;

type VideoEntityKind = "video_episode" | "video_movie";
type SceneAction =
  | "sceneByURL"
  | "sceneByFragment"
  | "sceneByName"
  | "sceneByQueryFragment";
type PerformerAction =
  | "performerByURL"
  | "performerByName"
  | "performerByFragment";

interface VideoSceneSource {
  kind: VideoEntityKind;
  id: string;
  title: string | null;
  date: string | null;
  details: string | null;
  url: string | null;
  duration: number | null;
  checksumMd5: string | null;
  oshash: string | null;
  phash: string | null;
  filePath: string | null;
}

interface CommunityIndexEntry {
  id: string;
  name: string;
  version: string;
  date: string;
  path: string;
  sha256: string;
  requires?: string[];
}

export interface FetchCommunityScraperIndexInput {
  force?: boolean;
}

export interface InstallScraperPackageInput {
  packageId: string;
  zipUrl?: string;
  sha256?: string;
}

export interface DeleteScraperPackageInput {
  id: string;
}

export interface UpdateScraperPackageInput {
  id: string;
  enabled?: boolean;
}

export interface ScrapeVideoInput {
  scraperId: string;
  videoId: string;
  action?: string;
  url?: string;
  query?: string;
}

export interface ScrapePerformerInput {
  scraperId: string;
  performerId: string;
  action?: string;
  url?: string;
  query?: string;
}

export interface ListScrapeResultsInput {
  status?: string;
  videoId?: string;
  limit?: string | number;
  offset?: string | number;
}

export interface ScrapeResultDetailInput {
  id: string;
}

export interface AcceptScrapeResultInput {
  id: string;
  fields?: string[];
  excludePerformers?: string[];
  excludeTags?: string[];
}

export interface RejectScrapeResultInput {
  id: string;
}

export interface ApplyPerformerScrapeInput {
  performerId: string;
  fields: Record<string, unknown>;
  selectedFields: string[];
}

type TxArg = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

const COMMUNITY_INDEX_URL =
  process.env.SCRAPER_INDEX_URL ??
  "https://stashapp.github.io/CommunityScrapers/stable/index.yml";
const INDEX_CACHE_TTL = 5 * 60 * 1000;

let indexCache: { data: CommunityIndexEntry[]; fetchedAt: number } | null = null;

function getScrapersDir() {
  return path.join(getCacheRootDir(), "scrapers");
}

async function loadVideoSource(
  db: AppDb,
  videoId: string,
): Promise<VideoSceneSource | null> {
  const [episode] = await db
    .select({
      id: videoEpisodes.id,
      title: videoEpisodes.title,
      airDate: videoEpisodes.airDate,
      overview: videoEpisodes.overview,
      duration: videoEpisodes.duration,
      checksumMd5: videoEpisodes.checksumMd5,
      oshash: videoEpisodes.oshash,
      phash: videoEpisodes.phash,
      filePath: videoEpisodes.filePath,
    })
    .from(videoEpisodes)
    .where(eq(videoEpisodes.id, videoId))
    .limit(1);
  if (episode) {
    return {
      kind: "video_episode",
      id: episode.id,
      title: episode.title,
      date: episode.airDate,
      details: episode.overview,
      url: null,
      duration: episode.duration,
      checksumMd5: episode.checksumMd5,
      oshash: episode.oshash,
      phash: episode.phash,
      filePath: episode.filePath,
    };
  }

  const [movie] = await db
    .select({
      id: videoMovies.id,
      title: videoMovies.title,
      releaseDate: videoMovies.releaseDate,
      overview: videoMovies.overview,
      duration: videoMovies.duration,
      checksumMd5: videoMovies.checksumMd5,
      oshash: videoMovies.oshash,
      phash: videoMovies.phash,
      filePath: videoMovies.filePath,
    })
    .from(videoMovies)
    .where(eq(videoMovies.id, videoId))
    .limit(1);
  if (movie) {
    return {
      kind: "video_movie",
      id: movie.id,
      title: movie.title,
      date: movie.releaseDate,
      details: movie.overview,
      url: null,
      duration: movie.duration,
      checksumMd5: movie.checksumMd5,
      oshash: movie.oshash,
      phash: movie.phash,
      filePath: movie.filePath,
    };
  }

  return null;
}

async function fetchCommunityIndex(force = false): Promise<CommunityIndexEntry[]> {
  if (!force && indexCache && Date.now() - indexCache.fetchedAt < INDEX_CACHE_TTL) {
    return indexCache.data;
  }

  let res: Response;
  try {
    res = await fetch(COMMUNITY_INDEX_URL);
  } catch (error) {
    throw new UpstreamError(
      error instanceof Error
        ? `Failed to fetch community index: ${error.message}`
        : "Failed to fetch community index",
    );
  }

  if (!res.ok) {
    throw new UpstreamError(
      `Failed to fetch community index: ${res.status} ${res.statusText}`,
    );
  }

  const text = await res.text();
  const entries = yaml.load(text, {
    schema: yaml.JSON_SCHEMA,
  }) as CommunityIndexEntry[];

  if (!Array.isArray(entries)) {
    throw new ValidationError("Invalid community index format");
  }

  indexCache = { data: entries, fetchedAt: Date.now() };
  return entries;
}

async function downloadAndExtract(
  zipUrl: string,
  expectedSha256: string,
  destDir: string,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(zipUrl);
  } catch (error) {
    throw new UpstreamError(
      error instanceof Error
        ? `Failed to download scraper: ${error.message}`
        : "Failed to download scraper",
    );
  }

  if (!res.ok) {
    throw new UpstreamError(`Failed to download scraper: ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const hash = createHash("sha256").update(buffer).digest("hex");
  if (hash !== expectedSha256) {
    throw new ValidationError(
      `SHA256 mismatch: expected ${expectedSha256}, got ${hash}`,
    );
  }

  await mkdir(destDir, { recursive: true });
  const files = unzipSync(new Uint8Array(buffer));
  for (const [filePath, data] of Object.entries(files)) {
    if (filePath.endsWith("/")) continue;
    const fullPath = path.join(destDir, filePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
  }
}

async function requireScraperPackage(db: AppDb, id: string) {
  const [pkg] = await db
    .select()
    .from(scraperPackages)
    .where(eq(scraperPackages.id, id))
    .limit(1);
  if (!pkg) {
    throw new NotFoundError("Scraper package not found");
  }
  return pkg;
}

async function resolveScraperYamlPath(installPath: string) {
  const files = await readdir(installPath);
  const ymlFile = files.find((file) => file.endsWith(".yml") || file.endsWith(".yaml"));
  if (!ymlFile) {
    throw new InternalError("Scraper YAML definition not found");
  }
  return path.join(installPath, ymlFile);
}

async function writeImageFromUrl(imageUrl: string, destPath: string): Promise<void> {
  let buffer: Buffer;
  if (imageUrl.startsWith("data:image/")) {
    const base64Data = imageUrl.split(",")[1];
    if (!base64Data) {
      throw new ValidationError("Invalid data URL");
    }
    buffer = Buffer.from(base64Data, "base64");
  } else {
    let res: Response;
    try {
      res = await fetch(imageUrl);
    } catch {
      throw new UpstreamError("Failed to download image");
    }
    if (!res.ok) {
      throw new UpstreamError(`Failed to fetch image: ${res.status}`);
    }
    buffer = Buffer.from(await res.arrayBuffer());
  }

  await mkdir(path.dirname(destPath), { recursive: true });
  await writeFile(destPath, buffer);
}

async function findOrCreateStudio(
  tx: TxArg,
  name: string,
  studioData?:
    | {
        url?: string;
        urls?: string[];
        image?: string;
        parent?: {
          name: string;
          url?: string;
          urls?: string[];
          image?: string;
        };
      }
    | null,
  isNsfw = true,
): Promise<string> {
  const studioUrl = studioData?.url ?? studioData?.urls?.[0] ?? null;
  const studioImage = studioData?.image ?? null;

  const [existing] = await tx
    .select({
      id: studios.id,
      url: studios.url,
      imageUrl: studios.imageUrl,
      parentId: studios.parentId,
    })
    .from(studios)
    .where(ilike(studios.name, name))
    .limit(1);

  if (existing) {
    const backfill: Record<string, unknown> = {};
    if (!existing.url && studioUrl) backfill.url = studioUrl;
    if (!existing.imageUrl && studioImage) backfill.imageUrl = studioImage;
    if (!existing.parentId && studioData?.parent?.name) {
      backfill.parentId = await findOrCreateStudio(
        tx,
        studioData.parent.name,
        studioData.parent,
        isNsfw,
      );
    }
    if (Object.keys(backfill).length > 0) {
      await tx
        .update(studios)
        .set({ ...backfill, updatedAt: new Date() })
        .where(eq(studios.id, existing.id));
    }
    return existing.id;
  }

  let parentId: string | null = null;
  if (studioData?.parent?.name) {
    parentId = await findOrCreateStudio(tx, studioData.parent.name, studioData.parent, isNsfw);
  }

  const [created] = await tx
    .insert(studios)
    .values({
      name,
      url: studioUrl,
      imageUrl: studioImage,
      parentId,
      isNsfw,
    })
    .returning({ id: studios.id });
  return created.id;
}

export async function fetchCommunityScraperIndexRead(
  db: AppDb,
  input: FetchCommunityScraperIndexInput = {},
) {
  const entries = await fetchCommunityIndex(Boolean(input.force));
  const installed = await db.select().from(scraperPackages);
  const installedMap = new Map(installed.map((pkg) => [pkg.packageId, pkg]));

  return {
    entries: entries.map((entry) => {
      const pkg = installedMap.get(entry.id);
      return {
        ...entry,
        installed: Boolean(pkg),
        installedVersion: pkg?.version ?? null,
      };
    }),
  };
}

export async function installScraperPackageWrite(
  db: AppDb,
  input: InstallScraperPackageInput,
) {
  if (!input.packageId) {
    throw new ValidationError("packageId is required");
  }
  if (
    input.packageId.includes("..") ||
    input.packageId.includes("/") ||
    input.packageId.includes("\\")
  ) {
    throw new ValidationError(
      "Invalid packageId: path traversal characters not allowed",
    );
  }

  let zipUrl = input.zipUrl;
  let sha256 = input.sha256;

  if (!zipUrl) {
    const entries = await fetchCommunityIndex();
    const entry = entries.find((item) => item.id === input.packageId);
    if (!entry) {
      throw new NotFoundError(
        `Package "${input.packageId}" not found in community index`,
      );
    }

    const indexBase = COMMUNITY_INDEX_URL.replace(/\/[^/]+$/, "/");
    zipUrl = entry.path.startsWith("http") ? entry.path : `${indexBase}${entry.path}`;
    sha256 = entry.sha256;
  }

  if (!sha256) {
    throw new ValidationError("sha256 is required for integrity verification");
  }

  const scrapersDir = getScrapersDir();
  const destDir = path.join(scrapersDir, input.packageId);

  await downloadAndExtract(zipUrl, sha256, destDir);

  const files = await readdir(destDir);
  const ymlFile = files.find((file) => file.endsWith(".yml") || file.endsWith(".yaml"));
  if (!ymlFile) {
    await rm(destDir, { recursive: true, force: true });
    throw new ValidationError("No scraper definition (.yml) found in package");
  }

  const yamlPath = path.join(destDir, ymlFile);
  const { definition, capabilities } = await parseScraperYaml(yamlPath);
  const entries = await fetchCommunityIndex();
  const indexEntry = entries.find((item) => item.id === input.packageId);

  const [pkg] = await db
    .insert(scraperPackages)
    .values({
      packageId: input.packageId,
      name: definition.name,
      version: indexEntry?.version ?? "unknown",
      installPath: destDir,
      sha256,
      capabilities: { ...capabilities } as Record<string, boolean>,
      enabled: true,
    })
    .onConflictDoUpdate({
      target: scraperPackages.packageId,
      set: {
        name: definition.name,
        version: indexEntry?.version ?? "unknown",
        installPath: destDir,
        sha256,
        capabilities: { ...capabilities } as Record<string, boolean>,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (indexEntry?.requires) {
    const indexBase = COMMUNITY_INDEX_URL.replace(/\/[^/]+$/, "/");
    for (const dep of indexEntry.requires) {
      const depEntry = entries.find((item) => item.id === dep);
      if (!depEntry) continue;

      const depDir = path.join(scrapersDir, dep);
      if (existsSync(depDir)) continue;

      const depZipUrl = depEntry.path.startsWith("http")
        ? depEntry.path
        : `${indexBase}${depEntry.path}`;

      try {
        await downloadAndExtract(depZipUrl, depEntry.sha256, depDir);
      } catch {
        // Dependency installation is best-effort to mirror Fastify.
      }
    }
  }

  return pkg;
}

export async function deleteScraperPackageWrite(
  db: AppDb,
  input: DeleteScraperPackageInput,
) {
  const [pkg] = await db
    .select()
    .from(scraperPackages)
    .where(eq(scraperPackages.id, input.id))
    .limit(1);
  if (!pkg) {
    throw new NotFoundError("Package not found");
  }

  if (pkg.installPath && existsSync(pkg.installPath)) {
    await rm(pkg.installPath, { recursive: true, force: true });
  }

  await db.delete(scraperPackages).where(eq(scraperPackages.id, input.id));
  return { ok: true as const };
}

export async function updateScraperPackageWrite(
  db: AppDb,
  input: UpdateScraperPackageInput,
) {
  const [pkg] = await db
    .update(scraperPackages)
    .set({
      enabled: input.enabled,
      updatedAt: new Date(),
    })
    .where(eq(scraperPackages.id, input.id))
    .returning();

  if (!pkg) {
    throw new NotFoundError("Package not found");
  }

  return pkg;
}

export async function scrapeVideoWrite(db: AppDb, input: ScrapeVideoInput) {
  if (!input.videoId) {
    throw new ValidationError("Video id is required");
  }

  const pkg = await requireScraperPackage(db, input.scraperId);
  if (!pkg.enabled) {
    throw new ValidationError("Scraper is disabled");
  }

  const videoOrNull = await loadVideoSource(db, input.videoId);
  if (!videoOrNull) {
    throw new NotFoundError("Video not found");
  }
  const video: VideoSceneSource = videoOrNull;

  const yamlPath = await resolveScraperYamlPath(pkg.installPath);
  const { definition, capabilities } = await parseScraperYaml(yamlPath);
  const explicitAction =
    input.action && input.action !== "auto" ? (input.action as SceneAction) : null;

  const actionsToTry: SceneAction[] = [];
  if (explicitAction) {
    actionsToTry.push(explicitAction);
  } else {
    if ((input.url || video.url) && capabilities.sceneByURL) {
      actionsToTry.push("sceneByURL");
    }
    if ((input.query || video.title) && capabilities.sceneByName) {
      actionsToTry.push("sceneByName");
    }
    if (
      capabilities.sceneByFragment &&
      (video.oshash || video.checksumMd5 || video.phash)
    ) {
      actionsToTry.push("sceneByFragment");
    }
    if (capabilities.sceneByQueryFragment) {
      actionsToTry.push("sceneByQueryFragment");
    }
  }

  if (actionsToTry.length === 0) {
    return {
      result: null,
      message: "No compatible scrape actions available for this scraper.",
      triedActions: [],
    };
  }

  function buildInput(
    action: SceneAction,
  ): ScraperSceneFragment | { name: string } {
    if (action === "sceneByURL") {
      return { url: input.url || video.url || "" };
    }
    if (action === "sceneByName") {
      return { name: input.query || video.title || "" };
    }
    return {
      title: video.title ?? undefined,
      url: video.url ?? undefined,
      date: video.date ?? undefined,
      details: video.details ?? undefined,
      oshash: video.oshash ?? undefined,
      checksum: video.checksumMd5 ?? undefined,
      phash: video.phash ?? undefined,
      duration: video.duration ?? undefined,
      file_path: video.filePath ?? undefined,
    };
  }

  const triedActions: string[] = [];
  const errors: string[] = [];

  for (const action of actionsToTry) {
    triedActions.push(action);
    try {
      const rawResult = await scrapeScene(
        yamlPath,
        definition,
        action,
        buildInput(action),
        { scrapersRootDir: getScrapersDir() },
      );

      if (!rawResult) {
        errors.push(`${action}: no results`);
        continue;
      }

      if (Array.isArray(rawResult)) {
        const normalizedResults = rawResult
          .map((raw) => ({ raw, normalized: normalizeSceneResult(raw) }))
          .filter(({ normalized }) => hasUsableNormalizedSceneResult(normalized));

        return {
          results: normalizedResults.map(({ normalized }) => normalized),
          rawResults: normalizedResults.map(({ raw }) => raw),
          action,
          triedActions,
        };
      }

      const normalized = normalizeSceneResult(rawResult);
      if (!hasUsableNormalizedSceneResult(normalized)) {
        errors.push(`${action}: no usable fields`);
        continue;
      }

      const [result] = await db
        .insert(scrapeResults)
        .values({
          entityType: video.kind,
          entityId: video.id,
          scraperPackageId: pkg.id,
          action,
          status: "pending",
          rawResult: rawResult as Record<string, unknown>,
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

      return { result, normalized, action, triedActions };
    } catch (error) {
      if (error instanceof ScraperExecutionError) {
        const detail = error.stderr
          ? `${error.message}\nstderr: ${error.stderr.slice(0, 500)}`
          : error.message;
        errors.push(`${action}: ${detail}`);
        continue;
      }
      throw error;
    }
  }

  return {
    result: null,
    message: `No results found. Tried: ${triedActions.join(" → ")}`,
    triedActions,
    errors,
    debug: {
      scraperName: definition.name,
      videoTitle: video.title,
      videoUrl: video.url,
      hasOshash: Boolean(video.oshash),
      hasMd5: Boolean(video.checksumMd5),
      hasPhash: Boolean(video.phash),
    },
  };
}

export async function scrapePerformerWrite(
  db: AppDb,
  input: ScrapePerformerInput,
) {
  if (!input.performerId) {
    throw new ValidationError("Actor id is required");
  }

  const pkg = await requireScraperPackage(db, input.scraperId);
  if (!pkg.enabled) {
    throw new ValidationError("Scraper is disabled");
  }

  const [performer] = await db
    .select({ id: performers.id, name: performers.name })
    .from(performers)
    .where(eq(performers.id, input.performerId))
    .limit(1);
  if (!performer) {
    throw new NotFoundError("Actor not found");
  }

  const yamlPath = await resolveScraperYamlPath(pkg.installPath);
  const { definition, capabilities } = await parseScraperYaml(yamlPath);
  const explicitAction =
    input.action && input.action !== "auto"
      ? (input.action as PerformerAction)
      : null;

  const actionsToTry: PerformerAction[] = [];
  if (explicitAction) {
    actionsToTry.push(explicitAction);
  } else {
    if (input.url && capabilities.performerByURL) {
      actionsToTry.push("performerByURL");
    }
    if ((input.query || performer.name) && capabilities.performerByName) {
      actionsToTry.push("performerByName");
    }
    if (capabilities.performerByFragment) {
      actionsToTry.push("performerByFragment");
    }
  }

  if (actionsToTry.length === 0) {
    return {
      result: null,
      message: "No compatible performer scrape actions available for this scraper.",
      triedActions: [],
    };
  }

  function buildInput(
    action: PerformerAction,
  ): ScraperPerformerFragment | { name: string } {
    if (action === "performerByURL") {
      return { url: input.url || "" };
    }
    if (action === "performerByName") {
      return { name: input.query || performer.name || "" };
    }
    return { name: performer.name ?? "" };
  }

  const triedActions: string[] = [];
  const errors: string[] = [];

  for (const action of actionsToTry) {
    triedActions.push(action);
    try {
      const rawResult = await scrapePerformer(
        yamlPath,
        definition,
        action,
        buildInput(action),
        { scrapersRootDir: getScrapersDir() },
      );

      if (!rawResult) {
        errors.push(`${action}: no results`);
        continue;
      }

      if (Array.isArray(rawResult)) {
        const normalizedResults = rawResult.map((result) =>
          normalizePerformerResult(result),
        );
        const queryName = (input.query || performer.name || "").toLowerCase().trim();
        const exactMatch = normalizedResults.find(
          (result) => result.name?.toLowerCase().trim() === queryName,
        );
        if (exactMatch) {
          return {
            result: exactMatch,
            rawResult: rawResult[normalizedResults.indexOf(exactMatch)],
            action,
            triedActions,
          };
        }

        return {
          results: normalizedResults,
          rawResults: rawResult,
          action,
          triedActions,
        };
      }

      const normalized = normalizePerformerResult(rawResult);
      return { result: normalized, rawResult, action, triedActions };
    } catch (error) {
      if (error instanceof ScraperExecutionError) {
        errors.push(`${action}: ${error.message}`);
        continue;
      }
      throw error;
    }
  }

  return {
    result: null,
    message: `No results found. Tried: ${triedActions.join(" → ")}`,
    triedActions,
    errors,
  };
}

export async function listScrapeResultsRead(
  db: AppDb,
  input: ListScrapeResultsInput = {},
) {
  const limit = Math.min(Number(input.limit) || 50, 10_000);
  const offset = Number(input.offset) || 0;
  const conditions = [];

  if (input.status) {
    conditions.push(eq(scrapeResults.status, input.status));
  }
  if (input.videoId) {
    conditions.push(eq(scrapeResults.entityId, input.videoId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const results = await db
    .select()
    .from(scrapeResults)
    .where(where)
    .orderBy(desc(scrapeResults.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(scrapeResults)
    .where(where);

  return { results, total: count, limit, offset };
}

export async function getScrapeResultRead(
  db: AppDb,
  input: ScrapeResultDetailInput,
) {
  const [row] = await db
    .select()
    .from(scrapeResults)
    .where(eq(scrapeResults.id, input.id))
    .limit(1);
  if (!row) {
    throw new NotFoundError("Scrape result not found");
  }
  return row;
}

export async function acceptScrapeResultWrite(
  db: AppDb,
  input: AcceptScrapeResultInput,
) {
  const [result] = await db
    .select()
    .from(scrapeResults)
    .where(eq(scrapeResults.id, input.id))
    .limit(1);
  if (!result) {
    throw new NotFoundError("Scrape result not found");
  }
  if (result.appliedAt) {
    throw new ConflictError("Result already applied");
  }

  const entityType = result.entityType;
  const entityId = result.entityId;
  if (
    (entityType !== "video_episode" && entityType !== "video_movie") ||
    !entityId
  ) {
    throw new ValidationError(
      "This result is not keyed to a video entity — use the plugin accept endpoint",
    );
  }

  const videoKind = entityType as VideoEntityKind;
  const videoId = entityId;

  let resultIsNsfw = false;
  if (result.stashBoxEndpointId) {
    resultIsNsfw = true;
  } else if (result.scraperPackageId) {
    const [pkg] = await db
      .select({ isNsfw: scraperPackages.isNsfw })
      .from(scraperPackages)
      .where(eq(scraperPackages.id, result.scraperPackageId))
      .limit(1);
    resultIsNsfw = pkg?.isNsfw ?? true;
  } else if (result.pluginPackageId) {
    const [pkg] = await db
      .select({ isNsfw: pluginPackages.isNsfw })
      .from(pluginPackages)
      .where(eq(pluginPackages.id, result.pluginPackageId))
      .limit(1);
    resultIsNsfw = pkg?.isNsfw ?? false;
  }

  const fieldsToApply = new Set(
    input.fields ?? [
      "title",
      "date",
      "details",
      "url",
      "studio",
      "performers",
      "tags",
      "image",
    ],
  );

  await db.transaction(async (tx) => {
    const videoUpdate: Record<string, unknown> = { updatedAt: new Date() };

    if (fieldsToApply.has("title") && result.proposedTitle) {
      videoUpdate.title = result.proposedTitle;
    }
    if (fieldsToApply.has("date") && result.proposedDate) {
      if (videoKind === "video_episode") {
        videoUpdate.airDate = result.proposedDate;
      } else {
        videoUpdate.releaseDate = result.proposedDate;
      }
    }
    if (fieldsToApply.has("details") && result.proposedDetails) {
      videoUpdate.overview = result.proposedDetails;
    }
    if (fieldsToApply.has("url") && result.proposedUrl) {
      videoUpdate.externalIds = sql`COALESCE(${
        videoKind === "video_episode"
          ? videoEpisodes.externalIds
          : videoMovies.externalIds
      }, '{}'::jsonb) || ${JSON.stringify({
        "custom:scraped": result.proposedUrl,
      })}::jsonb`;
    }

    if (fieldsToApply.has("studio") && result.proposedStudioName) {
      const rawScene = result.rawResult as StashScrapedScene | null;
      const studioId = await findOrCreateStudio(
        tx,
        result.proposedStudioName,
        rawScene?.studio,
        resultIsNsfw,
      );
      if (videoKind === "video_movie") {
        videoUpdate.studioId = studioId;
      } else {
        const [episode] = await tx
          .select({ seriesId: videoEpisodes.seriesId })
          .from(videoEpisodes)
          .where(eq(videoEpisodes.id, videoId))
          .limit(1);
        if (episode?.seriesId) {
          await tx
            .update(videoSeries)
            .set({ studioId, updatedAt: new Date() })
            .where(eq(videoSeries.id, episode.seriesId));
        }
      }
    }

    videoUpdate.organized = true;
    videoUpdate.isNsfw = resultIsNsfw;

    if (videoKind === "video_episode") {
      await tx
        .update(videoEpisodes)
        .set(videoUpdate)
        .where(eq(videoEpisodes.id, videoId));
    } else {
      await tx
        .update(videoMovies)
        .set(videoUpdate)
        .where(eq(videoMovies.id, videoId));
    }

    const excludedPerformers = new Set(
      (input.excludePerformers ?? []).map((name) => name.toLowerCase()),
    );
    if (fieldsToApply.has("performers") && result.proposedPerformerNames?.length) {
      const rawScene = result.rawResult as StashScrapedScene | null;
      const rawPerformers = (rawScene?.performers ?? []) as StashScrapedPerformer[];
      const rawByName = new Map<string, StashScrapedPerformer>();
      for (const rawPerformer of rawPerformers) {
        if (rawPerformer.name) {
          rawByName.set(rawPerformer.name.toLowerCase(), rawPerformer);
        }
      }

      for (const name of result.proposedPerformerNames) {
        if (excludedPerformers.has(name.toLowerCase())) continue;

        const [existing] = await tx
          .select({
            id: performers.id,
            gender: performers.gender,
            imagePath: performers.imagePath,
          })
          .from(performers)
          .where(ilike(performers.name, name))
          .limit(1);

        const isNew = !existing;
        const performerId =
          existing?.id ??
          (
            await tx
              .insert(performers)
              .values({ name, isNsfw: resultIsNsfw })
              .returning({ id: performers.id })
          )[0].id;

        const rawPerf = rawByName.get(name.toLowerCase());
        if (rawPerf && (isNew || !existing?.gender)) {
          const normalized = normalizePerformerResult(rawPerf);
          const perfUpdates: Record<string, unknown> = { updatedAt: new Date() };
          if (normalized.gender) perfUpdates.gender = normalized.gender;
          if (normalized.birthdate) perfUpdates.birthdate = normalized.birthdate;
          if (normalized.country) perfUpdates.country = normalized.country;
          if (normalized.ethnicity) perfUpdates.ethnicity = normalized.ethnicity;
          if (normalized.eyeColor) perfUpdates.eyeColor = normalized.eyeColor;
          if (normalized.hairColor) perfUpdates.hairColor = normalized.hairColor;
          if (normalized.measurements) perfUpdates.measurements = normalized.measurements;
          if (normalized.tattoos) perfUpdates.tattoos = normalized.tattoos;
          if (normalized.piercings) perfUpdates.piercings = normalized.piercings;
          if (normalized.aliases) perfUpdates.aliases = normalized.aliases;
          if (normalized.details) perfUpdates.details = normalized.details;
          if (normalized.disambiguation) perfUpdates.disambiguation = normalized.disambiguation;
          if (normalized.height) {
            const height = Number.parseInt(normalized.height, 10);
            if (Number.isFinite(height)) perfUpdates.height = height;
          }
          if (normalized.weight) {
            const weight = Number.parseInt(normalized.weight, 10);
            if (Number.isFinite(weight)) perfUpdates.weight = weight;
          }

          if (Object.keys(perfUpdates).length > 1) {
            await tx
              .update(performers)
              .set(perfUpdates)
              .where(eq(performers.id, performerId));
          }

          if (normalized.imageUrl && (isNew || !existing?.imagePath)) {
            try {
              const genDir = getGeneratedPerformerDir(performerId);
              await writeImageFromUrl(
                normalized.imageUrl,
                path.join(genDir, "image.jpg"),
              );
              await tx
                .update(performers)
                .set({
                  imagePath: `/assets/performers/${performerId}/image`,
                  imageUrl: normalized.imageUrl,
                  updatedAt: new Date(),
                })
                .where(eq(performers.id, performerId));
            } catch {
              // Non-fatal, mirrors Fastify.
            }
          }
        }

        if (videoKind === "video_episode") {
          await tx
            .insert(videoEpisodePerformers)
            .values({ episodeId: videoId, performerId })
            .onConflictDoNothing();
        } else {
          await tx
            .insert(videoMoviePerformers)
            .values({ movieId: videoId, performerId })
            .onConflictDoNothing();
        }
      }
    }

    const excludedTags = new Set((input.excludeTags ?? []).map((name) => name.toLowerCase()));
    if (fieldsToApply.has("tags") && result.proposedTagNames?.length) {
      for (const name of result.proposedTagNames) {
        if (excludedTags.has(name.toLowerCase())) continue;

        const [existing] = await tx
          .select({ id: tags.id })
          .from(tags)
          .where(ilike(tags.name, name))
          .limit(1);

        const tagId =
          existing?.id ??
          (
            await tx
              .insert(tags)
              .values({ name, isNsfw: resultIsNsfw })
              .returning({ id: tags.id })
          )[0].id;

        if (videoKind === "video_episode") {
          await tx
            .insert(videoEpisodeTags)
            .values({ episodeId: videoId, tagId })
            .onConflictDoNothing();
        } else {
          await tx
            .insert(videoMovieTags)
            .values({ movieId: videoId, tagId })
            .onConflictDoNothing();
        }
      }
    }

    if (fieldsToApply.has("image") && result.proposedImageUrl) {
      try {
        const genDir = getGeneratedVideoDir(videoId);
        await writeImageFromUrl(
          result.proposedImageUrl,
          path.join(genDir, "thumbnail-custom.jpg"),
        );
        const patch = {
          thumbnailPath: `/assets/videos/${videoId}/thumb-custom`,
          cardThumbnailPath: null,
          updatedAt: new Date(),
        };
        if (videoKind === "video_episode") {
          await tx
            .update(videoEpisodes)
            .set(patch)
            .where(eq(videoEpisodes.id, videoId));
        } else {
          await tx
            .update(videoMovies)
            .set(patch)
            .where(eq(videoMovies.id, videoId));
        }
      } catch {
        // Non-fatal, mirrors Fastify.
      }
    }

    if (result.stashBoxEndpointId) {
      const rawScene = result.rawResult as (StashScrapedScene & { id?: string }) | null;
      const remoteStashId = typeof rawScene?.id === "string" ? rawScene.id : null;
      if (remoteStashId) {
        await tx
          .insert(stashIds)
          .values({
            entityType: videoKind,
            entityId: videoId,
            stashBoxEndpointId: result.stashBoxEndpointId,
            stashId: remoteStashId,
          })
          .onConflictDoNothing();
      }
    }

    await tx
      .update(scrapeResults)
      .set({
        status: "accepted",
        appliedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scrapeResults.id, input.id));
  });

  return { ok: true as const, videoId, entityType: videoKind };
}

export async function rejectScrapeResultWrite(
  db: AppDb,
  input: RejectScrapeResultInput,
) {
  const [result] = await db
    .update(scrapeResults)
    .set({
      status: "rejected",
      updatedAt: new Date(),
    })
    .where(eq(scrapeResults.id, input.id))
    .returning();
  if (!result) {
    throw new NotFoundError("Scrape result not found");
  }
  return { ok: true as const };
}

export async function applyPerformerScrapeWrite(
  db: AppDb,
  input: ApplyPerformerScrapeInput,
) {
  const existing = await db.query.performers.findFirst({
    where: eq(performers.id, input.performerId),
    columns: { id: true },
  });
  if (!existing) {
    throw new NotFoundError("Actor not found");
  }

  const selected = new Set(input.selectedFields);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const fieldMap: Record<string, string> = {
    name: "name",
    disambiguation: "disambiguation",
    gender: "gender",
    birthdate: "birthdate",
    country: "country",
    ethnicity: "ethnicity",
    eyeColor: "eyeColor",
    hairColor: "hairColor",
    height: "height",
    weight: "weight",
    measurements: "measurements",
    tattoos: "tattoos",
    piercings: "piercings",
    aliases: "aliases",
    details: "details",
  };

  for (const [scraperField, dbField] of Object.entries(fieldMap)) {
    if (selected.has(scraperField) && input.fields[scraperField] != null) {
      let value: unknown = input.fields[scraperField];
      if (dbField === "height" || dbField === "weight") {
        const num = Number.parseInt(String(value), 10);
        value = Number.isFinite(num) ? num : null;
      }
      updates[dbField] = value;
    }
  }

  await db.update(performers).set(updates).where(eq(performers.id, input.performerId));

  if (selected.has("imageUrl") && input.fields.imageUrl) {
    try {
      const imageUrl = String(input.fields.imageUrl);
      const genDir = getGeneratedPerformerDir(input.performerId);
      await writeImageFromUrl(imageUrl, path.join(genDir, "image.jpg"));
      await db
        .update(performers)
        .set({
          imagePath: `/assets/performers/${input.performerId}/image`,
          imageUrl,
          updatedAt: new Date(),
        })
        .where(eq(performers.id, input.performerId));
    } catch {
      // Non-fatal, mirrors Fastify.
    }
  }

  return { ok: true as const, id: input.performerId };
}
