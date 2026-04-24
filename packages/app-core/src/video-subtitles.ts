import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, eq } from "drizzle-orm";
import {
  getVideoSubtitlesDir,
  getSubtitleFormat,
  normalizeSubtitleToVtt,
  parseVttCues,
  type SubtitleFormat,
} from "@obscura/media-core";
import type {
  VideoSubtitleTrackDto,
  SubtitleCueDto,
} from "@obscura/contracts";
import { schema, type AppDb } from "@obscura/db";
import { NotFoundError, ValidationError } from "./errors";

const { videoSubtitles, videoEpisodes, videoMovies } = schema;

type VideoEntityKind = "video_episode" | "video_movie";

async function resolveVideoKind(
  db: AppDb,
  videoId: string,
): Promise<VideoEntityKind> {
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
  throw new NotFoundError("Video not found");
}

function trackToDto(
  row: typeof videoSubtitles.$inferSelect,
): VideoSubtitleTrackDto {
  const sourceFormat = (row.sourceFormat ?? "vtt") as VideoSubtitleTrackDto["sourceFormat"];
  const hasRawSource =
    (sourceFormat === "ass" || sourceFormat === "ssa") && !!row.sourcePath;
  return {
    id: row.id,
    videoId: row.entityId,
    language: row.language,
    label: row.label,
    format: "vtt",
    source: row.source as VideoSubtitleTrackDto["source"],
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

export async function listSubtitleTracksRead(
  db: AppDb,
  videoId: string,
): Promise<VideoSubtitleTrackDto[]> {
  const kind = await resolveVideoKind(db, videoId);
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

async function getSubtitleTrackRow(
  db: AppDb,
  videoId: string,
  trackId: string,
) {
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
  if (!row) throw new NotFoundError("Subtitle track not found");
  return row;
}

export async function readSubtitleVtt(
  db: AppDb,
  videoId: string,
  trackId: string,
): Promise<string> {
  const row = await getSubtitleTrackRow(db, videoId, trackId);
  try {
    return await readFile(row.storagePath, "utf8");
  } catch {
    throw new NotFoundError("Subtitle file missing on disk");
  }
}

export async function readSubtitleSource(
  db: AppDb,
  videoId: string,
  trackId: string,
): Promise<{ content: string; format: SubtitleFormat }> {
  const row = await getSubtitleTrackRow(db, videoId, trackId);
  const sourceFormat = (row.sourceFormat ?? "vtt") as SubtitleFormat;
  if (!row.sourcePath || (sourceFormat !== "ass" && sourceFormat !== "ssa")) {
    throw new NotFoundError("No raw subtitle source preserved for this track");
  }
  try {
    const content = await readFile(row.sourcePath, "utf8");
    return { content, format: sourceFormat };
  } catch {
    throw new NotFoundError("Subtitle source file missing on disk");
  }
}

export async function getSubtitleCuesRead(
  db: AppDb,
  videoId: string,
  trackId: string,
): Promise<SubtitleCueDto[]> {
  const vtt = await readSubtitleVtt(db, videoId, trackId);
  return parseVttCues(vtt);
}

export interface UpdateSubtitleBody {
  language?: string;
  label?: string | null;
}

export async function updateSubtitleTrackWrite(
  db: AppDb,
  videoId: string,
  trackId: string,
  body: UpdateSubtitleBody,
): Promise<VideoSubtitleTrackDto> {
  const existing = await getSubtitleTrackRow(db, videoId, trackId);
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
  if (Object.keys(patch).length === 0) return trackToDto(existing);
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

export async function deleteSubtitleTrackWrite(
  db: AppDb,
  videoId: string,
  trackId: string,
) {
  const row = await getSubtitleTrackRow(db, videoId, trackId);
  await unlink(row.storagePath).catch(() => undefined);
  if (row.sourcePath) await unlink(row.sourcePath).catch(() => undefined);
  await db.delete(videoSubtitles).where(eq(videoSubtitles.id, trackId));
  return { ok: true as const };
}

export interface UploadSubtitleInput {
  filename: string;
  buffer: Buffer;
  language?: string;
  label?: string | null;
}

export async function uploadSubtitleWrite(
  db: AppDb,
  videoId: string,
  input: UploadSubtitleInput,
): Promise<VideoSubtitleTrackDto> {
  const kind = await resolveVideoKind(db, videoId);

  const filename = input.filename ?? "subtitle";
  const format = getSubtitleFormat(filename);
  if (!format) {
    throw new ValidationError(
      "Unsupported subtitle format. Use .vtt, .srt, .ass, or .ssa",
    );
  }

  const text = input.buffer.toString("utf8");
  const vtt = normalizeSubtitleToVtt(text, format);

  const language = (input.language ?? "und").toLowerCase();
  const label = input.label ?? null;

  const outDir = getVideoSubtitlesDir(videoId);
  await mkdir(outDir, { recursive: true });

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
  if (sourceOutPath) await writeFile(sourceOutPath, text, "utf8");

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
