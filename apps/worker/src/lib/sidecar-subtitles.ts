import { copyFile, mkdir, readFile, stat, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import {
  discoverSubtitleSidecars,
  getSceneSubtitlesDir,
  normalizeSubtitleToVtt,
  type SidecarSubtitle,
} from "@obscura/media-core";
import { db, videoSubtitles } from "./db.js";

export type VideoEntityKind = "video_episode" | "video_movie";

/**
 * Discover sidecar subtitle files next to a video and store them as
 * normalized WebVTT in the video cache dir. Idempotent — re-running
 * for the same entity overwrites the cached file and the DB row.
 */
export async function ingestSidecarSubtitlesForVideoEntity(
  entityKind: VideoEntityKind,
  entityId: string,
  videoFilePath: string,
): Promise<number> {
  let sidecars: SidecarSubtitle[] = [];
  try {
    sidecars = await discoverSubtitleSidecars(videoFilePath);
  } catch {
    return 0;
  }

  if (sidecars.length === 0) return 0;

  const outDir = getSceneSubtitlesDir(entityId);
  await mkdir(outDir, { recursive: true });

  let ingested = 0;

  for (const sidecar of sidecars) {
    try {
      const info = await stat(sidecar.path);
      if (info.size === 0) continue;
    } catch {
      continue;
    }

    const basename = sanitize(path.basename(sidecar.path));
    const outPath = path.join(
      outDir,
      `sidecar-${sidecar.language}-${basename}.vtt`,
    );
    const preservesRaw = sidecar.format === "ass" || sidecar.format === "ssa";
    const sourceOutPath = preservesRaw
      ? path.join(
          outDir,
          `sidecar-${sidecar.language}-${basename}.${sidecar.format}`,
        )
      : null;

    try {
      if (sidecar.format === "vtt") {
        await copyFile(sidecar.path, outPath);
      } else {
        const content = await readFile(sidecar.path, "utf8");
        const vtt = normalizeSubtitleToVtt(content, sidecar.format);
        await writeFile(outPath, vtt, "utf8");
        if (sourceOutPath) {
          await writeFile(sourceOutPath, content, "utf8");
        }
      }
    } catch (err) {
      console.warn(
        `[sidecar-subtitles] failed to convert ${sidecar.path}: ${(err as Error).message}`,
      );
      continue;
    }

    // Upsert: one row per (entityType, entityId, language, source="sidecar").
    const existing = await db
      .select({
        id: videoSubtitles.id,
        storagePath: videoSubtitles.storagePath,
        sourcePath: videoSubtitles.sourcePath,
      })
      .from(videoSubtitles)
      .where(
        and(
          eq(videoSubtitles.entityType, entityKind),
          eq(videoSubtitles.entityId, entityId),
          eq(videoSubtitles.language, sidecar.language),
          eq(videoSubtitles.source, "sidecar"),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0]!;
      if (row.storagePath && row.storagePath !== outPath) {
        await unlink(row.storagePath).catch(() => undefined);
      }
      if (row.sourcePath && row.sourcePath !== sourceOutPath) {
        await unlink(row.sourcePath).catch(() => undefined);
      }
      await db
        .update(videoSubtitles)
        .set({
          storagePath: outPath,
          label: sidecar.label,
          format: "vtt",
          sourceFormat: sidecar.format,
          sourcePath: sourceOutPath,
        })
        .where(eq(videoSubtitles.id, row.id));
    } else {
      await db.insert(videoSubtitles).values({
        entityType: entityKind,
        entityId,
        language: sidecar.language,
        label: sidecar.label,
        format: "vtt",
        source: "sidecar",
        storagePath: outPath,
        sourceFormat: sidecar.format,
        sourcePath: sourceOutPath,
        isDefault: false,
      });
    }

    ingested++;
  }

  return ingested;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}
