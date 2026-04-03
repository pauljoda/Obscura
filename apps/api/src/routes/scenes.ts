import type { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import { eq, ilike, or, desc, asc, sql, inArray, and } from "drizzle-orm";

import { existsSync } from "node:fs";

const { scenes, scenePerformers, sceneTags, sceneMarkers, performers, tags, studios } = schema;

// Helper: format file size
function formatFileSize(bytes: number | null): string | null {
  if (!bytes) return null;
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

// Helper: format duration
function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Helper: resolution label
function resolutionLabel(width: number | null, height: number | null): string | null {
  if (!height) return null;
  if (height >= 2160) return "4K";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  return `${height}p`;
}

export async function scenesRoutes(app: FastifyInstance) {
  // ─── GET /scenes ──────────────────────────────────────────────
  app.get("/scenes", async (request) => {
    const query = request.query as {
      search?: string;
      sort?: string;
      order?: string;
      tag?: string | string[];
      performer?: string | string[];
      studio?: string;
      resolution?: string;
      limit?: string;
      offset?: string;
    };

    const limit = Math.min(Number(query.limit) || 50, 100);
    const offset = Number(query.offset) || 0;

    // Build WHERE conditions
    const conditions = [];

    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(scenes.title, term),
          ilike(scenes.details, term),
          ilike(scenes.filePath, term)
        )!
      );
    }

    if (query.resolution) {
      const resMap: Record<string, [number, number]> = {
        "4K": [2160, 99999],
        "1080p": [1080, 2159],
        "720p": [720, 1079],
        "480p": [0, 719],
      };
      const range = resMap[query.resolution];
      if (range) {
        conditions.push(
          and(
            sql`${scenes.height} >= ${range[0]}`,
            sql`${scenes.height} <= ${range[1]}`
          )!
        );
      }
    }

    if (query.studio) {
      conditions.push(eq(scenes.studioId, query.studio));
    }

    // Tag filter: find scenes that have ALL specified tags
    const tagNames = Array.isArray(query.tag) ? query.tag : query.tag ? [query.tag] : [];
    if (tagNames.length > 0) {
      const tagRows = await db
        .select({ id: tags.id })
        .from(tags)
        .where(inArray(tags.name, tagNames));
      const tagIds = tagRows.map((t) => t.id);
      if (tagIds.length > 0) {
        const taggedSceneIds = await db
          .selectDistinct({ sceneId: sceneTags.sceneId })
          .from(sceneTags)
          .where(inArray(sceneTags.tagId, tagIds));
        const ids = taggedSceneIds.map((r) => r.sceneId);
        if (ids.length > 0) {
          conditions.push(inArray(scenes.id, ids));
        } else {
          return { scenes: [], total: 0, limit, offset };
        }
      }
    }

    // Performer filter
    const perfNames = Array.isArray(query.performer) ? query.performer : query.performer ? [query.performer] : [];
    if (perfNames.length > 0) {
      const perfRows = await db
        .select({ id: performers.id })
        .from(performers)
        .where(inArray(performers.name, perfNames));
      const perfIds = perfRows.map((p) => p.id);
      if (perfIds.length > 0) {
        const perfSceneIds = await db
          .selectDistinct({ sceneId: scenePerformers.sceneId })
          .from(scenePerformers)
          .where(inArray(scenePerformers.performerId, perfIds));
        const ids = perfSceneIds.map((r) => r.sceneId);
        if (ids.length > 0) {
          conditions.push(inArray(scenes.id, ids));
        } else {
          return { scenes: [], total: 0, limit, offset };
        }
      }
    }

    // Sort
    const sortMap: Record<string, any> = {
      recent: desc(scenes.createdAt),
      title: asc(scenes.title),
      duration: desc(scenes.duration),
      size: desc(scenes.fileSize),
      rating: desc(scenes.rating),
      date: desc(scenes.date),
      plays: desc(scenes.playCount),
    };
    const orderBy = sortMap[query.sort ?? "recent"] ?? desc(scenes.createdAt);

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(scenes)
      .where(where);

    // Fetch scenes
    const sceneRows = await db
      .select()
      .from(scenes)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Fetch relations for each scene
    const sceneIds = sceneRows.map((s) => s.id);

    const perfJoins =
      sceneIds.length > 0
        ? await db
            .select({
              sceneId: scenePerformers.sceneId,
              performerId: performers.id,
              performerName: performers.name,
            })
            .from(scenePerformers)
            .innerJoin(performers, eq(scenePerformers.performerId, performers.id))
            .where(inArray(scenePerformers.sceneId, sceneIds))
        : [];

    const tagJoins =
      sceneIds.length > 0
        ? await db
            .select({
              sceneId: sceneTags.sceneId,
              tagId: tags.id,
              tagName: tags.name,
            })
            .from(sceneTags)
            .innerJoin(tags, eq(sceneTags.tagId, tags.id))
            .where(inArray(sceneTags.sceneId, sceneIds))
        : [];

    // Assemble response
    const result = sceneRows.map((scene) => ({
      id: scene.id,
      title: scene.title,
      details: scene.details,
      date: scene.date,
      rating: scene.rating,
      organized: scene.organized,
      duration: scene.duration,
      durationFormatted: formatDuration(scene.duration),
      resolution: resolutionLabel(scene.width, scene.height),
      width: scene.width,
      height: scene.height,
      codec: scene.codec?.toUpperCase() ?? null,
      container: scene.container,
      fileSize: scene.fileSize,
      fileSizeFormatted: formatFileSize(scene.fileSize),
      filePath: scene.filePath,
      hasVideo: !!(scene.filePath && existsSync(scene.filePath)),
      streamUrl: scene.filePath && existsSync(scene.filePath) ? `/stream/${scene.id}` : null,
      playCount: scene.playCount,
      studioId: scene.studioId,
      performers: perfJoins
        .filter((p) => p.sceneId === scene.id)
        .map((p) => ({ id: p.performerId, name: p.performerName })),
      tags: tagJoins
        .filter((t) => t.sceneId === scene.id)
        .map((t) => ({ id: t.tagId, name: t.tagName })),
      createdAt: scene.createdAt,
    }));

    return {
      scenes: result,
      total: Number(countResult.count),
      limit,
      offset,
    };
  });

  // ─── GET /scenes/stats ────────────────────────────────────────
  app.get("/scenes/stats", async () => {
    const [stats] = await db
      .select({
        totalScenes: sql<number>`count(*)`,
        totalDuration: sql<number>`coalesce(sum(${scenes.duration}), 0)`,
        totalSize: sql<number>`coalesce(sum(${scenes.fileSize}), 0)`,
        totalPlays: sql<number>`coalesce(sum(${scenes.playCount}), 0)`,
      })
      .from(scenes);

    // Scenes added in last 7 days
    const [recentStats] = await db
      .select({
        recentCount: sql<number>`count(*)`,
      })
      .from(scenes)
      .where(sql`${scenes.createdAt} > now() - interval '7 days'`);

    const durationSec = Number(stats.totalDuration);
    const hours = Math.floor(durationSec / 3600);
    const mins = Math.floor((durationSec % 3600) / 60);

    return {
      totalScenes: Number(stats.totalScenes),
      totalDuration: durationSec,
      totalDurationFormatted: `${hours}h ${mins}m`,
      totalSize: Number(stats.totalSize),
      totalSizeFormatted: formatFileSize(Number(stats.totalSize)),
      totalPlays: Number(stats.totalPlays),
      recentCount: Number(recentStats.recentCount),
    };
  });

  // ─── GET /scenes/:id ──────────────────────────────────────────
  app.get("/scenes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const scene = await db.query.scenes.findFirst({
      where: eq(scenes.id, id),
      with: {
        studio: true,
        scenePerformers: {
          with: { performer: true },
        },
        sceneTags: {
          with: { tag: true },
        },
        markers: {
          with: { primaryTag: true },
          orderBy: asc(sceneMarkers.seconds),
        },
      },
    });

    if (!scene) {
      reply.code(404);
      return { error: "Scene not found" };
    }

    return {
      id: scene.id,
      title: scene.title,
      details: scene.details,
      date: scene.date,
      rating: scene.rating,
      organized: scene.organized,
      interactive: scene.interactive,
      duration: scene.duration,
      durationFormatted: formatDuration(scene.duration),
      resolution: resolutionLabel(scene.width, scene.height),
      width: scene.width,
      height: scene.height,
      frameRate: scene.frameRate,
      bitRate: scene.bitRate,
      codec: scene.codec?.toUpperCase() ?? null,
      container: scene.container,
      fileSize: scene.fileSize,
      fileSizeFormatted: formatFileSize(scene.fileSize),
      filePath: scene.filePath,
      hasVideo: !!(scene.filePath && existsSync(scene.filePath)),
      streamUrl: scene.filePath && existsSync(scene.filePath) ? `/stream/${scene.id}` : null,
      thumbnailPath: scene.thumbnailPath,
      previewPath: scene.previewPath,
      playCount: scene.playCount,
      playDuration: scene.playDuration,
      resumeTime: scene.resumeTime,
      lastPlayedAt: scene.lastPlayedAt,
      studio: scene.studio
        ? { id: scene.studio.id, name: scene.studio.name, url: scene.studio.url }
        : null,
      performers: scene.scenePerformers.map((sp) => ({
        id: sp.performer.id,
        name: sp.performer.name,
        gender: sp.performer.gender,
        imageUrl: sp.performer.imageUrl,
        favorite: sp.performer.favorite,
      })),
      tags: scene.sceneTags.map((st) => ({
        id: st.tag.id,
        name: st.tag.name,
      })),
      markers: scene.markers.map((m) => ({
        id: m.id,
        title: m.title,
        seconds: m.seconds,
        endSeconds: m.endSeconds,
        primaryTag: m.primaryTag
          ? { id: m.primaryTag.id, name: m.primaryTag.name }
          : null,
      })),
      createdAt: scene.createdAt,
      updatedAt: scene.updatedAt,
    };
  });

  // ─── GET /studios (for filter dropdowns) ──────────────────────
  app.get("/studios", async () => {
    const rows = await db
      .select({ id: studios.id, name: studios.name })
      .from(studios)
      .orderBy(asc(studios.name));
    return { studios: rows };
  });

  // ─── GET /performers (for filter dropdowns) ───────────────────
  app.get("/performers", async () => {
    const rows = await db
      .select({
        id: performers.id,
        name: performers.name,
        sceneCount: performers.sceneCount,
        favorite: performers.favorite,
      })
      .from(performers)
      .orderBy(asc(performers.name));
    return { performers: rows };
  });

  // ─── GET /tags (for filter dropdowns) ─────────────────────────
  app.get("/tags", async () => {
    const rows = await db
      .select({
        id: tags.id,
        name: tags.name,
        sceneCount: tags.sceneCount,
      })
      .from(tags)
      .orderBy(desc(tags.sceneCount));
    return { tags: rows };
  });
}
