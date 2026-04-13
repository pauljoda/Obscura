import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { mkdir, rm, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { db, schema } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import { getCacheRootDir } from "@obscura/media-core";
import {
  readManifest,
  encryptAuthValue,
  resolvePluginAuth,
  fetchPluginIndex,
  clearPluginIndexCache,
  type PluginIndexEntry,
  type InstalledPluginDto,
} from "@obscura/plugins";

const { pluginPackages, pluginAuth, scrapeResults } = schema;

function getPluginsDir() {
  return path.join(getCacheRootDir(), "plugins");
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

  // ─── Install plugin from community index ────────────────────────
  app.post<{
    Body: { pluginId: string; zipUrl: string; sha256?: string };
  }>("/plugins/packages", async (req, reply) => {
    const { pluginId, zipUrl, sha256: expectedSha } = req.body;

    // Download the zip
    const res = await fetch(zipUrl);
    if (!res.ok) {
      return reply
        .code(502)
        .send({ error: `Failed to download plugin: ${res.status}` });
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    // Verify SHA256 if provided
    if (expectedSha) {
      const actual = createHash("sha256").update(buffer).digest("hex");
      if (actual !== expectedSha) {
        return reply.code(400).send({
          error: `SHA256 mismatch: expected ${expectedSha}, got ${actual}`,
        });
      }
    }

    // Extract to plugins dir
    const pluginsDir = getPluginsDir();
    const installDir = path.join(pluginsDir, pluginId);
    await mkdir(installDir, { recursive: true });

    const files = unzipSync(new Uint8Array(buffer));
    for (const [name, data] of Object.entries(files)) {
      const outPath = path.join(installDir, name);
      // Path traversal guard
      if (!outPath.startsWith(installDir)) continue;
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, data);
    }

    // Parse manifest
    let manifest;
    try {
      manifest = await readManifest(installDir);
    } catch (err) {
      await rm(installDir, { recursive: true, force: true });
      return reply.code(400).send({
        error: `Invalid plugin manifest: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // Upsert into DB
    const sha = createHash("sha256").update(buffer).digest("hex");
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
          installPath: installDir,
          sha256: sha,
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
        installPath: installDir,
        sha256: sha,
        isNsfw: manifest.isNsfw,
        capabilities: manifest.capabilities as Record<string, boolean>,
        manifestRaw: manifest as unknown as Record<string, unknown>,
        enabled: true,
        sourceIndex: "obscura-community",
      });
    }

    return { ok: true, pluginId: manifest.id };
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
    // For now, this is a placeholder that returns the correct structure.
    // Full execution logic will be wired when plugins are installed.
    return reply.code(501).send({
      error: "Plugin execution not yet implemented — install plugins first",
    });
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
}
