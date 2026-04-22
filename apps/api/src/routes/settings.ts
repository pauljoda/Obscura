import type { FastifyInstance } from "fastify";
import {
  browseDirectories,
  createLibraryRootWrite,
  deleteLibraryRootWrite,
  LibraryRootNotFoundError,
  listLibraryRootsRead,
  loadLibraryConfig,
  resolveClientInfo,
  updateLibraryRootWrite,
  updateLibrarySettingsWrite,
  type CreateLibraryRootBody,
  type LibrarySettingsWritePayload,
  type ListLibrariesQuery,
  type UpdateLibraryRootBody,
} from "@obscura/app-core";
import { asc } from "drizzle-orm";
import { db, schema } from "../db";
import { AppError } from "../plugins/error-handler";
import {
  ensureLibrarySettingsRow,
  getStorageStats,
} from "../lib/library";

const { libraryRoots } = schema;

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/settings/library", async () => {
    return loadLibraryConfig({
      ensureSettings: () => ensureLibrarySettingsRow(),
      loadRoots: () =>
        db.select().from(libraryRoots).orderBy(asc(libraryRoots.path)),
      loadStorage: () => getStorageStats(),
    });
  });

  app.put("/settings/library", async (request) => {
    return updateLibrarySettingsWrite(
      db,
      request.body as LibrarySettingsWritePayload,
    );
  });

  app.get("/libraries", async (request) => {
    return listLibraryRootsRead(db, request.query as ListLibrariesQuery);
  });

  app.get("/libraries/browse", async (request) => {
    const query = request.query as { path?: string };
    try {
      return await browseDirectories(query.path);
    } catch (error) {
      throw new AppError(
        400,
        error instanceof Error ? error.message : "Unable to browse directory",
      );
    }
  });

  app.post("/libraries", async (request, reply) => {
    try {
      const created = await createLibraryRootWrite(
        db,
        request.body as CreateLibraryRootBody,
      );
      reply.code(201);
      return created;
    } catch (error) {
      throw new AppError(
        400,
        error instanceof Error ? error.message : "Unable to add library root",
      );
    }
  });

  app.patch("/libraries/:id", async (request) => {
    const { id } = request.params as { id: string };
    try {
      return await updateLibraryRootWrite(
        db,
        id,
        request.body as UpdateLibraryRootBody,
      );
    } catch (error) {
      if (error instanceof LibraryRootNotFoundError) {
        throw new AppError(404, error.message);
      }
      throw new AppError(
        400,
        error instanceof Error ? error.message : "Unable to update library root",
      );
    }
  });

  app.delete("/libraries/:id", async (request) => {
    const { id } = request.params as { id: string };
    try {
      return await deleteLibraryRootWrite(db, id);
    } catch (error) {
      if (error instanceof LibraryRootNotFoundError) {
        throw new AppError(404, error.message);
      }
      throw error;
    }
  });

  // ─── GET /client-info ─────────────────────────────────────────
  // Returns whether the connecting client is on a LAN/private network.
  // Only trusts X-Forwarded-For when the direct socket connection is from
  // a loopback address (i.e. the Docker nginx reverse proxy).
  app.get("/client-info", async (request) => {
    const info = resolveClientInfo({
      socketIp: request.socket.remoteAddress,
      forwardedFor: request.headers["x-forwarded-for"] as string | undefined,
    });
    return { isLan: info.isLan };
  });
}
