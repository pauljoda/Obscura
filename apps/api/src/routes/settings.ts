import path from "node:path";
import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import {
  browseDirectories,
  ensureLibrarySettingsRow,
  getStorageStats,
  verifyDirectory,
} from "../lib/library";

const { libraryRoots, librarySettings } = schema;

function labelForPath(targetPath: string) {
  const base = path.basename(targetPath);
  return base || targetPath;
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/settings/library", async () => {
    const settings = await ensureLibrarySettingsRow();
    const roots = await db.select().from(libraryRoots).orderBy(asc(libraryRoots.path));
    const storage = await getStorageStats();

    return {
      settings,
      roots,
      storage,
    };
  });

  app.put("/settings/library", async (request) => {
    const payload = request.body as Partial<typeof librarySettings.$inferInsert>;
    const settings = await ensureLibrarySettingsRow();

    const [updated] = await db
      .update(librarySettings)
      .set({
        autoScanEnabled: payload.autoScanEnabled ?? settings.autoScanEnabled,
        scanIntervalMinutes: payload.scanIntervalMinutes ?? settings.scanIntervalMinutes,
        autoGenerateMetadata: payload.autoGenerateMetadata ?? settings.autoGenerateMetadata,
        autoGenerateFingerprints:
          payload.autoGenerateFingerprints ?? settings.autoGenerateFingerprints,
        autoGeneratePreview: payload.autoGeneratePreview ?? settings.autoGeneratePreview,
        generateTrickplay: payload.generateTrickplay ?? settings.generateTrickplay,
        trickplayIntervalSeconds:
          payload.trickplayIntervalSeconds ?? settings.trickplayIntervalSeconds,
        previewClipDurationSeconds:
          payload.previewClipDurationSeconds ?? settings.previewClipDurationSeconds,
        thumbnailQuality: payload.thumbnailQuality ?? settings.thumbnailQuality,
        trickplayQuality: payload.trickplayQuality ?? settings.trickplayQuality,
        nsfwLanAutoEnable: payload.nsfwLanAutoEnable ?? settings.nsfwLanAutoEnable,
        updatedAt: new Date(),
      })
      .where(eq(librarySettings.id, settings.id))
      .returning();

    return updated;
  });

  app.get("/libraries", async () => {
    const roots = await db.select().from(libraryRoots).orderBy(asc(libraryRoots.path));
    return { roots };
  });

  app.get("/libraries/browse", async (request, reply) => {
    const query = request.query as { path?: string };

    try {
      return await browseDirectories(query.path);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : "Unable to browse directory" };
    }
  });

  app.post("/libraries", async (request, reply) => {
    const body = request.body as {
      path: string;
      label?: string;
      enabled?: boolean;
      recursive?: boolean;
      scanVideos?: boolean;
      scanImages?: boolean;
    };

    try {
      const resolvedPath = path.resolve(body.path);
      await verifyDirectory(resolvedPath);

      const [created] = await db
        .insert(libraryRoots)
        .values({
          path: resolvedPath,
          label: body.label?.trim() || labelForPath(resolvedPath),
          enabled: body.enabled ?? true,
          recursive: body.recursive ?? true,
          scanVideos: body.scanVideos ?? true,
          scanImages: body.scanImages ?? true,
        })
        .returning();

      return created;
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : "Unable to add library root" };
    }
  });

  app.patch("/libraries/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      path?: string;
      label?: string;
      enabled?: boolean;
      recursive?: boolean;
      scanVideos?: boolean;
      scanImages?: boolean;
      isNsfw?: boolean;
    };

    const [existing] = await db.select().from(libraryRoots).where(eq(libraryRoots.id, id));
    if (!existing) {
      reply.code(404);
      return { error: "Library root not found" };
    }

    try {
      const nextPath = body.path ? path.resolve(body.path) : existing.path;
      if (body.path) {
        await verifyDirectory(nextPath);
      }

      const [updated] = await db
        .update(libraryRoots)
        .set({
          path: nextPath,
          label: body.label?.trim() || existing.label,
          enabled: body.enabled ?? existing.enabled,
          recursive: body.recursive ?? existing.recursive,
          scanVideos: body.scanVideos ?? existing.scanVideos,
          scanImages: body.scanImages ?? existing.scanImages,
          isNsfw: body.isNsfw ?? existing.isNsfw,
          updatedAt: new Date(),
        })
        .where(eq(libraryRoots.id, id))
        .returning();

      return updated;
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : "Unable to update library root" };
    }
  });

  app.delete("/libraries/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [deleted] = await db.delete(libraryRoots).where(eq(libraryRoots.id, id)).returning();

    if (!deleted) {
      reply.code(404);
      return { error: "Library root not found" };
    }

    return { ok: true };
  });

  // ─── GET /client-info ─────────────────────────────────────────
  // Returns whether the connecting client is on a LAN/private network.
  app.get("/client-info", async (request) => {
    const ip = (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      ?? request.socket.remoteAddress
      ?? "";
    return { isLan: isLanIp(ip) };
  });
}

function isLanIp(ip: string): boolean {
  // IPv4 private ranges + loopback
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("fd")
  ) return true;
  // 172.16.0.0/12
  const match = ip.match(/^172\.(\d+)\./);
  if (match) {
    const octet = parseInt(match[1], 10);
    if (octet >= 16 && octet <= 31) return true;
  }
  return false;
}
