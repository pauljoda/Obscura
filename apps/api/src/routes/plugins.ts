import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { mkdir, rm, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { unzipSync } from "fflate";
import { db, schema } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import { getCacheRootDir } from "@obscura/media-core";
import {
  readManifest,
  encryptAuthValue,
  resolvePluginAuth,
  loadTypeScriptPlugin,
  runNativePythonPlugin,
  PluginExecutionError,
  fetchPluginIndex,
  clearPluginIndexCache,
  type PluginIndexEntry,
  type InstalledPluginDto,
  type OscuraPluginManifest,
  type PluginInput,
} from "@obscura/plugins";

const { pluginPackages, pluginAuth, scrapeResults } = schema;

function getPluginsDir() {
  return path.join(getCacheRootDir(), "plugins");
}

// ─── Helpers ───────────────────────────────────────────────────────

async function upsertPlugin(
  manifest: Awaited<ReturnType<typeof readManifest>>,
  installPath: string,
  sha256: string | null,
  sourceIndex: string,
) {
  const existing = await db
    .select()
    .from(pluginPackages)
    .where(eq(pluginPackages.pluginId, manifest.id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pluginPackages)
      .set({
        name: manifest.name,
        version: manifest.version,
        runtime: manifest.runtime,
        installPath,
        sha256,
        isNsfw: manifest.isNsfw,
        capabilities: manifest.capabilities as Record<string, boolean>,
        manifestRaw: manifest as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(pluginPackages.pluginId, manifest.id));
  } else {
    await db.insert(pluginPackages).values({
      pluginId: manifest.id,
      name: manifest.name,
      version: manifest.version,
      runtime: manifest.runtime,
      installPath,
      sha256,
      isNsfw: manifest.isNsfw,
      capabilities: manifest.capabilities as Record<string, boolean>,
      manifestRaw: manifest as unknown as Record<string, unknown>,
      enabled: true,
      sourceIndex,
    });
  }
}

// ─── Route registration ────────────────────────────────────────────

export async function pluginsRoutes(app: FastifyInstance) {
  // ─── List installed plugins ─────────────────────────────────────
  app.get("/plugins/packages", async () => {
    const rows = await db
      .select()
      .from(pluginPackages)
      .orderBy(pluginPackages.name);

    // Check auth status for each plugin
    const authRows = await db
      .select()
      .from(pluginAuth);

    const authByPlugin = new Map<string, Set<string>>();
    for (const row of authRows) {
      const set = authByPlugin.get(row.pluginId) ?? new Set();
      set.add(row.authKey);
      authByPlugin.set(row.pluginId, set);
    }

    return rows.map((row) => {
      const manifest = row.manifestRaw as Record<string, unknown> | null;
      const authFields = Array.isArray(manifest?.auth)
        ? (manifest.auth as Array<{ key: string; label: string; required: boolean; url?: string }>)
        : undefined;

      let authStatus: "ok" | "missing" | null = null;
      if (authFields && authFields.length > 0) {
        const configured = authByPlugin.get(row.pluginId) ?? new Set();
        const allRequired = authFields
          .filter((f) => f.required)
          .every((f) => configured.has(f.key));
        authStatus = allRequired ? "ok" : "missing";
      }

      return {
        id: row.id,
        pluginId: row.pluginId,
        name: row.name,
        version: row.version,
        runtime: row.runtime,
        installPath: row.installPath,
        sha256: row.sha256,
        isNsfw: row.isNsfw,
        capabilities: row.capabilities ?? {},
        enabled: row.enabled,
        sourceIndex: row.sourceIndex,
        authStatus,
        authFields,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  });

  // ─── Install plugin ─────────────────────────────────────────────
  // Supports: zipUrl (download), or localPath (dev: copy from disk)
  app.post<{
    Body: { pluginId: string; zipUrl?: string; localPath?: string; sha256?: string };
  }>("/plugins/packages", async (req, reply) => {
    const { pluginId, zipUrl, localPath, sha256: expectedSha } = req.body;

    const pluginsDir = getPluginsDir();
    const installDir = path.join(pluginsDir, pluginId);

    if (localPath) {
      // Dev mode: the plugin directory is on disk — just register it directly
      // (no copy needed, we point installPath at the source)
      if (!existsSync(localPath)) {
        return reply.code(400).send({ error: `Local plugin path not found: ${localPath}` });
      }

      let manifest;
      try {
        manifest = await readManifest(localPath);
      } catch (err) {
        return reply.code(400).send({
          error: `Invalid plugin manifest: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      await upsertPlugin(manifest, localPath, null, "obscura-community");
      return { ok: true, pluginId: manifest.id };
    }

    if (zipUrl) {
      // Production: download and extract zip
      const res = await fetch(zipUrl);
      if (!res.ok) {
        return reply.code(502).send({ error: `Failed to download plugin: ${res.status}` });
      }

      const buffer = Buffer.from(await res.arrayBuffer());

      if (expectedSha) {
        const actual = createHash("sha256").update(buffer).digest("hex");
        if (actual !== expectedSha) {
          return reply.code(400).send({ error: `SHA256 mismatch: expected ${expectedSha}, got ${actual}` });
        }
      }

      await mkdir(installDir, { recursive: true });
      const files = unzipSync(new Uint8Array(buffer));
      for (const [name, data] of Object.entries(files)) {
        const outPath = path.join(installDir, name);
        if (!outPath.startsWith(installDir)) continue;
        await mkdir(path.dirname(outPath), { recursive: true });
        await writeFile(outPath, data);
      }

      let manifest;
      try {
        manifest = await readManifest(installDir);
      } catch (err) {
        await rm(installDir, { recursive: true, force: true });
        return reply.code(400).send({
          error: `Invalid plugin manifest: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      const sha = createHash("sha256").update(buffer).digest("hex");
      await upsertPlugin(manifest, installDir, sha, "obscura-community");
      return { ok: true, pluginId: manifest.id };
    }

    return reply.code(400).send({ error: "Either zipUrl or localPath is required" });
  });

  // ─── Uninstall plugin ───────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    "/plugins/packages/:id",
    async (req, reply) => {
      const [row] = await db
        .select()
        .from(pluginPackages)
        .where(eq(pluginPackages.id, req.params.id))
        .limit(1);

      if (!row) return reply.code(404).send({ error: "Plugin not found" });

      // Remove from disk
      if (existsSync(row.installPath)) {
        await rm(row.installPath, { recursive: true, force: true });
      }

      // Remove auth entries
      await db
        .delete(pluginAuth)
        .where(eq(pluginAuth.pluginId, row.pluginId));

      // Remove DB entry
      await db
        .delete(pluginPackages)
        .where(eq(pluginPackages.id, row.id));

      return { ok: true };
    },
  );

  // ─── Toggle plugin enabled/disabled ─────────────────────────────
  app.patch<{ Params: { id: string }; Body: { enabled: boolean } }>(
    "/plugins/packages/:id",
    async (req, reply) => {
      const [row] = await db
        .select()
        .from(pluginPackages)
        .where(eq(pluginPackages.id, req.params.id))
        .limit(1);

      if (!row) return reply.code(404).send({ error: "Plugin not found" });

      await db
        .update(pluginPackages)
        .set({ enabled: req.body.enabled, updatedAt: new Date() })
        .where(eq(pluginPackages.id, row.id));

      return { ok: true };
    },
  );

  // ─── Get auth key statuses ──────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    "/plugins/packages/:id/auth",
    async (req, reply) => {
      const [row] = await db
        .select()
        .from(pluginPackages)
        .where(eq(pluginPackages.id, req.params.id))
        .limit(1);

      if (!row) return reply.code(404).send({ error: "Plugin not found" });

      const manifest = row.manifestRaw as Record<string, unknown> | null;
      const authFields = Array.isArray(manifest?.auth)
        ? (manifest.auth as Array<{ key: string; label: string; required: boolean; url?: string }>)
        : [];

      const configuredKeys = await db
        .select({ authKey: pluginAuth.authKey })
        .from(pluginAuth)
        .where(eq(pluginAuth.pluginId, row.pluginId));

      const configuredSet = new Set(configuredKeys.map((r) => r.authKey));

      return authFields.map((field) => ({
        key: field.key,
        label: field.label,
        required: field.required,
        url: field.url,
        configured: configuredSet.has(field.key),
      }));
    },
  );

  // ─── Set/update auth credential ─────────────────────────────────
  app.put<{
    Params: { id: string; key: string };
    Body: { value: string };
  }>("/plugins/packages/:id/auth/:key", async (req, reply) => {
    const [row] = await db
      .select()
      .from(pluginPackages)
      .where(eq(pluginPackages.id, req.params.id))
      .limit(1);

    if (!row) return reply.code(404).send({ error: "Plugin not found" });

    const encrypted = encryptAuthValue(req.body.value);

    const existing = await db
      .select()
      .from(pluginAuth)
      .where(
        and(
          eq(pluginAuth.pluginId, row.pluginId),
          eq(pluginAuth.authKey, req.params.key),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(pluginAuth)
        .set({ encryptedValue: encrypted, updatedAt: new Date() })
        .where(eq(pluginAuth.id, existing[0].id));
    } else {
      await db.insert(pluginAuth).values({
        pluginId: row.pluginId,
        authKey: req.params.key,
        encryptedValue: encrypted,
      });
    }

    return { ok: true };
  });

  // ─── Unified plugin index ───────────────────────────────────────
  app.get<{
    Querystring: { source?: string; isNsfw?: string };
  }>("/plugins/index", async (req) => {
    const { source, isNsfw } = req.query;
    const filterNsfw = isNsfw === "false" ? false : undefined;

    // Installed Obscura-native plugins
    const installed = await db
      .select()
      .from(pluginPackages)
      .orderBy(pluginPackages.name);

    // Installed Stash-compat scrapers
    const stashScrapers = await db
      .select()
      .from(schema.scraperPackages)
      .orderBy(schema.scraperPackages.name);

    // Merge into unified list
    const unified = [
      ...installed.map((p) => ({
        id: p.id,
        pluginId: p.pluginId,
        name: p.name,
        version: p.version,
        runtime: p.runtime,
        isNsfw: p.isNsfw,
        enabled: p.enabled,
        capabilities: p.capabilities ?? {},
        pluginType: "obscura-native" as const,
        sourceIndex: p.sourceIndex,
      })),
      ...stashScrapers.map((s) => ({
        id: s.id,
        pluginId: s.packageId,
        name: s.name,
        version: s.version,
        runtime: "stash-compat" as const,
        isNsfw: s.isNsfw,
        enabled: s.enabled,
        capabilities: s.capabilities ?? {},
        pluginType: "stash-compat" as const,
        sourceIndex: "stash-community",
      })),
    ];

    // Filter by NSFW if requested
    if (filterNsfw === false) {
      return unified.filter((p) => !p.isNsfw);
    }

    return unified;
  });

  // ─── Single-item plugin execution ───────────────────────────────
  app.post<{
    Params: { id: string };
    Body: {
      action: string;
      entityId?: string;
      input?: Record<string, unknown>;
      saveResult?: boolean;
    };
  }>("/plugins/:id/execute", async (req, reply) => {
    const { id } = req.params;
    const { action, input } = req.body;

    if (!action) {
      return reply.code(400).send({ error: "action is required" });
    }

    // Look up the plugin
    const [pkg] = await db
      .select()
      .from(pluginPackages)
      .where(eq(pluginPackages.id, id))
      .limit(1);

    if (!pkg) {
      return reply.code(404).send({ error: "Plugin not found" });
    }

    if (!pkg.enabled) {
      return reply.code(400).send({ error: "Plugin is disabled" });
    }

    // Resolve auth credentials
    const authRows = await db
      .select({ authKey: pluginAuth.authKey, encryptedValue: pluginAuth.encryptedValue })
      .from(pluginAuth)
      .where(eq(pluginAuth.pluginId, pkg.pluginId));
    const auth = await resolvePluginAuth(pkg.pluginId, authRows);

    // Parse the manifest for runtime info
    let manifest: OscuraPluginManifest;
    try {
      manifest = await readManifest(pkg.installPath);
    } catch (err) {
      return reply.code(500).send({
        error: `Failed to read plugin manifest: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // Execute based on runtime
    try {
      let result: unknown = null;

      if (manifest.runtime === "typescript") {
        const plugin = await loadTypeScriptPlugin(manifest, pkg.installPath);
        result = await plugin.execute(action, (input ?? {}) as PluginInput, auth);
      } else if (manifest.runtime === "python") {
        result = await runNativePythonPlugin(
          manifest,
          pkg.installPath,
          action,
          (input ?? {}) as PluginInput,
          auth,
        );
      } else {
        return reply.code(400).send({
          error: `Unsupported plugin runtime: ${manifest.runtime}`,
        });
      }

      // Optionally save as a scrape_result row
      if (req.body.saveResult && req.body.entityId && result && typeof result === "object") {
        const r = result as Record<string, unknown>;
        const entityType = action.startsWith("folder") ? "folder"
          : action.startsWith("audio") ? "audio_track"
          : action.startsWith("gallery") ? "gallery"
          : action.startsWith("image") ? "image"
          : "scene";

        const [saved] = await db
          .insert(scrapeResults)
          .values({
            sceneId: entityType === "scene" ? req.body.entityId : null,
            entityType,
            entityId: req.body.entityId,
            pluginPackageId: pkg.id,
            action,
            matchType: "plugin",
            status: "pending",
            rawResult: result as Record<string, unknown>,
            proposedTitle: (r.title ?? r.name ?? null) as string | null,
            proposedDate: (r.date ?? null) as string | null,
            proposedDetails: (r.details ?? null) as string | null,
            proposedUrl: Array.isArray(r.urls) ? (r.urls[0] as string ?? null) : (r.url as string ?? null),
            proposedUrls: Array.isArray(r.urls) ? r.urls as string[] : null,
            proposedStudioName: (r.studioName ?? null) as string | null,
            proposedPerformerNames: Array.isArray(r.performerNames) ? r.performerNames as string[] : null,
            proposedTagNames: Array.isArray(r.tagNames) ? r.tagNames as string[] : null,
            proposedImageUrl: (r.imageUrl ?? null) as string | null,
            proposedEpisodeNumber: typeof r.episodeNumber === "number" ? r.episodeNumber : null,
          })
          .returning();

        // Build normalized result matching NormalizedScrapeResult shape
        const normalized = {
          title: (r.title ?? r.name ?? null) as string | null,
          date: (r.date ?? null) as string | null,
          details: (r.details ?? null) as string | null,
          url: Array.isArray(r.urls) ? (r.urls[0] as string ?? null) : (r.url as string ?? null),
          studioName: (r.studioName ?? null) as string | null,
          performerNames: Array.isArray(r.performerNames) ? r.performerNames as string[] : [],
          tagNames: Array.isArray(r.tagNames) ? r.tagNames as string[] : [],
          imageUrl: (r.imageUrl ?? null) as string | null,
        };

        return { ok: true, result: saved, normalized, pluginId: pkg.pluginId, action };
      }

      return { ok: true, result, pluginId: pkg.pluginId, action };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.warn(`[plugin-execute] ${pkg.pluginId} → ${action} error: ${message}`);
      return reply.code(500).send({
        error: `Plugin execution failed: ${message}`,
      });
    }
  });

  // ─── Batch identify (enqueue job) ───────────────────────────────
  app.post<{
    Body: {
      pluginId?: string;
      action: string;
      entityType: string;
      entityIds: string[];
      autoAccept?: boolean;
      folderCascade?: boolean;
    };
  }>("/plugins/batch", async (req, reply) => {
    // Placeholder — will enqueue a pg-boss job
    return reply.code(501).send({
      error: "Batch identification not yet implemented",
    });
  });

  // ─── Batch job status ───────────────────────────────────────────
  app.get<{ Params: { jobId: string } }>(
    "/plugins/batch/:jobId",
    async (req, reply) => {
      return reply.code(501).send({
        error: "Batch status not yet implemented",
      });
    },
  );

  // ─── Folder cascade ─────────────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: {
      folderId: string;
      externalSeriesId: string;
      seasonNumber?: number;
    };
  }>("/plugins/:id/folder-cascade", async (req, reply) => {
    // Placeholder — will invoke plugin's folderCascade capability
    return reply.code(501).send({
      error: "Folder cascade not yet implemented",
    });
  });

  // ─── Obscura community plugin index ─────────────────────────
  app.get("/plugins/obscura-index", async (_req, reply) => {
    // In dev, read from local disk path; in production, fetch from remote URL
    let localPath = process.env.OBSCURA_PLUGIN_INDEX_PATH;
    const remoteUrl = process.env.OBSCURA_PLUGIN_INDEX_URL;

    // Dev fallback: walk up from cwd looking for the sibling repo
    if (!localPath && !remoteUrl && process.env.NODE_ENV !== "production") {
      let dir = process.cwd();
      for (let i = 0; i < 5; i++) {
        const parent = path.dirname(dir);
        const candidate = path.join(parent, "obscura-community-plugins");
        if (existsSync(path.join(candidate, "index.yml"))) {
          localPath = candidate;
          break;
        }
        if (parent === dir) break;
        dir = parent;
      }
    }

    if (localPath) {
      const indexPath = path.join(localPath, "index.yml");
      if (!existsSync(indexPath)) {
        return reply.code(404).send({ error: `Plugin index not found at ${indexPath}` });
      }
      try {
        const raw = await readFile(indexPath, "utf-8");
        const entries = yaml.load(raw, { schema: yaml.JSON_SCHEMA });
        if (!Array.isArray(entries)) {
          return reply.code(500).send({ error: "Invalid plugin index format" });
        }

        // Mark which are already installed
        const installedPlugins = await db
          .select({ pluginId: pluginPackages.pluginId, version: pluginPackages.version })
          .from(pluginPackages);
        const installedMap = new Map(installedPlugins.map((p) => [p.pluginId, p.version]));

        return entries.map((e: Record<string, unknown>) => ({
          ...e,
          installed: installedMap.has(String(e.id)),
          installedVersion: installedMap.get(String(e.id)) ?? null,
          // Include local path so the frontend can install from disk
          localPath: path.join(localPath, "plugins", String(e.id)),
        }));
      } catch (err) {
        return reply.code(500).send({
          error: `Failed to read plugin index: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    if (remoteUrl) {
      try {
        const entries = await fetchPluginIndex(remoteUrl);

        const installedPlugins = await db
          .select({ pluginId: pluginPackages.pluginId, version: pluginPackages.version })
          .from(pluginPackages);
        const installedMap = new Map(installedPlugins.map((p) => [p.pluginId, p.version]));

        return entries.map((e) => ({
          ...e,
          installed: installedMap.has(e.id),
          installedVersion: installedMap.get(e.id) ?? null,
        }));
      } catch (err) {
        return reply.code(502).send({
          error: `Failed to fetch remote plugin index: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    return reply.code(404).send({
      error: "No plugin index configured. Set OBSCURA_PLUGIN_INDEX_PATH (dev) or OBSCURA_PLUGIN_INDEX_URL (production).",
    });
  });
}
