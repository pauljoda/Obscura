import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { mkdir, rm, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { db, schema } from "../db";
import { eq, desc, ilike, and, sql } from "drizzle-orm";
import { getCacheRootDir } from "@obscura/media-core";
import {
  parseScraperYaml,
  scrapeScene,
  scrapePerformer,
  normalizeSceneResult,
  normalizePerformerResult,
  ScraperExecutionError,
  type ScraperSceneFragment,
  type ScraperPerformerFragment,
  type StashScrapedScene,
  type StashScrapedPerformer,
} from "@obscura/stash-import";
import { getGeneratedPerformerDir } from "@obscura/media-core";
import yaml from "js-yaml";

const {
  scraperPackages,
  scrapeResults,
  scenes,
  performers,
  tags,
  studios,
  scenePerformers,
  sceneTags,
} = schema;

function getScrapersDir() {
  return path.join(getCacheRootDir(), "scrapers");
}

// ─── Community index cache ──────────────────────────────────────────
let indexCache: { data: CommunityIndexEntry[]; fetchedAt: number } | null = null;
const INDEX_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CommunityIndexEntry {
  id: string;
  name: string;
  version: string;
  date: string;
  path: string;
  sha256: string;
  requires?: string[];
}

async function fetchCommunityIndex(
  indexUrl: string,
  force = false
): Promise<CommunityIndexEntry[]> {
  if (!force && indexCache && Date.now() - indexCache.fetchedAt < INDEX_CACHE_TTL) {
    return indexCache.data;
  }

  const res = await fetch(indexUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch community index: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  const entries = yaml.load(text, { schema: yaml.JSON_SCHEMA }) as CommunityIndexEntry[];

  if (!Array.isArray(entries)) {
    throw new Error("Invalid community index format");
  }

  indexCache = { data: entries, fetchedAt: Date.now() };
  return entries;
}

// ─── Zip extraction ─────────────────────────────────────────────────
async function downloadAndExtract(
  zipUrl: string,
  expectedSha256: string,
  destDir: string
): Promise<void> {
  const res = await fetch(zipUrl);
  if (!res.ok) {
    throw new Error(`Failed to download scraper: ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  // Verify sha256
  const hash = createHash("sha256").update(buffer).digest("hex");
  if (hash !== expectedSha256) {
    throw new Error(`SHA256 mismatch: expected ${expectedSha256}, got ${hash}`);
  }

  await mkdir(destDir, { recursive: true });

  // Extract zip using pure-JS fflate (no external binary needed)
  const files = unzipSync(new Uint8Array(buffer));
  for (const [filePath, data] of Object.entries(files)) {
    // Skip directories (they end with /)
    if (filePath.endsWith("/")) continue;

    const fullPath = path.join(destDir, filePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
  }
}

// ─── Routes ─────────────────────────────────────────────────────────

const COMMUNITY_INDEX_URL =
  process.env.SCRAPER_INDEX_URL ??
  "https://stashapp.github.io/CommunityScrapers/stable/index.yml";

export async function scrapersRoutes(app: FastifyInstance) {
  // ─── GET /scrapers/index ────────────────────────────────────────
  // Fetch community scraper index with installed status
  app.get("/scrapers/index", async (request) => {
    const query = request.query as { force?: string };
    const force = query.force === "true";

    const entries = await fetchCommunityIndex(COMMUNITY_INDEX_URL, force);
    const installed = await db.select().from(scraperPackages);
    const installedMap = new Map(installed.map((p) => [p.packageId, p]));

    return {
      entries: entries.map((entry) => {
        const pkg = installedMap.get(entry.id);
        return {
          ...entry,
          installed: !!pkg,
          installedVersion: pkg?.version ?? null,
        };
      }),
    };
  });

  // ─── GET /scrapers/packages ─────────────────────────────────────
  // List installed scraper packages
  app.get("/scrapers/packages", async () => {
    const packages = await db
      .select()
      .from(scraperPackages)
      .orderBy(scraperPackages.name);

    return { packages };
  });

  // ─── POST /scrapers/packages ────────────────────────────────────
  // Install a scraper package from community index
  app.post("/scrapers/packages", async (request, reply) => {
    const body = request.body as {
      packageId: string;
      zipUrl?: string;
      sha256?: string;
    };

    if (!body.packageId) {
      return reply.code(400).send({ error: "packageId is required" });
    }

    // Validate packageId to prevent path traversal
    if (body.packageId.includes("..") || body.packageId.includes("/") || body.packageId.includes("\\")) {
      return reply.code(400).send({ error: "Invalid packageId: path traversal characters not allowed" });
    }

    // Look up from community index if zip URL not provided
    let zipUrl = body.zipUrl;
    let sha256 = body.sha256;

    if (!zipUrl) {
      const entries = await fetchCommunityIndex(COMMUNITY_INDEX_URL);
      const entry = entries.find((e) => e.id === body.packageId);
      if (!entry) {
        return reply.code(404).send({ error: `Package "${body.packageId}" not found in community index` });
      }

      // Resolve zip URL relative to index URL
      const indexBase = COMMUNITY_INDEX_URL.replace(/\/[^/]+$/, "/");
      zipUrl = entry.path.startsWith("http") ? entry.path : `${indexBase}${entry.path}`;
      sha256 = entry.sha256;
    }

    if (!sha256) {
      return reply.code(400).send({ error: "sha256 is required for integrity verification" });
    }

    const scrapersDir = getScrapersDir();
    const destDir = path.join(scrapersDir, body.packageId);

    // Download, verify, and extract
    await downloadAndExtract(zipUrl, sha256, destDir);

    // Find the .yml definition file
    const files = await readdir(destDir);
    const ymlFile = files.find((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

    if (!ymlFile) {
      await rm(destDir, { recursive: true, force: true });
      return reply.code(400).send({ error: "No scraper definition (.yml) found in package" });
    }

    const yamlPath = path.join(destDir, ymlFile);
    const { definition, capabilities } = await parseScraperYaml(yamlPath);

    // Look up version from index
    const entries = await fetchCommunityIndex(COMMUNITY_INDEX_URL);
    const indexEntry = entries.find((e) => e.id === body.packageId);

    // Upsert into database
    const [pkg] = await db
      .insert(scraperPackages)
      .values({
        packageId: body.packageId,
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

    // Also install dependencies (py_common, etc.)
    if (indexEntry?.requires) {
      for (const dep of indexEntry.requires) {
        const depEntry = entries.find((e) => e.id === dep);
        if (!depEntry) continue;

        const depDir = path.join(scrapersDir, dep);
        if (existsSync(depDir)) continue;

        const depZipUrl = depEntry.path.startsWith("http")
          ? depEntry.path
          : `${COMMUNITY_INDEX_URL.replace(/\/[^/]+$/, "/")}${depEntry.path}`;

        try {
          await downloadAndExtract(depZipUrl, depEntry.sha256, depDir);
        } catch (err) {
          app.log.warn(`Failed to install dependency ${dep}: ${err}`);
        }
      }
    }

    return pkg;
  });

  // ─── DELETE /scrapers/packages/:id ──────────────────────────────
  app.delete("/scrapers/packages/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [pkg] = await db
      .select()
      .from(scraperPackages)
      .where(eq(scraperPackages.id, id))
      .limit(1);

    if (!pkg) {
      return reply.code(404).send({ error: "Package not found" });
    }

    // Remove from disk
    if (pkg.installPath && existsSync(pkg.installPath)) {
      await rm(pkg.installPath, { recursive: true, force: true });
    }

    // Remove from DB
    await db.delete(scraperPackages).where(eq(scraperPackages.id, id));

    return { ok: true };
  });

  // ─── PATCH /scrapers/packages/:id ───────────────────────────────
  // Toggle enabled state
  app.patch("/scrapers/packages/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { enabled?: boolean };

    const [pkg] = await db
      .update(scraperPackages)
      .set({
        enabled: body.enabled,
        updatedAt: new Date(),
      })
      .where(eq(scraperPackages.id, id))
      .returning();

    if (!pkg) {
      return reply.code(404).send({ error: "Package not found" });
    }

    return pkg;
  });

  // ─── POST /scrapers/:id/scrape ──────────────────────────────────
  // Run a scraper against a scene (synchronous, interactive)
  // Supports auto-cascade: tries actions in order URL → Name → Fragment
  app.post("/scrapers/:id/scrape", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      sceneId: string;
      action?: string;
      url?: string;
      query?: string;
    };

    if (!body.sceneId) {
      return reply.code(400).send({ error: "sceneId is required" });
    }

    const [pkg] = await db
      .select()
      .from(scraperPackages)
      .where(eq(scraperPackages.id, id))
      .limit(1);

    if (!pkg) {
      return reply.code(404).send({ error: "Scraper package not found" });
    }

    if (!pkg.enabled) {
      return reply.code(400).send({ error: "Scraper is disabled" });
    }

    // Load scene data for fragment-based scraping
    const [scene] = await db
      .select({
        id: scenes.id,
        title: scenes.title,
        url: scenes.url,
        date: scenes.date,
        details: scenes.details,
        duration: scenes.duration,
        checksumMd5: scenes.checksumMd5,
        oshash: scenes.oshash,
        phash: scenes.phash,
        filePath: scenes.filePath,
      })
      .from(scenes)
      .where(eq(scenes.id, body.sceneId))
      .limit(1);

    if (!scene) {
      return reply.code(404).send({ error: "Scene not found" });
    }

    // Find the YAML definition
    const files = await readdir(pkg.installPath);
    const ymlFile = files.find((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
    if (!ymlFile) {
      return reply.code(500).send({ error: "Scraper YAML definition not found" });
    }

    const yamlPath = path.join(pkg.installPath, ymlFile);
    const { definition, capabilities } = await parseScraperYaml(yamlPath);

    // Build the cascade order based on what's available
    type SceneAction = "sceneByURL" | "sceneByFragment" | "sceneByName" | "sceneByQueryFragment";
    const explicitAction = body.action && body.action !== "auto" ? body.action as SceneAction : null;

    // If an explicit action is given, use only that; otherwise build a cascade
    const actionsToTry: SceneAction[] = [];
    if (explicitAction) {
      actionsToTry.push(explicitAction);
    } else {
      // 1. URL first (if a URL was provided or scene has one)
      if ((body.url || scene.url) && capabilities.sceneByURL) {
        actionsToTry.push("sceneByURL");
      }
      // 2. Name/title search
      if ((body.query || scene.title) && capabilities.sceneByName) {
        actionsToTry.push("sceneByName");
      }
      // 3. Fragment (hash-based)
      if (capabilities.sceneByFragment && (scene.oshash || scene.checksumMd5 || scene.phash)) {
        actionsToTry.push("sceneByFragment");
      }
      // 4. Query fragment
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

    // Helper to build input for a given action
    function buildInput(action: SceneAction): ScraperSceneFragment | { name: string } {
      if (action === "sceneByURL") {
        return { url: body.url || scene.url || "" };
      } else if (action === "sceneByName") {
        return { name: body.query || scene.title || "" };
      } else {
        return {
          title: scene.title ?? undefined,
          url: scene.url ?? undefined,
          date: scene.date ?? undefined,
          details: scene.details ?? undefined,
          oshash: scene.oshash ?? undefined,
          checksum: scene.checksumMd5 ?? undefined,
          phash: scene.phash ?? undefined,
          duration: scene.duration ?? undefined,
          file_path: scene.filePath ?? undefined,
        };
      }
    }

    // Try each action in cascade order, stopping at first success
    const triedActions: string[] = [];
    const errors: string[] = [];

    for (const action of actionsToTry) {
      triedActions.push(action);
      const input = buildInput(action);

      try {
        const rawResult = await scrapeScene(
          yamlPath,
          definition,
          action,
          input,
          { scrapersRootDir: getScrapersDir() }
        );

        if (!rawResult) {
          errors.push(`${action}: no results`);
          continue; // Try next action
        }

        // For sceneByName, return array of search results
        if (Array.isArray(rawResult)) {
          return {
            results: rawResult.map((r) => normalizeSceneResult(r)),
            rawResults: rawResult,
            action,
            triedActions,
          };
        }

        const normalized = normalizeSceneResult(rawResult);

        // Store the result
        const [result] = await db
          .insert(scrapeResults)
          .values({
            sceneId: scene.id,
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
      } catch (err) {
        if (err instanceof ScraperExecutionError) {
          errors.push(`${action}: ${err.message}`);
          continue; // Try next action
        }
        throw err;
      }
    }

    // All actions exhausted
    return {
      result: null,
      message: `No results found. Tried: ${triedActions.join(" → ")}`,
      triedActions,
      errors,
    };
  });

  // ─── POST /scrapers/:id/scrape-performer ────────────────────────
  // Run a scraper against a performer (synchronous, interactive)
  app.post("/scrapers/:id/scrape-performer", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      performerId: string;
      action?: string;
      url?: string;
      query?: string;
    };

    if (!body.performerId) {
      return reply.code(400).send({ error: "performerId is required" });
    }

    const [pkg] = await db
      .select()
      .from(scraperPackages)
      .where(eq(scraperPackages.id, id))
      .limit(1);

    if (!pkg) {
      return reply.code(404).send({ error: "Scraper package not found" });
    }

    if (!pkg.enabled) {
      return reply.code(400).send({ error: "Scraper is disabled" });
    }

    const [performer] = await db
      .select({
        id: performers.id,
        name: performers.name,
      })
      .from(performers)
      .where(eq(performers.id, body.performerId))
      .limit(1);

    if (!performer) {
      return reply.code(404).send({ error: "Performer not found" });
    }

    // Find the YAML definition
    const files = await readdir(pkg.installPath);
    const ymlFile = files.find((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
    if (!ymlFile) {
      return reply.code(500).send({ error: "Scraper YAML definition not found" });
    }

    const yamlPath = path.join(pkg.installPath, ymlFile);
    const { definition, capabilities } = await parseScraperYaml(yamlPath);

    type PerformerAction = "performerByURL" | "performerByName" | "performerByFragment";
    const explicitAction = body.action && body.action !== "auto" ? body.action as PerformerAction : null;

    const actionsToTry: PerformerAction[] = [];
    if (explicitAction) {
      actionsToTry.push(explicitAction);
    } else {
      if (body.url && capabilities.performerByURL) {
        actionsToTry.push("performerByURL");
      }
      if ((body.query || performer.name) && capabilities.performerByName) {
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

    function buildInput(action: PerformerAction): ScraperPerformerFragment | { name: string } {
      if (action === "performerByURL") {
        return { url: body.url || "" };
      } else if (action === "performerByName") {
        return { name: body.query || performer.name || "" };
      } else {
        return { name: performer.name ?? "" };
      }
    }

    const triedActions: string[] = [];
    const errors: string[] = [];

    for (const action of actionsToTry) {
      triedActions.push(action);
      const input = buildInput(action);

      try {
        const rawResult = await scrapePerformer(
          yamlPath,
          definition,
          action,
          input,
          { scrapersRootDir: getScrapersDir() }
        );

        if (!rawResult) {
          errors.push(`${action}: no results`);
          continue;
        }

        // For performerByName, return array of search results
        if (Array.isArray(rawResult)) {
          return {
            results: rawResult.map((r) => normalizePerformerResult(r)),
            rawResults: rawResult,
            action,
            triedActions,
          };
        }

        const normalized = normalizePerformerResult(rawResult);
        return { result: normalized, rawResult, action, triedActions };
      } catch (err) {
        if (err instanceof ScraperExecutionError) {
          errors.push(`${action}: ${err.message}`);
          continue;
        }
        throw err;
      }
    }

    return {
      result: null,
      message: `No results found. Tried: ${triedActions.join(" → ")}`,
      triedActions,
      errors,
    };
  });

  // ─── POST /performers/:id/apply-scrape ─────────────────────────
  // Apply a performer scrape result to the performer record
  app.post("/performers/:id/apply-scrape", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      fields: Record<string, unknown>;
      selectedFields: string[];
    };

    const existing = await db.query.performers.findFirst({
      where: eq(performers.id, id),
      columns: { id: true },
    });

    if (!existing) {
      return reply.code(404).send({ error: "Performer not found" });
    }

    const selected = new Set(body.selectedFields);
    const updates: Record<string, any> = { updatedAt: new Date() };

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
      if (selected.has(scraperField) && body.fields[scraperField] != null) {
        let value: unknown = body.fields[scraperField];
        // Parse numeric fields
        if (dbField === "height" || dbField === "weight") {
          const num = parseInt(String(value), 10);
          value = Number.isFinite(num) ? num : null;
        }
        updates[dbField] = value;
      }
    }

    await db.update(performers).set(updates).where(eq(performers.id, id));

    // Handle image download if selected
    if (selected.has("imageUrl") && body.fields.imageUrl) {
      const imageUrl = String(body.fields.imageUrl);
      try {
        let buffer: Buffer;
        if (imageUrl.startsWith("data:image/")) {
          const base64Data = imageUrl.split(",")[1];
          if (base64Data) buffer = Buffer.from(base64Data, "base64");
          else throw new Error("Invalid data URL");
        } else {
          const res = await fetch(imageUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          buffer = Buffer.from(await res.arrayBuffer());
        }

        const genDir = getGeneratedPerformerDir(id);
        await mkdir(genDir, { recursive: true });
        await writeFile(path.join(genDir, "image.jpg"), buffer);

        const assetUrl = `/assets/performers/${id}/image`;
        await db
          .update(performers)
          .set({ imagePath: assetUrl, imageUrl, updatedAt: new Date() })
          .where(eq(performers.id, id));
      } catch {
        // Image download failed — non-fatal, other fields still applied
      }
    }

    return { ok: true, id };
  });

  // ─── GET /scrapers/results ──────────────────────────────────────
  // List scrape results (tagger queue)
  app.get("/scrapers/results", async (request) => {
    const query = request.query as {
      status?: string;
      sceneId?: string;
      limit?: string;
      offset?: string;
    };

    const limit = Math.min(Number(query.limit) || 50, 200);
    const offset = Number(query.offset) || 0;

    const conditions = [];
    if (query.status) {
      conditions.push(eq(scrapeResults.status, query.status));
    }
    if (query.sceneId) {
      conditions.push(eq(scrapeResults.sceneId, query.sceneId));
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
  });

  // ─── POST /scrapers/results/:id/accept ──────────────────────────
  // Apply a scrape result to the scene
  app.post("/scrapers/results/:id/accept", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      fields?: string[];
    };

    const [result] = await db
      .select()
      .from(scrapeResults)
      .where(eq(scrapeResults.id, id))
      .limit(1);

    if (!result) {
      return reply.code(404).send({ error: "Scrape result not found" });
    }

    if (result.appliedAt) {
      return reply.code(409).send({ error: "Result already applied" });
    }

    // Determine which fields to apply (all if not specified)
    const fieldsToApply = new Set(
      body.fields ?? [
        "title",
        "date",
        "details",
        "url",
        "studio",
        "performers",
        "tags",
      ]
    );

    await db.transaction(async (tx) => {
      // Build scene update
      const sceneUpdate: Record<string, unknown> = { updatedAt: new Date() };

      if (fieldsToApply.has("title") && result.proposedTitle) {
        sceneUpdate.title = result.proposedTitle;
      }
      if (fieldsToApply.has("date") && result.proposedDate) {
        sceneUpdate.date = result.proposedDate;
      }
      if (fieldsToApply.has("details") && result.proposedDetails) {
        sceneUpdate.details = result.proposedDetails;
      }
      if (fieldsToApply.has("url") && result.proposedUrl) {
        sceneUpdate.url = result.proposedUrl;
      }

      // Studio: find or create
      if (fieldsToApply.has("studio") && result.proposedStudioName) {
        const studioName = result.proposedStudioName;
        const [existing] = await tx
          .select({ id: studios.id })
          .from(studios)
          .where(ilike(studios.name, studioName))
          .limit(1);

        if (existing) {
          sceneUpdate.studioId = existing.id;
        } else {
          const [created] = await tx
            .insert(studios)
            .values({ name: studioName })
            .returning({ id: studios.id });
          sceneUpdate.studioId = created.id;
        }
      }

      // Mark organized
      sceneUpdate.organized = true;

      // Update scene
      await tx
        .update(scenes)
        .set(sceneUpdate)
        .where(eq(scenes.id, result.sceneId));

      // Performers: find or create, then link — also apply scraped metadata
      if (fieldsToApply.has("performers") && result.proposedPerformerNames?.length) {
        // Build a lookup of raw performer data from the scrape result
        const rawScene = result.rawResult as StashScrapedScene | null;
        const rawPerformers = (rawScene?.performers ?? []) as StashScrapedPerformer[];
        const rawByName = new Map<string, StashScrapedPerformer>();
        for (const rp of rawPerformers) {
          if (rp.name) rawByName.set(rp.name.toLowerCase(), rp);
        }

        for (const name of result.proposedPerformerNames) {
          const [existing] = await tx
            .select({ id: performers.id, gender: performers.gender, imagePath: performers.imagePath })
            .from(performers)
            .where(ilike(performers.name, name))
            .limit(1);

          const isNew = !existing;
          const performerId = existing?.id ?? (
            await tx
              .insert(performers)
              .values({ name })
              .returning({ id: performers.id })
          )[0].id;

          // Apply rich metadata from scraper if performer is new or sparse
          const rawPerf = rawByName.get(name.toLowerCase());
          if (rawPerf && (isNew || !existing?.gender)) {
            const normalized = normalizePerformerResult(rawPerf);
            const perfUpdates: Record<string, any> = { updatedAt: new Date() };
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
              const h = parseInt(normalized.height, 10);
              if (Number.isFinite(h)) perfUpdates.height = h;
            }
            if (normalized.weight) {
              const w = parseInt(normalized.weight, 10);
              if (Number.isFinite(w)) perfUpdates.weight = w;
            }

            if (Object.keys(perfUpdates).length > 1) {
              await tx.update(performers).set(perfUpdates).where(eq(performers.id, performerId));
            }

            // Download performer image if available and not already set
            if (normalized.imageUrl && (isNew || !existing?.imagePath)) {
              try {
                let buffer: Buffer;
                if (normalized.imageUrl.startsWith("data:image/")) {
                  const b64 = normalized.imageUrl.split(",")[1];
                  if (b64) buffer = Buffer.from(b64, "base64");
                  else throw new Error("bad data url");
                } else {
                  const imgRes = await fetch(normalized.imageUrl);
                  if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
                  buffer = Buffer.from(await imgRes.arrayBuffer());
                }
                const genDir = getGeneratedPerformerDir(performerId);
                await mkdir(genDir, { recursive: true });
                await writeFile(path.join(genDir, "image.jpg"), buffer);
                const assetUrl = `/assets/performers/${performerId}/image`;
                await tx
                  .update(performers)
                  .set({ imagePath: assetUrl, imageUrl: normalized.imageUrl, updatedAt: new Date() })
                  .where(eq(performers.id, performerId));
              } catch {
                // Image download failed — non-fatal
              }
            }
          }

          await tx
            .insert(scenePerformers)
            .values({ sceneId: result.sceneId, performerId })
            .onConflictDoNothing();
        }

        // Update performer scene counts
        await tx.execute(sql`
          UPDATE performers SET scene_count = (
            SELECT count(*) FROM scene_performers WHERE performer_id = performers.id
          )
          WHERE id IN (
            SELECT performer_id FROM scene_performers WHERE scene_id = ${result.sceneId}
          )
        `);
      }

      // Tags: find or create, then link
      if (fieldsToApply.has("tags") && result.proposedTagNames?.length) {
        for (const name of result.proposedTagNames) {
          const [existing] = await tx
            .select({ id: tags.id })
            .from(tags)
            .where(ilike(tags.name, name))
            .limit(1);

          const tagId = existing?.id ?? (
            await tx
              .insert(tags)
              .values({ name })
              .returning({ id: tags.id })
          )[0].id;

          await tx
            .insert(sceneTags)
            .values({ sceneId: result.sceneId, tagId })
            .onConflictDoNothing();
        }

        // Update tag scene counts
        await tx.execute(sql`
          UPDATE tags SET scene_count = (
            SELECT count(*) FROM scene_tags WHERE tag_id = tags.id
          )
          WHERE id IN (
            SELECT tag_id FROM scene_tags WHERE scene_id = ${result.sceneId}
          )
        `);
      }

      // Mark result as accepted
      await tx
        .update(scrapeResults)
        .set({
          status: "accepted",
          appliedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(scrapeResults.id, id));
    });

    return { ok: true, sceneId: result.sceneId };
  });

  // ─── POST /scrapers/results/:id/reject ──────────────────────────
  app.post("/scrapers/results/:id/reject", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [result] = await db
      .update(scrapeResults)
      .set({
        status: "rejected",
        updatedAt: new Date(),
      })
      .where(eq(scrapeResults.id, id))
      .returning();

    if (!result) {
      return reply.code(404).send({ error: "Scrape result not found" });
    }

    return { ok: true };
  });
}
