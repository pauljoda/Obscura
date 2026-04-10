import path from "node:path";
import type { FastifyInstance } from "fastify";
import { normalizeBackgroundWorkerConcurrency } from "@obscura/contracts";
import { and, asc, eq, type SQL } from "drizzle-orm";
import { db, schema } from "../db";
import {
  browseDirectories,
  ensureLibrarySettingsRow,
  getStorageStats,
  verifyDirectory,
} from "../lib/library";
import { syncMediaNsfwWithLibraryRoot } from "../lib/library-root-nsfw-sync";

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
        backgroundWorkerConcurrency: normalizeBackgroundWorkerConcurrency(
          payload.backgroundWorkerConcurrency ?? settings.backgroundWorkerConcurrency
        ),
        nsfwLanAutoEnable: payload.nsfwLanAutoEnable ?? settings.nsfwLanAutoEnable,
        metadataStorageDedicated:
          payload.metadataStorageDedicated ?? settings.metadataStorageDedicated,
        updatedAt: new Date(),
      })
      .where(eq(librarySettings.id, settings.id))
      .returning();

    return updated;
  });

  app.get("/libraries", async (request) => {
    const query = request.query as {
      scanVideos?: string;
      scanImages?: string;
      scanAudio?: string;
      enabled?: string;
    };
    const asBool = (raw?: string) => {
      if (raw == null) return undefined;
      if (raw === "true" || raw === "1") return true;
      if (raw === "false" || raw === "0") return false;
      return undefined;
    };
    const filters: SQL[] = [];
    const scanVideos = asBool(query.scanVideos);
    const scanImages = asBool(query.scanImages);
    const scanAudio = asBool(query.scanAudio);
    const enabled = asBool(query.enabled);
    if (scanVideos != null) filters.push(eq(libraryRoots.scanVideos, scanVideos));
    if (scanImages != null) filters.push(eq(libraryRoots.scanImages, scanImages));
    if (scanAudio != null) filters.push(eq(libraryRoots.scanAudio, scanAudio));
    if (enabled != null) filters.push(eq(libraryRoots.enabled, enabled));
    const whereClause = filters.length > 0 ? and(...filters) : undefined;
    const roots = await db
      .select()
      .from(libraryRoots)
      .where(whereClause)
      .orderBy(asc(libraryRoots.path));
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
      scanAudio?: boolean;
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
          scanAudio: body.scanAudio ?? true,
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
      scanAudio?: boolean;
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
          scanAudio: body.scanAudio ?? existing.scanAudio,
          isNsfw: body.isNsfw ?? existing.isNsfw,
          updatedAt: new Date(),
        })
        .where(eq(libraryRoots.id, id))
        .returning();

      if (updated && body.isNsfw !== undefined) {
        const prevNsfw = existing.isNsfw === true;
        const nextNsfw = updated.isNsfw === true;
        if (prevNsfw !== nextNsfw) {
          await syncMediaNsfwWithLibraryRoot(db, updated.path, nextNsfw);
        }
      }

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
  // Only trusts X-Forwarded-For when the direct socket connection is from
  // a loopback address (i.e. the Docker nginx reverse proxy).
  app.get("/client-info", async (request) => {
    const socketIp = request.socket.remoteAddress ?? "";
    const isFromTrustedProxy = isLoopback(socketIp);

    let clientIp = socketIp;
    if (isFromTrustedProxy) {
      const forwarded = (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim();
      if (forwarded) clientIp = forwarded;
    }

    return { isLan: isLanIp(clientIp) };
  });
}

function isLoopback(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function isLanIp(ip: string): boolean {
  // Loopback
  if (isLoopback(ip)) return true;
  // IPv4 private ranges
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  // IPv6-mapped IPv4 (::ffff:10.x, ::ffff:192.168.x)
  const mapped = ip.match(/^::ffff:(.+)$/);
  if (mapped) return isLanIp(mapped[1]);
  // 172.16.0.0/12
  const match172 = ip.match(/^172\.(\d+)\./);
  if (match172) {
    const octet = parseInt(match172[1], 10);
    if (octet >= 16 && octet <= 31) return true;
  }
  // IPv6 ULA (fc00::/7 covers both fc and fd prefixes)
  if (ip.startsWith("fd") || ip.startsWith("fc")) return true;
  // Docker bridge 172.17.x.x is already covered by 172.16-31 range
  return false;
}
