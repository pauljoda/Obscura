import type { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import { AppError } from "../plugins/error-handler";
import { eq } from "drizzle-orm";
import {
  ConflictError,
  InternalError,
  NotFoundError,
  UpstreamError,
  ValidationError,
  acceptPluginResultWrite,
  deletePluginPackageWrite,
  executePluginWrite,
  getObscuraPluginIndexRead,
  getPluginAuthStatusesRead,
  getPluginUpdateStatusesRead,
  getUnifiedPluginIndexRead,
  installPluginPackageWrite,
  mapInstalledPluginPackages,
  setPluginAuthValueWrite,
  setPluginPackageEnabledWrite,
} from "@obscura/app-core";

const { pluginPackages, pluginAuth } = schema;

function rethrowAppCoreError(error: unknown): never {
  if (error instanceof NotFoundError) throw new AppError(404, error.message);
  if (error instanceof ValidationError) throw new AppError(400, error.message);
  if (error instanceof UpstreamError) throw new AppError(502, error.message);
  if (error instanceof ConflictError) throw new AppError(409, error.message);
  if (error instanceof InternalError) throw new AppError(500, error.message);
  throw error;
}

// ─── Route registration ────────────────────────────────────────────

export async function pluginsRoutes(app: FastifyInstance) {
  // ─── List installed plugins ─────────────────────────────────────
  app.get("/plugins/packages", async () => {
    const [packageRows, authRows] = await Promise.all([
      db.select().from(pluginPackages).orderBy(pluginPackages.name),
      db.select().from(pluginAuth),
    ]);
    return mapInstalledPluginPackages({ packageRows, authRows });
  });

  // ─── Install plugin ─────────────────────────────────────────────
  // Supports: zipUrl (download), or localPath (dev: copy from disk)
  app.post<{
    Body: { pluginId: string; zipUrl?: string; localPath?: string; sha256?: string };
  }>("/plugins/packages", async (req) => {
    try {
      return await installPluginPackageWrite(db, req.body);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  // ─── Uninstall plugin ───────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    "/plugins/packages/:id",
    async (req) => {
      try {
        return await deletePluginPackageWrite(db, req.params.id);
      } catch (error) {
        rethrowAppCoreError(error);
      }
    },
  );

  // ─── Toggle plugin enabled/disabled ─────────────────────────────
  app.patch<{ Params: { id: string }; Body: { enabled: boolean } }>(
    "/plugins/packages/:id",
    async (req) => {
      try {
        return await setPluginPackageEnabledWrite(db, req.params.id, req.body.enabled);
      } catch (error) {
        rethrowAppCoreError(error);
      }
    },
  );

  // ─── Get auth key statuses ──────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    "/plugins/packages/:id/auth",
    async (req) => {
      try {
        return await getPluginAuthStatusesRead(db, req.params.id);
      } catch (error) {
        rethrowAppCoreError(error);
      }
    },
  );

  // ─── Set/update auth credential ─────────────────────────────────
  app.put<{
    Params: { id: string; key: string };
    Body: { value: string };
  }>("/plugins/packages/:id/auth/:key", async (req) => {
    try {
      return await setPluginAuthValueWrite(db, {
        pluginDbId: req.params.id,
        authKey: req.params.key,
        value: req.body.value,
      });
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  // ─── Unified plugin index ───────────────────────────────────────
  app.get<{
    Querystring: { source?: string; isNsfw?: string };
  }>("/plugins/index", async (req) => {
    try {
      return await getUnifiedPluginIndexRead(db, req.query);
    } catch (error) {
      rethrowAppCoreError(error);
    }
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
  }>("/plugins/:id/execute", async (req) => {
    try {
      return await executePluginWrite(db, {
        pluginDbId: req.params.id,
        action: req.body.action,
        entityId: req.body.entityId,
        input: req.body.input,
        saveResult: req.body.saveResult,
      });
    } catch (error) {
      rethrowAppCoreError(error);
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

  // ─── Accept a plugin scrape result for any entity type ───────
  app.post<{
    Params: { id: string };
    Body: { fields?: string[] };
  }>("/plugins/results/:id/accept", async (req) => {
    try {
      return await acceptPluginResultWrite(db, {
        scrapeResultId: req.params.id,
        fields: req.body.fields,
      });
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  // ─── Obscura community plugin index ─────────────────────────
  app.get<{ Querystring: { refresh?: string } }>(
    "/plugins/obscura-index",
    async (req) => {
      try {
        return await getObscuraPluginIndexRead(db, req.query);
      } catch (error) {
        rethrowAppCoreError(error);
      }
    },
  );

  // ─── Plugin update check ─────────────────────────────────────
  // Returns one entry per installed plugin with {installedVersion,
  // availableVersion, updateAvailable, zipUrl, sha256} so the UI can
  // show "Update available" badges without re-fetching the full index
  // on every render.
  app.get<{ Querystring: { refresh?: string } }>(
    "/plugins/check-updates",
    async (req) => {
      try {
        return await getPluginUpdateStatusesRead(db, req.query);
      } catch (error) {
        rethrowAppCoreError(error);
      }
    },
  );
}
