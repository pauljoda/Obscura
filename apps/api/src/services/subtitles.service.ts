import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, eq } from "drizzle-orm";
import type { MultipartFile } from "@fastify/multipart";
import {
  getSceneSubtitlesDir,
  getSubtitleFormat,
  normalizeSubtitleToVtt,
  parseVttCues,
  type SubtitleFormat,
} from "@obscura/media-core";
import type { SceneSubtitleTrackDto, SubtitleCueDto } from "@obscura/contracts";
import { AppError } from "../plugins/error-handler";
import { db, schema } from "../db";
import { enqueueQueueJob } from "../lib/job-enqueue";

const { scenes, sceneSubtitles } = schema;

function trackToDto(row: typeof sceneSubtitles.$inferSelect): SceneSubtitleTrackDto {
  const sourceFormat = (row.sourceFormat ?? "vtt") as SceneSubtitleTrackDto["sourceFormat"];
  const hasRawSource =
    (sourceFormat === "ass" || sourceFormat === "ssa") && !!row.sourcePath;
  return {
    id: row.id,
    sceneId: row.sceneId,
    language: row.language,
    label: row.label,
    format: "vtt",
    source: row.source as SceneSubtitleTrackDto["source"],
    sourceFormat,
    isDefault: row.isDefault,
    url: `/scenes/${row.sceneId}/subtitles/${row.id}`,
    sourceUrl: hasRawSource
      ? `/scenes/${row.sceneId}/subtitles/${row.id}/source`
      : null,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

export async function listSubtitleTracks(sceneId: string): Promise<SceneSubtitleTrackDto[]> {
  const rows = await db
    .select()
    .from(sceneSubtitles)
    .where(eq(sceneSubtitles.sceneId, sceneId))
    .orderBy(asc(sceneSubtitles.createdAt));
  return rows.map(trackToDto);
}

export async function getSubtitleTrack(sceneId: string, trackId: string) {
  const [row] = await db
    .select()
    .from(sceneSubtitles)
    .where(
      and(eq(sceneSubtitles.sceneId, sceneId), eq(sceneSubtitles.id, trackId))
    )
    .limit(1);
  if (!row) throw new AppError(404, "Subtitle track not found");
  return row;
}

export async function readSubtitleVtt(sceneId: string, trackId: string): Promise<string> {
  const row = await getSubtitleTrack(sceneId, trackId);
  try {
    return await readFile(row.storagePath, "utf8");
  } catch {
    throw new AppError(404, "Subtitle file missing on disk");
  }
}

/**
 * Return the preserved original subtitle source (e.g. the .ass file) alongside
 * its format. The player uses this to render ASS subtitles with full libass
 * fidelity through JASSUB. Throws 404 when no raw source is available for the
 * track (i.e. it's a native VTT/SRT that was normalized directly).
 */
export async function readSubtitleSource(
  sceneId: string,
  trackId: string,
): Promise<{ content: string; format: SubtitleFormat }> {
  const row = await getSubtitleTrack(sceneId, trackId);
  const sourceFormat = (row.sourceFormat ?? "vtt") as SubtitleFormat;
  if (!row.sourcePath || (sourceFormat !== "ass" && sourceFormat !== "ssa")) {
    throw new AppError(404, "No raw subtitle source preserved for this track");
  }
  try {
    const content = await readFile(row.sourcePath, "utf8");
    return { content, format: sourceFormat };
  } catch {
    throw new AppError(404, "Subtitle source file missing on disk");
  }
}

export async function getSubtitleCues(
  sceneId: string,
  trackId: string
): Promise<SubtitleCueDto[]> {
  const vtt = await readSubtitleVtt(sceneId, trackId);
  return parseVttCues(vtt);
}

export interface UpdateSubtitleBody {
  language?: string;
  label?: string | null;
}

export async function updateSubtitleTrack(
  sceneId: string,
  trackId: string,
  body: UpdateSubtitleBody,
): Promise<SceneSubtitleTrackDto> {
  const existing = await getSubtitleTrack(sceneId, trackId);
  const patch: Record<string, unknown> = {};
  if (typeof body.language === "string" && body.language.trim().length > 0) {
    patch.language = body.language.trim().toLowerCase();
  }
  if (body.label !== undefined) {
    patch.label =
      typeof body.label === "string" && body.label.trim().length > 0
        ? body.label.trim()
        : null;
  }
  if (Object.keys(patch).length === 0) {
    return trackToDto(existing);
  }
  await db
    .update(sceneSubtitles)
    .set(patch)
    .where(eq(sceneSubtitles.id, trackId));
  const [row] = await db
    .select()
    .from(sceneSubtitles)
    .where(eq(sceneSubtitles.id, trackId))
    .limit(1);
  return trackToDto(row!);
}

export async function deleteSubtitleTrack(sceneId: string, trackId: string) {
  const row = await getSubtitleTrack(sceneId, trackId);
  await unlink(row.storagePath).catch(() => undefined);
  if (row.sourcePath) {
    await unlink(row.sourcePath).catch(() => undefined);
  }
  await db.delete(sceneSubtitles).where(eq(sceneSubtitles.id, trackId));
  return { ok: true };
}

export interface UploadSubtitleFields {
  language?: string;
  label?: string | null;
}

export async function uploadSubtitle(
  sceneId: string,
  file: MultipartFile,
  fields: UploadSubtitleFields
): Promise<SceneSubtitleTrackDto> {
  const [scene] = await db
    .select({ id: scenes.id })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .limit(1);
  if (!scene) throw new AppError(404, "Video not found");

  const filename = file.filename ?? "subtitle";
  const format = getSubtitleFormat(filename);
  if (!format) {
    throw new AppError(400, "Unsupported subtitle format. Use .vtt, .srt, .ass, or .ssa");
  }

  const buf = await file.toBuffer();
  const text = buf.toString("utf8");
  const vtt = normalizeSubtitleToVtt(text, format);

  const language = (fields.language ?? "und").toLowerCase();
  const label = fields.label ?? null;

  const outDir = getSceneSubtitlesDir(sceneId);
  await mkdir(outDir, { recursive: true });

  // Unique per (sceneId, language, source="upload") — overwrite if replacing.
  const existing = await db
    .select({
      id: sceneSubtitles.id,
      storagePath: sceneSubtitles.storagePath,
      sourcePath: sceneSubtitles.sourcePath,
    })
    .from(sceneSubtitles)
    .where(
      and(
        eq(sceneSubtitles.sceneId, sceneId),
        eq(sceneSubtitles.language, language),
        eq(sceneSubtitles.source, "upload")
      )
    )
    .limit(1);

  const outPath = path.join(outDir, `upload-${language}.vtt`);
  await writeFile(outPath, vtt, "utf8");

  // Preserve the raw file for ASS/SSA so the player can render it natively.
  const preservesRaw = format === "ass" || format === "ssa";
  const sourceOutPath = preservesRaw
    ? path.join(outDir, `upload-${language}.${format}`)
    : null;
  if (sourceOutPath) {
    await writeFile(sourceOutPath, text, "utf8");
  }

  let trackId: string;
  if (existing.length > 0) {
    const row = existing[0]!;
    if (row.storagePath && row.storagePath !== outPath) {
      await unlink(row.storagePath).catch(() => undefined);
    }
    if (row.sourcePath && row.sourcePath !== sourceOutPath) {
      await unlink(row.sourcePath).catch(() => undefined);
    }
    await db
      .update(sceneSubtitles)
      .set({
        storagePath: outPath,
        label,
        format: "vtt",
        sourceFormat: format,
        sourcePath: sourceOutPath,
      })
      .where(eq(sceneSubtitles.id, row.id));
    trackId = row.id;
  } else {
    const [inserted] = await db
      .insert(sceneSubtitles)
      .values({
        sceneId,
        language,
        label,
        format: "vtt",
        source: "upload",
        storagePath: outPath,
        sourceFormat: format,
        sourcePath: sourceOutPath,
        isDefault: false,
      })
      .returning({ id: sceneSubtitles.id });
    trackId = inserted!.id;
  }

  const [row] = await db
    .select()
    .from(sceneSubtitles)
    .where(eq(sceneSubtitles.id, trackId))
    .limit(1);
  return trackToDto(row!);
}

export async function enqueueEmbeddedExtraction(sceneId: string) {
  const [scene] = await db
    .select({ id: scenes.id, title: scenes.title, filePath: scenes.filePath })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .limit(1);
  if (!scene) throw new AppError(404, "Video not found");
  if (!scene.filePath) throw new AppError(400, "Scene has no source file");

  const result = await enqueueQueueJob({
    queueName: "extract-subtitles",
    jobName: "scene-extract-subtitles",
    data: { sceneId: scene.id },
    target: { type: "scene", id: scene.id, label: scene.title },
    trigger: { by: "manual", label: "Requested from scene detail" },
  });

  return { enqueued: Boolean(result), jobId: result?.id ?? null };
}
