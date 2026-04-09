import type { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import {
  eq,
  ilike,
  or,
  desc,
  asc,
  sql,
  inArray,
  and,
  ne,
  isNotNull,
  isNull,
  gte,
  lte,
  lt,
  gt,
} from "drizzle-orm";
import { existsSync } from "node:fs";
import { writeFile, mkdir, unlink, rm } from "node:fs/promises";
import path from "node:path";
import { formatDuration, formatFileSize, getResolutionLabel } from "@obscura/contracts";
import {
  writeNfo,
  getSidecarPaths,
  getGeneratedSceneDir,
  getGeneratedStudioDir,
  getGeneratedTagDir,
  runProcess,
} from "@obscura/media-core";

const { scenes, scenePerformers, sceneTags, sceneMarkers, performers, tags, studios, images, imageTags } =
  schema;

export async function scenesRoutes(app: FastifyInstance) {
  // ─── GET /scenes ──────────────────────────────────────────────
  app.get("/scenes", async (request) => {
    const query = request.query as {
      search?: string;
      sort?: string;
      order?: string;
      tag?: string | string[];
      performer?: string | string[];
      studio?: string | string[];
      resolution?: string | string[];
      limit?: string;
      offset?: string;
      /** When `off`, exclude NSFW scenes (same contract as search). */
      nsfw?: string;
      ratingMin?: string;
      ratingMax?: string;
      dateFrom?: string;
      dateTo?: string;
      durationMin?: string;
      durationMax?: string;
      organized?: string;
      interactive?: string;
      hasFile?: string;
      played?: string;
      codec?: string | string[];
    };

    const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;
    const allowedCodecs = new Set(["h264", "hevc", "av1", "vp9", "mpeg4", "prores", "wmv", "vp8"]);

    const limit = Math.min(Number(query.limit) || 50, 100);
    const offset = Number(query.offset) || 0;

    // Build WHERE conditions
    const conditions = [];

    if (query.nsfw === "off") {
      conditions.push(ne(scenes.isNsfw, true));
    }

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

    const resValues = Array.isArray(query.resolution) ? query.resolution : query.resolution ? [query.resolution] : [];
    if (resValues.length > 0) {
      const resMap: Record<string, [number, number]> = {
        "4K": [2160, 99999],
        "1080p": [1080, 2159],
        "720p": [720, 1079],
        "480p": [0, 719],
      };
      const resConditions = resValues
        .map((r) => resMap[r])
        .filter(Boolean)
        .map((range) => and(
          sql`${scenes.height} >= ${range[0]}`,
          sql`${scenes.height} <= ${range[1]}`,
        )!);
      if (resConditions.length === 1) {
        conditions.push(resConditions[0]);
      } else if (resConditions.length > 1) {
        conditions.push(or(...resConditions)!);
      }
    }

    const studioIds = Array.isArray(query.studio) ? query.studio : query.studio ? [query.studio] : [];
    if (studioIds.length === 1) {
      conditions.push(eq(scenes.studioId, studioIds[0]));
    } else if (studioIds.length > 1) {
      conditions.push(inArray(scenes.studioId, studioIds));
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

    const ratingMin = query.ratingMin !== undefined ? Number(query.ratingMin) : NaN;
    if (Number.isInteger(ratingMin) && ratingMin >= 1 && ratingMin <= 5) {
      conditions.push(and(isNotNull(scenes.rating), gte(scenes.rating, ratingMin))!);
    }
    const ratingMax = query.ratingMax !== undefined ? Number(query.ratingMax) : NaN;
    if (Number.isInteger(ratingMax) && ratingMax >= 1 && ratingMax <= 5) {
      conditions.push(and(isNotNull(scenes.rating), lte(scenes.rating, ratingMax))!);
    }

    if (query.dateFrom && isoDateRe.test(query.dateFrom)) {
      conditions.push(and(isNotNull(scenes.date), gte(scenes.date, query.dateFrom))!);
    }
    if (query.dateTo && isoDateRe.test(query.dateTo)) {
      conditions.push(and(isNotNull(scenes.date), lte(scenes.date, query.dateTo))!);
    }

    const durationMin = query.durationMin !== undefined ? Number(query.durationMin) : NaN;
    if (Number.isFinite(durationMin) && durationMin >= 0) {
      conditions.push(and(isNotNull(scenes.duration), gte(scenes.duration, durationMin))!);
    }
    const durationMax = query.durationMax !== undefined ? Number(query.durationMax) : NaN;
    if (Number.isFinite(durationMax) && durationMax > 0) {
      conditions.push(and(isNotNull(scenes.duration), lt(scenes.duration, durationMax))!);
    }

    if (query.organized === "true") {
      conditions.push(eq(scenes.organized, true));
    }
    if (query.organized === "false") {
      conditions.push(eq(scenes.organized, false));
    }
    if (query.interactive === "true") {
      conditions.push(eq(scenes.interactive, true));
    }
    if (query.interactive === "false") {
      conditions.push(eq(scenes.interactive, false));
    }
    if (query.hasFile === "true") {
      conditions.push(isNotNull(scenes.filePath));
    }
    if (query.hasFile === "false") {
      conditions.push(isNull(scenes.filePath));
    }
    if (query.played === "true") {
      conditions.push(or(gt(scenes.playCount, 0), isNotNull(scenes.lastPlayedAt))!);
    }
    if (query.played === "false") {
      conditions.push(and(eq(scenes.playCount, 0), isNull(scenes.lastPlayedAt))!);
    }

    const codecValues = (Array.isArray(query.codec) ? query.codec : query.codec ? [query.codec] : [])
      .map((c) => c.toLowerCase().trim())
      .filter((c) => allowedCodecs.has(c));
    if (codecValues.length === 1) {
      conditions.push(ilike(scenes.codec, `%${codecValues[0]}%`));
    } else if (codecValues.length > 1) {
      conditions.push(or(...codecValues.map((c) => ilike(scenes.codec, `%${c}%`)))!);
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
              performerImagePath: performers.imagePath,
              performerIsNsfw: performers.isNsfw,
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
              tagIsNsfw: tags.isNsfw,
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
      isNsfw: scene.isNsfw,
      duration: scene.duration,
      durationFormatted: formatDuration(scene.duration),
      resolution: getResolutionLabel(scene.height),
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
        .map((p) => ({ id: p.performerId, name: p.performerName, imagePath: p.performerImagePath, isNsfw: p.performerIsNsfw })),
      tags: tagJoins
        .filter((t) => t.sceneId === scene.id)
        .map((t) => ({ id: t.tagId, name: t.tagName, isNsfw: t.tagIsNsfw })),
      createdAt: scene.createdAt,
      updatedAt: scene.updatedAt,
    }));

    return {
      scenes: result,
      total: Number(countResult.count),
      limit,
      offset,
    };
  });

  // ─── GET /scenes/stats ────────────────────────────────────────
  app.get("/scenes/stats", async (request) => {
    const query = request.query as { nsfw?: string };
    const sfwOnly = query.nsfw === "off" ? ne(scenes.isNsfw, true) : undefined;

    const [stats] = await db
      .select({
        totalScenes: sql<number>`count(*)`,
        totalDuration: sql<number>`coalesce(sum(${scenes.duration}), 0)`,
        totalSize: sql<number>`coalesce(sum(${scenes.fileSize}), 0)`,
        totalPlays: sql<number>`coalesce(sum(${scenes.playCount}), 0)`,
      })
      .from(scenes)
      .where(sfwOnly);

    const recentWhere = sfwOnly
      ? and(sfwOnly, sql`${scenes.createdAt} > now() - interval '7 days'`)
      : sql`${scenes.createdAt} > now() - interval '7 days'`;

    // Scenes added in last 7 days
    const [recentStats] = await db
      .select({
        recentCount: sql<number>`count(*)`,
      })
      .from(scenes)
      .where(recentWhere);

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
      return { error: "Video not found" };
    }

    return {
      id: scene.id,
      title: scene.title,
      details: scene.details,
      date: scene.date,
      rating: scene.rating,
      url: scene.url,
      organized: scene.organized,
      isNsfw: scene.isNsfw,
      interactive: scene.interactive,
      duration: scene.duration,
      durationFormatted: formatDuration(scene.duration),
      resolution: getResolutionLabel(scene.height),
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
        imagePath: sp.performer.imagePath,
        favorite: sp.performer.favorite,
        isNsfw: sp.performer.isNsfw,
      })),
      tags: scene.sceneTags.map((st) => ({
        id: st.tag.id,
        name: st.tag.name,
        isNsfw: st.tag.isNsfw,
      })),
      markers: scene.markers.map((m) => ({
        id: m.id,
        title: m.title,
        seconds: m.seconds,
        endSeconds: m.endSeconds,
        primaryTag: m.primaryTag
          ? { id: m.primaryTag.id, name: m.primaryTag.name, isNsfw: m.primaryTag.isNsfw }
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
      isNsfw?: boolean;
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
      return { error: "Video not found" };
    }

    await db.transaction(async (tx) => {
      const sceneUpdate: Record<string, unknown> = { updatedAt: new Date() };

      if (body.title !== undefined) sceneUpdate.title = body.title;
      if (body.details !== undefined) sceneUpdate.details = body.details;
      if (body.date !== undefined) sceneUpdate.date = body.date;
      if (body.rating !== undefined) sceneUpdate.rating = body.rating;
      if (body.url !== undefined) sceneUpdate.url = body.url;
      if (body.organized !== undefined) sceneUpdate.organized = body.organized;
      if (body.isNsfw !== undefined) sceneUpdate.isNsfw = body.isNsfw;
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

  // ─── DELETE /scenes/:id ───────────────────────────────────────
  app.delete("/scenes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { deleteFile?: string };
    const deleteFile = query.deleteFile === "true";

    const existing = await db.query.scenes.findFirst({
      where: eq(scenes.id, id),
      columns: { id: true, filePath: true },
    });

    if (!existing) {
      reply.code(404);
      return { error: "Video not found" };
    }

    // Delete scene record (cascades handle scenePerformers, sceneTags, sceneMarkers)
    await db.delete(scenes).where(eq(scenes.id, id));

    // Clean up generated files (thumbnails, sprites, HLS cache, etc.)
    const genDir = getGeneratedSceneDir(id);
    try {
      if (existsSync(genDir)) await rm(genDir, { recursive: true });
    } catch {
      // non-fatal
    }

    // Optionally delete the source video file from disk
    if (deleteFile && existing.filePath) {
      try {
        if (existsSync(existing.filePath)) await unlink(existing.filePath);
      } catch {
        // non-fatal
      }
    }

    return { ok: true };
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
      return { error: "Video not found" };
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
      return { error: "Video not found" };
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
      return { error: "Video not found" };
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

  // ─── GET /studios ────────────────────────────────────────────
  app.get("/studios", async (request) => {
    const q = request.query as { nsfw?: string };
    const sfwOnly = q.nsfw === "off";

    const rows = await db
      .select()
      .from(studios)
      .where(sfwOnly ? ne(studios.isNsfw, true) : undefined)
      .orderBy(asc(studios.name));

    let sfwSceneByStudio = new Map<string, number>();
    if (sfwOnly) {
      const agg = await db
        .select({
          studioId: scenes.studioId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(scenes)
        .where(and(isNotNull(scenes.studioId), ne(scenes.isNsfw, true)))
        .groupBy(scenes.studioId);
      sfwSceneByStudio = new Map(
        agg.filter((r) => r.studioId != null).map((r) => [r.studioId!, Number(r.cnt)]),
      );
    }

    return {
      studios: rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        aliases: r.aliases,
        url: r.url,
        parentId: r.parentId,
        imageUrl: r.imageUrl,
        imagePath: r.imagePath,
        favorite: r.favorite,
        rating: r.rating,
        isNsfw: r.isNsfw,
        sceneCount: sfwOnly ? (sfwSceneByStudio.get(r.id) ?? 0) : r.sceneCount,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    };
  });

  // ─── GET /studios/:id ─────────────────────────────────────────
  app.get("/studios/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as { nsfw?: string };
    const sfwOnly = q.nsfw === "off";

    const row = await db.query.studios.findFirst({
      where: eq(studios.id, id),
      with: {
        parent: { columns: { id: true, name: true, imagePath: true, imageUrl: true } },
        children: {
          columns: { id: true, name: true, imagePath: true, imageUrl: true, sceneCount: true, isNsfw: true },
          orderBy: asc(studios.name),
        },
      },
    });
    if (!row) {
      reply.code(404);
      return { error: "Studio not found" };
    }

    if (sfwOnly && row.isNsfw) {
      reply.code(404);
      return { error: "Studio not found" };
    }

    const studioIdsForCounts = [row.id, ...row.children.map((c) => c.id)];
    let sfwSceneByStudio = new Map<string, number>();
    if (sfwOnly) {
      const agg = await db
        .select({
          studioId: scenes.studioId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(scenes)
        .where(
          and(
            inArray(scenes.studioId, studioIdsForCounts),
            isNotNull(scenes.studioId),
            ne(scenes.isNsfw, true),
          ),
        )
        .groupBy(scenes.studioId);
      sfwSceneByStudio = new Map(
        agg.filter((r) => r.studioId != null).map((r) => [r.studioId!, Number(r.cnt)]),
      );
    }

    const sceneCount = sfwOnly ? (sfwSceneByStudio.get(row.id) ?? 0) : row.sceneCount;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      aliases: row.aliases,
      url: row.url,
      parentId: row.parentId,
      parent: row.parent ? { id: row.parent.id, name: row.parent.name, imagePath: row.parent.imagePath, imageUrl: row.parent.imageUrl } : null,
      childStudios: row.children
        .filter((c) => !sfwOnly || !c.isNsfw)
        .map((c) => ({
          id: c.id,
          name: c.name,
          imagePath: c.imagePath,
          imageUrl: c.imageUrl,
          sceneCount: sfwOnly ? (sfwSceneByStudio.get(c.id) ?? 0) : c.sceneCount,
        })),
      imageUrl: row.imageUrl,
      imagePath: row.imagePath,
      favorite: row.favorite,
      rating: row.rating,
      isNsfw: row.isNsfw,
      sceneCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });

  // ─── PATCH /studios/:id ───────────────────────────────────────
  app.patch("/studios/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      description?: string | null;
      aliases?: string | null;
      url?: string | null;
      imageUrl?: string | null;
      parentId?: string | null;
      favorite?: boolean;
      rating?: number | null;
      isNsfw?: boolean;
    };

    const [existing] = await db.select().from(studios).where(eq(studios.id, id)).limit(1);
    if (!existing) { reply.code(404); return { error: "Studio not found" }; }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.aliases !== undefined) updates.aliases = body.aliases?.trim() || null;
    if (body.url !== undefined) updates.url = body.url?.trim() || null;
    if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl?.trim() || null;
    if (body.parentId !== undefined) updates.parentId = body.parentId || null;
    if (body.favorite !== undefined) updates.favorite = body.favorite;
    if (body.rating !== undefined) updates.rating = body.rating;
    if (body.isNsfw !== undefined) updates.isNsfw = body.isNsfw;

    await db.update(studios).set(updates).where(eq(studios.id, id));
    const [updated] = await db.select().from(studios).where(eq(studios.id, id)).limit(1);
    return {
      id: updated.id, name: updated.name, description: updated.description, aliases: updated.aliases,
      url: updated.url, parentId: updated.parentId, imageUrl: updated.imageUrl, imagePath: updated.imagePath,
      favorite: updated.favorite, rating: updated.rating, isNsfw: updated.isNsfw, sceneCount: updated.sceneCount,
      createdAt: updated.createdAt, updatedAt: updated.updatedAt,
    };
  });

  // ─── POST /studios ──────────────────────────────────────────
  app.post("/studios", async (request, reply) => {
    const body = request.body as { name: string; description?: string; aliases?: string; url?: string; parentId?: string };
    if (!body.name?.trim()) { reply.code(400); return { error: "name is required" }; }
    const [created] = await db.insert(studios).values({
      name: body.name.trim(), description: body.description?.trim() || null,
      aliases: body.aliases?.trim() || null, url: body.url?.trim() || null,
      parentId: body.parentId || null,
    }).returning();
    return reply.code(201).send({ ok: true, id: created.id });
  });

  // ─── POST /studios/find-or-create ────────────────────────────
  // Used when applying scraped parent studios — finds by name or creates.
  // Accepts optional scrape enrichment data (url, imageUrl) and a parentName
  // with loop-prevention via a visited set.
  app.post("/studios/find-or-create", async (request, reply) => {
    const body = request.body as {
      name: string;
      url?: string | null;
      imageUrl?: string | null;
      parentName?: string | null;
      parentUrl?: string | null;
      parentImageUrl?: string | null;
      scrapedEndpointId?: string | null;
      scrapedRemoteId?: string | null;
    };
    if (!body.name?.trim()) { reply.code(400); return { error: "name is required" }; }

    // Loop-prevention: track visited studio names during recursive parent resolution
    const visited = new Set<string>();

    const resolve = async (
      name: string,
      data?: { url?: string | null; imageUrl?: string | null; parentName?: string | null; parentUrl?: string | null; parentImageUrl?: string | null },
    ): Promise<string> => {
      const key = name.toLowerCase();
      if (visited.has(key)) {
        // Circular reference — find or create without parent to break the loop
        const [existing] = await db.select({ id: studios.id }).from(studios).where(ilike(studios.name, name)).limit(1);
        if (existing) return existing.id;
        const [created] = await db.insert(studios).values({ name }).returning({ id: studios.id });
        return created.id;
      }
      visited.add(key);

      const [existing] = await db
        .select({ id: studios.id, url: studios.url, imageUrl: studios.imageUrl, parentId: studios.parentId })
        .from(studios).where(ilike(studios.name, name)).limit(1);

      if (existing) {
        const backfill: Record<string, unknown> = {};
        if (!existing.url && data?.url) backfill.url = data.url;
        if (!existing.imageUrl && data?.imageUrl) backfill.imageUrl = data.imageUrl;
        if (!existing.parentId && data?.parentName) {
          backfill.parentId = await resolve(data.parentName, { url: data.parentUrl, imageUrl: data.parentImageUrl });
        }
        if (Object.keys(backfill).length > 0) {
          await db.update(studios).set({ ...backfill, updatedAt: new Date() }).where(eq(studios.id, existing.id));
        }
        return existing.id;
      }

      let parentId: string | null = null;
      if (data?.parentName) {
        parentId = await resolve(data.parentName, { url: data.parentUrl, imageUrl: data.parentImageUrl });
      }

      const [created] = await db.insert(studios).values({
        name,
        url: data?.url?.trim() || null,
        imageUrl: data?.imageUrl?.trim() || null,
        parentId,
      }).returning({ id: studios.id });
      return created.id;
    };

    const studioId = await resolve(body.name.trim(), {
      url: body.url,
      imageUrl: body.imageUrl,
      parentName: body.parentName?.trim() || null,
      parentUrl: body.parentUrl,
      parentImageUrl: body.parentImageUrl,
    });

    return { ok: true, id: studioId };
  });

  // ─── DELETE /studios/:id ────────────────────────────────────
  app.delete("/studios/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [deleted] = await db.delete(studios).where(eq(studios.id, id)).returning({ id: studios.id });
    if (!deleted) { reply.code(404); return { error: "Studio not found" }; }
    // Cleanup image
    try { const dir = getGeneratedStudioDir(id); if (existsSync(dir)) await rm(dir, { recursive: true }); } catch { /* non-fatal */ }
    return { ok: true };
  });

  // ─── PATCH /studios/:id/favorite ────────────────────────────
  app.patch("/studios/:id/favorite", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { favorite } = request.body as { favorite: boolean };
    const [existing] = await db.select({ id: studios.id }).from(studios).where(eq(studios.id, id)).limit(1);
    if (!existing) { reply.code(404); return { error: "Studio not found" }; }
    await db.update(studios).set({ favorite, updatedAt: new Date() }).where(eq(studios.id, id));
    return { ok: true, favorite };
  });

  // ─── PATCH /studios/:id/rating ──────────────────────────────
  app.patch("/studios/:id/rating", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rating } = request.body as { rating: number | null };
    const [existing] = await db.select({ id: studios.id }).from(studios).where(eq(studios.id, id)).limit(1);
    if (!existing) { reply.code(404); return { error: "Studio not found" }; }
    await db.update(studios).set({ rating, updatedAt: new Date() }).where(eq(studios.id, id));
    return { ok: true, rating };
  });

  // ─── POST /studios/:id/image (multipart upload) ─────────────
  app.post("/studios/:id/image", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [existing] = await db.select({ id: studios.id }).from(studios).where(eq(studios.id, id)).limit(1);
    if (!existing) { reply.code(404); return { error: "Studio not found" }; }
    const file = await request.file();
    if (!file) { reply.code(400); return { error: "No file uploaded" }; }
    const buffer = await file.toBuffer();
    const genDir = getGeneratedStudioDir(id);
    await mkdir(genDir, { recursive: true });
    await writeFile(path.join(genDir, "image.jpg"), buffer);
    const assetUrl = `/assets/studios/${id}/image`;
    await db.update(studios).set({ imagePath: assetUrl, updatedAt: new Date() }).where(eq(studios.id, id));
    return { ok: true, imagePath: assetUrl };
  });

  // ─── POST /studios/:id/image/from-url ───────────────────────
  app.post("/studios/:id/image/from-url", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { imageUrl } = request.body as { imageUrl: string };
    if (!imageUrl || (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:image/"))) {
      reply.code(400); return { error: "Invalid image URL" };
    }
    const [existing] = await db.select({ id: studios.id }).from(studios).where(eq(studios.id, id)).limit(1);
    if (!existing) { reply.code(404); return { error: "Studio not found" }; }
    try {
      let buffer: Buffer;
      let contentType = "image/jpeg";
      if (imageUrl.startsWith("data:image/")) {
        const match = imageUrl.match(/^data:(image\/\w+);/);
        if (match) contentType = match[1];
        const base64Data = imageUrl.split(",")[1];
        if (!base64Data) { reply.code(400); return { error: "Invalid data URL" }; }
        buffer = Buffer.from(base64Data, "base64");
      } else {
        const res = await fetch(imageUrl);
        if (!res.ok) { reply.code(502); return { error: `Failed to fetch image: ${res.status}` }; }
        contentType = res.headers.get("content-type") ?? "image/jpeg";
        buffer = Buffer.from(await res.arrayBuffer());
      }
      // Detect format by content: SVG starts with < or <?xml
      const head = buffer.subarray(0, 100).toString("utf8").trim();
      if (head.startsWith("<") || head.startsWith("<?xml")) contentType = "image/svg+xml";
      const ext = contentType.includes("svg") ? "svg" : contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const genDir = getGeneratedStudioDir(id);
      await mkdir(genDir, { recursive: true });
      // Remove old image files of any extension
      for (const old of ["jpg", "png", "svg", "webp"]) {
        const oldPath = path.join(genDir, `image.${old}`);
        if (existsSync(oldPath)) try { await unlink(oldPath); } catch { /* ok */ }
      }
      await writeFile(path.join(genDir, `image.${ext}`), buffer);
      const assetUrl = `/assets/studios/${id}/image`;
      await db.update(studios).set({ imagePath: assetUrl, imageUrl, updatedAt: new Date() }).where(eq(studios.id, id));
      return { ok: true, imagePath: assetUrl };
    } catch { reply.code(502); return { error: "Failed to download image" }; }
  });

  // ─── DELETE /studios/:id/image ──────────────────────────────
  app.delete("/studios/:id/image", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [existing] = await db.select({ id: studios.id }).from(studios).where(eq(studios.id, id)).limit(1);
    if (!existing) { reply.code(404); return { error: "Studio not found" }; }
    try { const p = path.join(getGeneratedStudioDir(id), "image.jpg"); if (existsSync(p)) await unlink(p); } catch { /* non-fatal */ }
    await db.update(studios).set({ imagePath: null, imageUrl: null, updatedAt: new Date() }).where(eq(studios.id, id));
    return { ok: true };
  });

  // ─── GET /tags ───────────────────────────────────────────────
  app.get("/tags", async (request) => {
    const q = request.query as { nsfw?: string };
    const sfwOnly = q.nsfw === "off";

    if (!sfwOnly) {
      const rows = await db.select().from(tags).orderBy(desc(tags.sceneCount));

      const imageTagCounts = await db
        .select({
          tagId: imageTags.tagId,
          count: sql<number>`count(*)`,
        })
        .from(imageTags)
        .groupBy(imageTags.tagId);
      const imageCountMap = new Map(imageTagCounts.map((r) => [r.tagId, Number(r.count)]));

      return {
        tags: rows.map((tag) => ({
          id: tag.id,
          name: tag.name,
          description: tag.description,
          aliases: tag.aliases,
          imagePath: tag.imagePath,
          favorite: tag.favorite,
          rating: tag.rating,
          isNsfw: tag.isNsfw,
          sceneCount: tag.sceneCount,
          imageCount: imageCountMap.get(tag.id) ?? 0,
        })),
      };
    }

    const [sceneAgg, imageAgg] = await Promise.all([
      db
        .select({
          tagId: sceneTags.tagId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(sceneTags)
        .innerJoin(scenes, eq(scenes.id, sceneTags.sceneId))
        .where(ne(scenes.isNsfw, true))
        .groupBy(sceneTags.tagId),
      db
        .select({
          tagId: imageTags.tagId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(imageTags)
        .innerJoin(images, eq(images.id, imageTags.imageId))
        .where(ne(images.isNsfw, true))
        .groupBy(imageTags.tagId),
    ]);

    const sceneMap = new Map(sceneAgg.map((r) => [r.tagId, Number(r.cnt)]));
    const imageMap = new Map(imageAgg.map((r) => [r.tagId, Number(r.cnt)]));

    const rows = await db.select().from(tags).where(ne(tags.isNsfw, true));

    const mapped = rows.map((tag) => ({
      id: tag.id,
      name: tag.name,
      description: tag.description,
      aliases: tag.aliases,
      imagePath: tag.imagePath,
      favorite: tag.favorite,
      rating: tag.rating,
      isNsfw: tag.isNsfw,
      sceneCount: sceneMap.get(tag.id) ?? 0,
      imageCount: imageMap.get(tag.id) ?? 0,
    }));

    mapped.sort((a, b) => b.sceneCount - a.sceneCount);

    return { tags: mapped };
  });

  // ─── GET /tags/:id ───────────────────────────────────────────
  app.get("/tags/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as { nsfw?: string };
    const sfwOnly = q.nsfw === "off";

    const row = await db.query.tags.findFirst({ where: eq(tags.id, id) });
    if (!row) {
      reply.code(404);
      return { error: "Tag not found" };
    }

    let sceneCount = row.sceneCount;
    if (sfwOnly) {
      const [cnt] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(sceneTags)
        .innerJoin(scenes, eq(scenes.id, sceneTags.sceneId))
        .where(and(eq(sceneTags.tagId, id), ne(scenes.isNsfw, true)));
      sceneCount = Number(cnt?.n ?? 0);
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      aliases: row.aliases,
      parentId: row.parentId,
      imageUrl: row.imageUrl,
      imagePath: row.imagePath,
      favorite: row.favorite,
      rating: row.rating,
      isNsfw: row.isNsfw,
      ignoreAutoTag: row.ignoreAutoTag,
      sceneCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });

  // ─── PATCH /tags/:id ──────────────────────────────────────────
  app.patch("/tags/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string; description?: string | null; aliases?: string | null;
      imageUrl?: string | null; parentId?: string | null;
      favorite?: boolean; rating?: number | null; ignoreAutoTag?: boolean; isNsfw?: boolean;
    };
    const [existing] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
    if (!existing) { reply.code(404); return { error: "Tag not found" }; }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.aliases !== undefined) updates.aliases = body.aliases?.trim() || null;
    if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl?.trim() || null;
    if (body.parentId !== undefined) updates.parentId = body.parentId || null;
    if (body.favorite !== undefined) updates.favorite = body.favorite;
    if (body.rating !== undefined) updates.rating = body.rating;
    if (body.ignoreAutoTag !== undefined) updates.ignoreAutoTag = body.ignoreAutoTag;
    if (body.isNsfw !== undefined) updates.isNsfw = body.isNsfw;

    await db.update(tags).set(updates).where(eq(tags.id, id));
    const [updated] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
    return {
      id: updated.id, name: updated.name, description: updated.description, aliases: updated.aliases,
      parentId: updated.parentId, imageUrl: updated.imageUrl, imagePath: updated.imagePath,
      favorite: updated.favorite, rating: updated.rating, isNsfw: updated.isNsfw, ignoreAutoTag: updated.ignoreAutoTag,
      sceneCount: updated.sceneCount, createdAt: updated.createdAt, updatedAt: updated.updatedAt,
    };
  });

  // ─── POST /tags ─────────────────────────────────────────────
  app.post("/tags", async (request, reply) => {
    const body = request.body as { name: string; description?: string; aliases?: string };
    if (!body.name?.trim()) { reply.code(400); return { error: "name is required" }; }
    const [created] = await db.insert(tags).values({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      aliases: body.aliases?.trim() || null,
    }).returning();
    return reply.code(201).send({ ok: true, id: created.id });
  });

  // ─── DELETE /tags/:id ───────────────────────────────────────
  app.delete("/tags/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [deleted] = await db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
    if (!deleted) { reply.code(404); return { error: "Tag not found" }; }
    try { const dir = getGeneratedTagDir(id); if (existsSync(dir)) await rm(dir, { recursive: true }); } catch { /* non-fatal */ }
    return { ok: true };
  });

  // ─── PATCH /tags/:id/favorite ───────────────────────────────
  app.patch("/tags/:id/favorite", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { favorite } = request.body as { favorite: boolean };
    const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).limit(1);
    if (!existing) { reply.code(404); return { error: "Tag not found" }; }
    await db.update(tags).set({ favorite, updatedAt: new Date() }).where(eq(tags.id, id));
    return { ok: true, favorite };
  });

  // ─── PATCH /tags/:id/rating ─────────────────────────────────
  app.patch("/tags/:id/rating", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rating } = request.body as { rating: number | null };
    const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).limit(1);
    if (!existing) { reply.code(404); return { error: "Tag not found" }; }
    await db.update(tags).set({ rating, updatedAt: new Date() }).where(eq(tags.id, id));
    return { ok: true, rating };
  });

  // ─── POST /tags/:id/image (multipart upload) ────────────────
  app.post("/tags/:id/image", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).limit(1);
    if (!existing) { reply.code(404); return { error: "Tag not found" }; }
    const file = await request.file();
    if (!file) { reply.code(400); return { error: "No file uploaded" }; }
    const buffer = await file.toBuffer();
    const genDir = getGeneratedTagDir(id);
    await mkdir(genDir, { recursive: true });
    await writeFile(path.join(genDir, "image.jpg"), buffer);
    const assetUrl = `/assets/tags/${id}/image`;
    await db.update(tags).set({ imagePath: assetUrl, updatedAt: new Date() }).where(eq(tags.id, id));
    return { ok: true, imagePath: assetUrl };
  });

  // ─── POST /tags/:id/image/from-url ──────────────────────────
  app.post("/tags/:id/image/from-url", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { imageUrl } = request.body as { imageUrl: string };
    if (!imageUrl || (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:image/"))) {
      reply.code(400); return { error: "Invalid image URL" };
    }
    const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).limit(1);
    if (!existing) { reply.code(404); return { error: "Tag not found" }; }
    try {
      let buffer: Buffer;
      let contentType = "image/jpeg";
      if (imageUrl.startsWith("data:image/")) {
        const match = imageUrl.match(/^data:(image\/\w+);/);
        if (match) contentType = match[1];
        const base64Data = imageUrl.split(",")[1];
        if (!base64Data) { reply.code(400); return { error: "Invalid data URL" }; }
        buffer = Buffer.from(base64Data, "base64");
      } else {
        const res = await fetch(imageUrl);
        if (!res.ok) { reply.code(502); return { error: `Failed to fetch image: ${res.status}` }; }
        contentType = res.headers.get("content-type") ?? "image/jpeg";
        buffer = Buffer.from(await res.arrayBuffer());
      }
      const head = buffer.subarray(0, 100).toString("utf8").trim();
      if (head.startsWith("<") || head.startsWith("<?xml")) contentType = "image/svg+xml";
      const ext = contentType.includes("svg") ? "svg" : contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const genDir = getGeneratedTagDir(id);
      await mkdir(genDir, { recursive: true });
      for (const old of ["jpg", "png", "svg", "webp"]) {
        const oldPath = path.join(genDir, `image.${old}`);
        if (existsSync(oldPath)) try { await unlink(oldPath); } catch { /* ok */ }
      }
      await writeFile(path.join(genDir, `image.${ext}`), buffer);
      const assetUrl = `/assets/tags/${id}/image`;
      await db.update(tags).set({ imagePath: assetUrl, imageUrl, updatedAt: new Date() }).where(eq(tags.id, id));
      return { ok: true, imagePath: assetUrl };
    } catch { reply.code(502); return { error: "Failed to download image" }; }
  });

  // ─── DELETE /tags/:id/image ─────────────────────────────────
  app.delete("/tags/:id/image", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).limit(1);
    if (!existing) { reply.code(404); return { error: "Tag not found" }; }
    try { const p = path.join(getGeneratedTagDir(id), "image.jpg"); if (existsSync(p)) await unlink(p); } catch { /* non-fatal */ }
    await db.update(tags).set({ imagePath: null, imageUrl: null, updatedAt: new Date() }).where(eq(tags.id, id));
    return { ok: true };
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
      return { error: "Video not found" };
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
      .set({ thumbnailPath: assetUrl, cardThumbnailPath: null, updatedAt: new Date() })
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
      return { error: "Video not found" };
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
        .set({ thumbnailPath: assetUrl, cardThumbnailPath: null, updatedAt: new Date() })
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
      return { error: "Video file not found" };
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
        .set({ thumbnailPath: assetUrl, cardThumbnailPath: null, updatedAt: new Date() })
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
      return { error: "Video not found" };
    }

    // Delete custom thumbnail file if it exists
    const customPath = path.join(getGeneratedSceneDir(id), "thumbnail-custom.jpg");
    try {
      const { unlink } = await import("node:fs/promises");
      if (existsSync(customPath)) await unlink(customPath);
    } catch {
      // non-fatal
    }

    // Revert to the standard generated thumbnail/card URLs
    const defaultUrl = `/assets/scenes/${id}/thumb`;
    const defaultCardUrl = `/assets/scenes/${id}/card`;
    await db
      .update(scenes)
      .set({ thumbnailPath: defaultUrl, cardThumbnailPath: defaultCardUrl, updatedAt: new Date() })
      .where(eq(scenes.id, id));

    return { ok: true, thumbnailPath: defaultUrl };
  });
}
