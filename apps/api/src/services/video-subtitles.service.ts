/**
 * Subtitle tracks for the new video model. Writes into the polymorphic
 * `video_subtitles` table keyed on `entity_type` + `entity_id`, where
 * `entity_type` is `"video_episode"` or `"video_movie"`.
 *
 * The wire DTO keeps the legacy `sceneId` field name for compatibility
 * with the existing web player; callers populate it with the video
 * entity id.
 */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
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
import type {
  SceneSubtitleTrackDto,
  SubtitleCueDto,
} from "@obscura/contracts";
import { AppError } from "../plugins/error-handler";
import { db, schema } from "../db";
import { enqueueQueueJob } from "../lib/job-enqueue";

const { videoSubtitles, videoEpisodes, videoMovies } = schema;

export type VideoEntityKind = "video_episode" | "video_movie";

async function resolveVideoKind(videoId: string): Promise<VideoEntityKind> {
  const [ep] = await db
    .select({ id: videoEpisodes.id })
    .from(videoEpisodes)
    .where(eq(videoEpisodes.id, videoId))
    .limit(1);
  if (ep) return "video_episode";
  const [mv] = await db
    .select({ id: videoMovies.id })
    .from(videoMovies)
    .where(eq(videoMovies.id, videoId))
    .limit(1);
  if (mv) return "video_movie";
  throw new AppError(404, "Video not found");
}

function trackToDto(
  row: typeof videoSubtitles.$inferSelect,
): SceneSubtitleTrackDto {
  const sourceFormat = (row.sourceFormat ?? "vtt") as SceneSubtitleTrackDto["sourceFormat"];
  const hasRawSource =
    (sourceFormat === "ass" || sourceFormat === "ssa") && !!row.sourcePath;
  return {
    id: row.id,
    sceneId: row.entityId,
    language: row.language,
    label: row.label,
    format: "vtt",
    source: row.source as SceneSubtitleTrackDto["source"],
    sourceFormat,
    isDefault: row.isDefault,
    url: `/videos/${row.entityId}/subtitles/${row.id}`,
    sourceUrl: hasRawSource
      ? `/videos/${row.entityId}/subtitles/${row.id}/source`
      : null,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

export async function listSubtitleTracks(
  videoId: string,
): Promise<SceneSubtitleTrackDto[]> {
  // Resolve the kind so a 404 surfaces at list time if the id is bogus.
  const kind = await resolveVideoKind(videoId);
  const rows = await db
    .select()
    .from(videoSubtitles)
    .where(
      and(
        eq(videoSubtitles.entityType, kind),
        eq(videoSubtitles.entityId, videoId),
      ),
    )
    .orderBy(asc(videoSubtitles.createdAt));
  return rows.map(trackToDto);
}

export async function getSubtitleTrack(videoId: string, trackId: string) {
  const [row] = await db
    .select()
    .from(videoSubtitles)
    .where(
      and(
        eq(videoSubtitles.entityId, videoId),
        eq(videoSubtitles.id, trackId),
      ),
    )
    .limit(1);
  if (!row) throw new AppError(404, "Subtitle track not found");
  return row;
}

export async function readSubtitleVtt(
  videoId: string,
  trackId: string,
): Promise<string> {
  const row = await getSubtitleTrack(videoId, trackId);
  try {
    return await readFile(row.storagePath, "utf8");
  } catch {
    throw new AppError(404, "Subtitle file missing on disk");
  }
}

export async function readSubtitleSource(
  videoId: string,
  trackId: string,
): Promise<{ content: string; format: SubtitleFormat }> {
  const row = await getSubtitleTrack(videoId, trackId);
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
  videoId: string,
  trackId: string,
): Promise<SubtitleCueDto[]> {
  const vtt = await readSubtitleVtt(videoId, trackId);
  return parseVttCues(vtt);
}

export interface UpdateSubtitleBody {
  language?: string;
  label?: string | null;
}

export async function updateSubtitleTrack(
  videoId: string,
  trackId: string,
  body: UpdateSubtitleBody,
): Promise<SceneSubtitleTrackDto> {
  const existing = await getSubtitleTrack(videoId, trackId);
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
    .update(videoSubtitles)
    .set(patch)
    .where(eq(videoSubtitles.id, trackId));
  const [row] = await db
    .select()
    .from(videoSubtitles)
    .where(eq(videoSubtitles.id, trackId))
    .limit(1);
  return trackToDto(row!);
}

export async function deleteSubtitleTrack(
  videoId: string,
  trackId: string,
) {
  const row = await getSubtitleTrack(videoId, trackId);
  await unlink(row.storagePath).catch(() => undefined);
  if (row.sourcePath) {
    await unlink(row.sourcePath).catch(() => undefined);
  }
  await db.delete(videoSubtitles).where(eq(videoSubtitles.id, trackId));
  return { ok: true };
}

export interface UploadSubtitleFields {
  language?: string;
  label?: string | null;
}

export async function uploadSubtitle(
  videoId: string,
  file: MultipartFile,
  fields: UploadSubtitleFields,
): Promise<SceneSubtitleTrackDto> {
  const kind = await resolveVideoKind(videoId);

  const filename = file.filename ?? "subtitle";
  const format = getSubtitleFormat(filename);
  if (!format) {
    throw new AppError(
      400,
      "Unsupported subtitle format. Use .vtt, .srt, .ass, or .ssa",
    );
  }

  const buf = await file.toBuffer();
  const text = buf.toString("utf8");
  const vtt = normalizeSubtitleToVtt(text, format);

  const language = (fields.language ?? "und").toLowerCase();
  const label = fields.label ?? null;

  const outDir = getSceneSubtitlesDir(videoId);
  await mkdir(outDir, { recursive: true });

  // Unique per (entityId, language, source="upload") — overwrite existing.
  const existing = await db
    .select({
      id: videoSubtitles.id,
      storagePath: videoSubtitles.storagePath,
      sourcePath: videoSubtitles.sourcePath,
    })
    .from(videoSubtitles)
    .where(
      and(
        eq(videoSubtitles.entityType, kind),
        eq(videoSubtitles.entityId, videoId),
        eq(videoSubtitles.language, language),
        eq(videoSubtitles.source, "upload"),
      ),
    )
    .limit(1);

  const outPath = path.join(outDir, `upload-${language}.vtt`);
  await writeFile(outPath, vtt, "utf8");

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
      .update(videoSubtitles)
      .set({
        storagePath: outPath,
        label,
        format: "vtt",
        sourceFormat: format,
        sourcePath: sourceOutPath,
      })
      .where(eq(videoSubtitles.id, row.id));
    trackId = row.id;
  } else {
    const [inserted] = await db
      .insert(videoSubtitles)
      .values({
        entityType: kind,
        entityId: videoId,
        language,
        label,
        format: "vtt",
        source: "upload",
        storagePath: outPath,
        sourceFormat: format,
        sourcePath: sourceOutPath,
        isDefault: false,
      })
      .returning({ id: videoSubtitles.id });
    trackId = inserted!.id;
  }

  const [row] = await db
    .select()
    .from(videoSubtitles)
    .where(eq(videoSubtitles.id, trackId))
    .limit(1);
  return trackToDto(row!);
}

/**
 * Enqueue an embedded-subtitle extraction job for the given video
 * entity. Mirrors the legacy `enqueueEmbeddedExtraction(sceneId)` but
 * passes the new `entityKind` + `entityId` payload the ported worker
 * processor reads.
 */
export async function enqueueEmbeddedExtraction(videoId: string) {
  const kind = await resolveVideoKind(videoId);
  const table = kind === "video_episode" ? videoEpisodes : videoMovies;
  const [row] = await db
    .select({ id: table.id, title: table.title, filePath: table.filePath })
    .from(table)
    .where(eq(table.id, videoId))
    .limit(1);
  if (!row) throw new AppError(404, "Video not found");
  if (!row.filePath) {
    throw new AppError(400, "Video has no source file");
  }

  const result = await enqueueQueueJob({
    queueName: "extract-subtitles",
    jobName: `${kind}-extract-subtitles`,
    data: { entityKind: kind, entityId: videoId },
    target: { type: kind, id: videoId, label: row.title ?? undefined },
    trigger: { by: "manual", label: "Requested from video detail" },
  });

  return { enqueued: Boolean(result), jobId: result?.id ?? null };
}
