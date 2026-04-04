import type { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import { eq, ilike, or, desc, asc, sql, inArray, and } from "drizzle-orm";
import { existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  writeNfo,
  getSidecarPaths,
  getGeneratedSceneDir,
  runProcess,
} from "@obscura/media-core";

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
    const sortColumnMap: Record<string, any> = {
      recent: scenes.createdAt,
      title: scenes.title,
      duration: scenes.duration,
      size: scenes.fileSize,
      rating: scenes.rating,
      date: scenes.date,
      plays: scenes.playCount,
    };
    const defaultDir: Record<string, "asc" | "desc"> = {
      recent: "desc",
      title: "asc",
      duration: "desc",
      size: "desc",
      rating: "desc",
      date: "desc",
      plays: "desc",
    };
    const sortKey = query.sort ?? "recent";
    const col = sortColumnMap[sortKey] ?? scenes.createdAt;
    const dir = query.order === "asc" || query.order === "desc" ? query.order : (defaultDir[sortKey] ?? "desc");
    const orderBy = dir === "asc" ? asc(col) : desc(col);

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
      streamUrl: scene.filePath && existsSync(scene.filePath) ? `/stream/${scene.id}/hls/master.m3u8` : null,
      directStreamUrl: scene.filePath && existsSync(scene.filePath) ? `/stream/${scene.id}/source` : null,
      thumbnailPath: scene.thumbnailPath,
      cardThumbnailPath: scene.cardThumbnailPath,
      spritePath: scene.spritePath,
      trickplayVttPath: scene.trickplayVttPath,
      playCount: scene.playCount,
      orgasmCount: scene.orgasmCount,
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
      url: scene.url,
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
      streamUrl: scene.filePath && existsSync(scene.filePath) ? `/stream/${scene.id}/hls/master.m3u8` : null,
      directStreamUrl: scene.filePath && existsSync(scene.filePath) ? `/stream/${scene.id}/source` : null,
      thumbnailPath: scene.thumbnailPath,
      cardThumbnailPath: scene.cardThumbnailPath,
      previewPath: scene.previewPath,
      spritePath: scene.spritePath,
      trickplayVttPath: scene.trickplayVttPath,
      playCount: scene.playCount,
      orgasmCount: scene.orgasmCount,
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

  // ─── PATCH /scenes/:id ────────────────────────────────────────
  app.patch("/scenes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      title?: string;
      details?: string | null;
      date?: string | null;
      rating?: number | null;
      url?: string | null;
      organized?: boolean;
      orgasmCount?: number;
      studioName?: string | null;
      performerNames?: string[];
      tagNames?: string[];
    };

    const existing = await db.query.scenes.findFirst({
      where: eq(scenes.id, id),
      columns: { id: true, filePath: true },
    });

    if (!existing) {
      reply.code(404);
      return { error: "Scene not found" };
    }

    await db.transaction(async (tx) => {
      const sceneUpdate: Record<string, unknown> = { updatedAt: new Date() };

      if (body.title !== undefined) sceneUpdate.title = body.title;
      if (body.details !== undefined) sceneUpdate.details = body.details;
      if (body.date !== undefined) sceneUpdate.date = body.date;
      if (body.rating !== undefined) sceneUpdate.rating = body.rating;
      if (body.url !== undefined) sceneUpdate.url = body.url;
      if (body.organized !== undefined) sceneUpdate.organized = body.organized;
      if (body.orgasmCount !== undefined) sceneUpdate.orgasmCount = body.orgasmCount;

      // Studio: find or create by name
      if (body.studioName !== undefined) {
        if (body.studioName === null || body.studioName === "") {
          sceneUpdate.studioId = null;
        } else {
          const [existingStudio] = await tx
            .select({ id: studios.id })
            .from(studios)
            .where(ilike(studios.name, body.studioName))
            .limit(1);

          if (existingStudio) {
            sceneUpdate.studioId = existingStudio.id;
          } else {
            const [created] = await tx
              .insert(studios)
              .values({ name: body.studioName })
              .returning({ id: studios.id });
            sceneUpdate.studioId = created.id;
          }
        }
      }

      await tx.update(scenes).set(sceneUpdate).where(eq(scenes.id, id));

      // Performers: replace all
      if (body.performerNames !== undefined) {
        await tx.delete(scenePerformers).where(eq(scenePerformers.sceneId, id));

        for (const name of body.performerNames) {
          if (!name.trim()) continue;

          const [existingPerf] = await tx
            .select({ id: performers.id })
            .from(performers)
            .where(ilike(performers.name, name.trim()))
            .limit(1);

          const performerId = existingPerf?.id ?? (
            await tx
              .insert(performers)
              .values({ name: name.trim() })
              .returning({ id: performers.id })
          )[0].id;

          await tx
            .insert(scenePerformers)
            .values({ sceneId: id, performerId })
            .onConflictDoNothing();
        }

        // Update performer scene counts
        await tx.execute(sql`
          UPDATE performers SET scene_count = (
            SELECT count(*) FROM scene_performers WHERE performer_id = performers.id
          )
        `);
      }

      // Tags: replace all
      if (body.tagNames !== undefined) {
        await tx.delete(sceneTags).where(eq(sceneTags.sceneId, id));

        for (const name of body.tagNames) {
          if (!name.trim()) continue;

          const [existingTag] = await tx
            .select({ id: tags.id })
            .from(tags)
            .where(ilike(tags.name, name.trim()))
            .limit(1);

          const tagId = existingTag?.id ?? (
            await tx
              .insert(tags)
              .values({ name: name.trim() })
              .returning({ id: tags.id })
          )[0].id;

          await tx
            .insert(sceneTags)
            .values({ sceneId: id, tagId })
            .onConflictDoNothing();
        }

        // Update tag scene counts
        await tx.execute(sql`
          UPDATE tags SET scene_count = (
            SELECT count(*) FROM scene_tags WHERE tag_id = tags.id
          )
        `);
      }
    });

    // Write NFO sidecar if the scene has a file
    if (existing.filePath) {
      try {
        // Re-fetch full scene data to write complete NFO
        const updated = await db.query.scenes.findFirst({
          where: eq(scenes.id, id),
          with: {
            studio: true,
            sceneTags: { with: { tag: true } },
          },
        });

        if (updated) {
          await writeNfo(existing.filePath, {
            title: updated.title,
            plot: updated.details,
            date: updated.date,
            studio: updated.studio?.name,
            rating: updated.rating,
            tags: updated.sceneTags.map((st) => st.tag.name),
            duration: updated.duration,
            url: updated.url,
          });
        }
      } catch {
        // NFO write failure is non-fatal
      }
    }

    return { ok: true, id };
  });

  // ─── POST /scenes/:id/markers ──────────────────────────────────
  app.post("/scenes/:id/markers", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      title: string;
      seconds: number;
      endSeconds?: number | null;
      primaryTagName?: string | null;
    };

    if (!body.title?.trim() || body.seconds == null) {
      reply.code(400);
      return { error: "title and seconds are required" };
    }

    const existing = await db.query.scenes.findFirst({
      where: eq(scenes.id, id),
      columns: { id: true },
    });
    if (!existing) {
      reply.code(404);
      return { error: "Scene not found" };
    }

    let primaryTagId: string | null = null;
    if (body.primaryTagName?.trim()) {
      const [existingTag] = await db
        .select({ id: tags.id })
        .from(tags)
        .where(ilike(tags.name, body.primaryTagName.trim()))
        .limit(1);
      primaryTagId = existingTag?.id ?? (
        await db
          .insert(tags)
          .values({ name: body.primaryTagName.trim() })
          .returning({ id: tags.id })
      )[0].id;
    }

    const [marker] = await db
      .insert(sceneMarkers)
      .values({
        sceneId: id,
        title: body.title.trim(),
        seconds: body.seconds,
        endSeconds: body.endSeconds ?? null,
        primaryTagId,
      })
      .returning();

    const primaryTag = primaryTagId
      ? await db.query.tags.findFirst({
          where: eq(tags.id, primaryTagId),
          columns: { id: true, name: true },
        })
      : null;

    return {
      id: marker.id,
      title: marker.title,
      seconds: marker.seconds,
      endSeconds: marker.endSeconds,
      primaryTag: primaryTag ? { id: primaryTag.id, name: primaryTag.name } : null,
    };
  });

  // ─── PATCH /scenes/markers/:markerId ─────────────────────────
  app.patch("/scenes/markers/:markerId", async (request, reply) => {
    const { markerId } = request.params as { markerId: string };
    const body = request.body as {
      title?: string;
      seconds?: number;
      endSeconds?: number | null;
      primaryTagName?: string | null;
    };

    const existing = await db.query.sceneMarkers.findFirst({
      where: eq(sceneMarkers.id, markerId),
    });
    if (!existing) {
      reply.code(404);
      return { error: "Marker not found" };
    }

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) update.title = body.title.trim();
    if (body.seconds !== undefined) update.seconds = body.seconds;
    if (body.endSeconds !== undefined) update.endSeconds = body.endSeconds;

    if (body.primaryTagName !== undefined) {
      if (!body.primaryTagName?.trim()) {
        update.primaryTagId = null;
      } else {
        const [existingTag] = await db
          .select({ id: tags.id })
          .from(tags)
          .where(ilike(tags.name, body.primaryTagName.trim()))
          .limit(1);
        update.primaryTagId = existingTag?.id ?? (
          await db
            .insert(tags)
            .values({ name: body.primaryTagName.trim() })
            .returning({ id: tags.id })
        )[0].id;
      }
    }

    await db.update(sceneMarkers).set(update).where(eq(sceneMarkers.id, markerId));

    return { ok: true };
  });

  // ─── DELETE /scenes/markers/:markerId ─────────────────────────
  app.delete("/scenes/markers/:markerId", async (request, reply) => {
    const { markerId } = request.params as { markerId: string };

    const existing = await db.query.sceneMarkers.findFirst({
      where: eq(sceneMarkers.id, markerId),
    });
    if (!existing) {
      reply.code(404);
      return { error: "Marker not found" };
    }

    await db.delete(sceneMarkers).where(eq(sceneMarkers.id, markerId));
    return { ok: true };
  });

  // ─── POST /scenes/:id/play ─────────────────────────────────────
  app.post("/scenes/:id/play", async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await db.query.scenes.findFirst({
      where: eq(scenes.id, id),
      columns: { id: true },
    });

    if (!existing) {
      reply.code(404);
      return { error: "Scene not found" };
    }

    await db
      .update(scenes)
      .set({
        playCount: sql`${scenes.playCount} + 1`,
        lastPlayedAt: new Date(),
      })
      .where(eq(scenes.id, id));

    return { ok: true };
  });

  // ─── POST /scenes/:id/orgasm ──────────────────────────────────
  app.post("/scenes/:id/orgasm", async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await db.query.scenes.findFirst({
      where: eq(scenes.id, id),
      columns: { id: true },
    });

    if (!existing) {
      reply.code(404);
      return { error: "Scene not found" };
    }

    const [updated] = await db
      .update(scenes)
      .set({
        orgasmCount: sql`${scenes.orgasmCount} + 1`,
      })
      .where(eq(scenes.id, id))
      .returning({ orgasmCount: scenes.orgasmCount });

    return { ok: true, orgasmCount: updated.orgasmCount };
  });

  // ─── GET /studios (for filter dropdowns) ──────────────────────
  app.get("/studios", async () => {
    const rows = await db
      .select({ id: studios.id, name: studios.name })
      .from(studios)
      .orderBy(asc(studios.name));
    return { studios: rows };
  });

  // ─── GET /studios/:id ─────────────────────────────────────────
  app.get("/studios/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await db.query.studios.findFirst({
      where: eq(studios.id, id),
    });
    if (!row) {
      reply.code(404);
      return { error: "Studio not found" };
    }
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      imageUrl: row.imageUrl,
      parentId: row.parentId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
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

  // ─── POST /scenes/:id/thumbnail ──────────────────────────────
  app.post("/scenes/:id/thumbnail", async (request, reply) => {
    const { id } = request.params as { id: string };

    const scene = await db.query.scenes.findFirst({
      where: eq(scenes.id, id),
      columns: { id: true, filePath: true },
    });

    if (!scene) {
      reply.code(404);
      return { error: "Scene not found" };
    }

    const file = await request.file();
    if (!file) {
      reply.code(400);
      return { error: "No file uploaded" };
    }

    const buffer = await file.toBuffer();

    // Save custom thumbnail to generated dir (preserves auto-generated sidecar)
    const genDir = getGeneratedSceneDir(id);
    await mkdir(genDir, { recursive: true });
    const thumbPath = path.join(genDir, "thumbnail-custom.jpg");
    await writeFile(thumbPath, buffer);

    // Update the DB thumbnail path to the custom asset URL
    const assetUrl = `/assets/scenes/${id}/thumb-custom`;
    await db
      .update(scenes)
      .set({ thumbnailPath: assetUrl, updatedAt: new Date() })
      .where(eq(scenes.id, id));

    return { ok: true, thumbnailPath: assetUrl };
  });

  // ─── POST /scenes/:id/thumbnail/from-url ──────────────────────
  app.post("/scenes/:id/thumbnail/from-url", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { imageUrl } = request.body as { imageUrl: string };

    if (!imageUrl || !imageUrl.startsWith("http")) {
      reply.code(400);
      return { error: "Invalid image URL" };
    }

    const scene = await db.query.scenes.findFirst({
      where: eq(scenes.id, id),
      columns: { id: true },
    });

    if (!scene) {
      reply.code(404);
      return { error: "Scene not found" };
    }

    try {
      const res = await fetch(imageUrl);
      if (!res.ok) {
        reply.code(502);
        return { error: `Failed to fetch image: ${res.status}` };
      }

      const buffer = Buffer.from(await res.arrayBuffer());

      const genDir = getGeneratedSceneDir(id);
      await mkdir(genDir, { recursive: true });
      const thumbPath = path.join(genDir, "thumbnail-custom.jpg");
      await writeFile(thumbPath, buffer);

      const assetUrl = `/assets/scenes/${id}/thumb-custom`;
      await db
        .update(scenes)
        .set({ thumbnailPath: assetUrl, updatedAt: new Date() })
        .where(eq(scenes.id, id));

      return { ok: true, thumbnailPath: assetUrl };
    } catch (err) {
      reply.code(502);
      return { error: "Failed to download image" };
    }
  });

  // ─── POST /scenes/:id/thumbnail/from-frame ────────────────────
  app.post("/scenes/:id/thumbnail/from-frame", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { seconds?: number };
    const requestedSeconds = Number(body?.seconds);

    if (!Number.isFinite(requestedSeconds)) {
      reply.code(400);
      return { error: "Invalid frame time" };
    }

    const scene = await db.query.scenes.findFirst({
      where: eq(scenes.id, id),
      columns: { id: true, filePath: true, duration: true },
    });

    if (!scene || !scene.filePath || !existsSync(scene.filePath)) {
      reply.code(404);
      return { error: "Scene video file not found" };
    }

    const maxSeconds =
      scene.duration && scene.duration > 0 ? Math.max(0, scene.duration - 0.05) : null;
    const seconds =
      maxSeconds != null
        ? Math.min(Math.max(0, requestedSeconds), maxSeconds)
        : Math.max(0, requestedSeconds);

    try {
      const genDir = getGeneratedSceneDir(id);
      await mkdir(genDir, { recursive: true });
      const thumbPath = path.join(genDir, "thumbnail-custom.jpg");

      await runProcess("ffmpeg", [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        scene.filePath,
        "-ss",
        seconds.toFixed(3),
        "-frames:v",
        "1",
        "-q:v",
        "2",
        thumbPath,
      ]);

      const assetUrl = `/assets/scenes/${id}/thumb-custom`;
      await db
        .update(scenes)
        .set({ thumbnailPath: assetUrl, updatedAt: new Date() })
        .where(eq(scenes.id, id));

      return { ok: true, thumbnailPath: assetUrl, seconds };
    } catch {
      reply.code(500);
      return { error: "Failed to generate thumbnail from frame" };
    }
  });

  // ─── DELETE /scenes/:id/thumbnail ────────────────────────────
  app.delete("/scenes/:id/thumbnail", async (request, reply) => {
    const { id } = request.params as { id: string };

    const scene = await db.query.scenes.findFirst({
      where: eq(scenes.id, id),
      columns: { id: true, filePath: true },
    });

    if (!scene) {
      reply.code(404);
      return { error: "Scene not found" };
    }

    // Delete custom thumbnail file if it exists
    const customPath = path.join(getGeneratedSceneDir(id), "thumbnail-custom.jpg");
    try {
      const { unlink } = await import("node:fs/promises");
      if (existsSync(customPath)) await unlink(customPath);
    } catch {
      // non-fatal
    }

    // Revert to the standard generated thumbnail URL
    const defaultUrl = `/assets/scenes/${id}/thumb`;
    await db
      .update(scenes)
      .set({ thumbnailPath: defaultUrl, updatedAt: new Date() })
      .where(eq(scenes.id, id));

    return { ok: true, thumbnailPath: defaultUrl };
  });
}
