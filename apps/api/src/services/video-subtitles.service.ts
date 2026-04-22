/**
 * Subtitle tracks — Fastify shim around @obscura/app-core.
 * The embedded-extraction enqueue remains here since it depends on the
 * Fastify-side job queue wiring.
 */
import type { MultipartFile } from "@fastify/multipart";
import { eq } from "drizzle-orm";
import {
  deleteSubtitleTrackWrite,
  getSubtitleCuesRead,
  listSubtitleTracksRead,
  NotFoundError,
  readSubtitleSource as readSubtitleSourceShared,
  readSubtitleVtt as readSubtitleVttShared,
  updateSubtitleTrackWrite,
  uploadSubtitleWrite,
  ValidationError,
  type UpdateSubtitleBody,
  type UploadSubtitleInput,
} from "@obscura/app-core";
import { db, schema } from "../db";
import { AppError } from "../plugins/error-handler";
import { enqueueQueueJob } from "../lib/job-enqueue";

const { videoEpisodes, videoMovies } = schema;

export type VideoEntityKind = "video_episode" | "video_movie";
export type { UpdateSubtitleBody };

export interface UploadSubtitleFields {
  language?: string;
  label?: string | null;
}

function mapError(err: unknown): never {
  if (err instanceof NotFoundError) throw new AppError(404, err.message);
  if (err instanceof ValidationError) throw new AppError(400, err.message);
  throw err;
}

export async function listSubtitleTracks(videoId: string) {
  try {
    return await listSubtitleTracksRead(db, videoId);
  } catch (err) {
    mapError(err);
  }
}

export async function readSubtitleVtt(videoId: string, trackId: string) {
  try {
    return await readSubtitleVttShared(db, videoId, trackId);
  } catch (err) {
    mapError(err);
  }
}

export async function readSubtitleSource(videoId: string, trackId: string) {
  try {
    return await readSubtitleSourceShared(db, videoId, trackId);
  } catch (err) {
    mapError(err);
  }
}

export async function getSubtitleCues(videoId: string, trackId: string) {
  try {
    return await getSubtitleCuesRead(db, videoId, trackId);
  } catch (err) {
    mapError(err);
  }
}

export async function updateSubtitleTrack(
  videoId: string,
  trackId: string,
  body: UpdateSubtitleBody,
) {
  try {
    return await updateSubtitleTrackWrite(db, videoId, trackId, body);
  } catch (err) {
    mapError(err);
  }
}

export async function deleteSubtitleTrack(videoId: string, trackId: string) {
  try {
    return await deleteSubtitleTrackWrite(db, videoId, trackId);
  } catch (err) {
    mapError(err);
  }
}

export async function uploadSubtitle(
  videoId: string,
  file: MultipartFile,
  fields: UploadSubtitleFields,
) {
  const buffer = await file.toBuffer();
  const input: UploadSubtitleInput = {
    filename: file.filename ?? "subtitle",
    buffer,
    language: fields.language,
    label: fields.label ?? null,
  };
  try {
    return await uploadSubtitleWrite(db, videoId, input);
  } catch (err) {
    mapError(err);
  }
}

/**
 * Enqueue an embedded-subtitle extraction job. Stays Fastify-local
 * because the queue helper is bound to the API's job-runs bookkeeping.
 */
export async function enqueueEmbeddedExtraction(videoId: string) {
  const [episode] = await db
    .select({ id: videoEpisodes.id, title: videoEpisodes.title, filePath: videoEpisodes.filePath })
    .from(videoEpisodes)
    .where(eq(videoEpisodes.id, videoId))
    .limit(1);
  let kind: VideoEntityKind;
  let row: { id: string; title: string | null; filePath: string | null } | undefined;
  if (episode) {
    kind = "video_episode";
    row = episode;
  } else {
    const [movie] = await db
      .select({ id: videoMovies.id, title: videoMovies.title, filePath: videoMovies.filePath })
      .from(videoMovies)
      .where(eq(videoMovies.id, videoId))
      .limit(1);
    if (!movie) throw new AppError(404, "Video not found");
    kind = "video_movie";
    row = movie;
  }
  if (!row.filePath) throw new AppError(400, "Video has no source file");

  const result = await enqueueQueueJob({
    queueName: "extract-subtitles",
    jobName: `${kind}-extract-subtitles`,
    data: { entityKind: kind, entityId: videoId },
    target: { type: kind, id: videoId, label: row.title ?? undefined },
    trigger: { by: "manual", label: "Requested from video detail" },
  });

  return { enqueued: Boolean(result), jobId: result?.id ?? null };
}
