import { asc, eq } from "drizzle-orm";
import type { VideoMarkerDto } from "@obscura/contracts";
import { schema, type AppDb } from "@obscura/db";
import { NotFoundError, ValidationError } from "./errors";

const { videoMarkers, videoEpisodes, videoMovies } = schema;

export type VideoEntityKind = "video_episode" | "video_movie";

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

function markerToDto(row: typeof videoMarkers.$inferSelect): VideoMarkerDto {
  return {
    id: row.id,
    title: row.title,
    seconds: Number(row.seconds),
    endSeconds: row.endSeconds != null ? Number(row.endSeconds) : null,
  };
}

export async function listMarkersRead(
  db: AppDb,
  videoId: string,
): Promise<VideoMarkerDto[]> {
  await resolveVideoKind(db, videoId);
  const rows = await db
    .select()
    .from(videoMarkers)
    .where(eq(videoMarkers.entityId, videoId))
    .orderBy(asc(videoMarkers.seconds));
  return rows.map(markerToDto);
}

export interface CreateMarkerBody {
  title: string;
  seconds: number;
  endSeconds?: number | null;
}

export async function createMarkerWrite(
  db: AppDb,
  videoId: string,
  body: CreateMarkerBody,
): Promise<VideoMarkerDto> {
  const kind = await resolveVideoKind(db, videoId);
  if (!body || typeof body.title !== "string" || body.title.trim() === "") {
    throw new ValidationError("title is required");
  }
  if (!Number.isFinite(body.seconds) || body.seconds < 0) {
    throw new ValidationError("seconds must be a non-negative number");
  }
  const endSeconds =
    body.endSeconds != null && Number.isFinite(body.endSeconds)
      ? body.endSeconds
      : null;
  if (endSeconds != null && endSeconds < body.seconds) {
    throw new ValidationError("endSeconds must be >= seconds");
  }

  const [inserted] = await db
    .insert(videoMarkers)
    .values({
      entityType: kind,
      entityId: videoId,
      title: body.title.trim(),
      seconds: body.seconds,
      endSeconds,
    })
    .returning();
  return markerToDto(inserted);
}

export interface UpdateMarkerBody {
  title?: string;
  seconds?: number;
  endSeconds?: number | null;
}

async function getMarker(db: AppDb, markerId: string) {
  const [row] = await db
    .select()
    .from(videoMarkers)
    .where(eq(videoMarkers.id, markerId))
    .limit(1);
  if (!row) throw new NotFoundError("Marker not found");
  return row;
}

export async function updateMarkerWrite(
  db: AppDb,
  markerId: string,
  body: UpdateMarkerBody,
): Promise<VideoMarkerDto> {
  const existing = await getMarker(db, markerId);
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body.title === "string") {
    const trimmed = body.title.trim();
    if (trimmed === "") throw new ValidationError("title must not be empty");
    patch.title = trimmed;
  }
  if (body.seconds !== undefined) {
    if (!Number.isFinite(body.seconds) || body.seconds < 0) {
      throw new ValidationError("seconds must be a non-negative number");
    }
    patch.seconds = body.seconds;
  }
  if (body.endSeconds !== undefined) {
    patch.endSeconds =
      body.endSeconds != null && Number.isFinite(body.endSeconds)
        ? body.endSeconds
        : null;
  }

  const nextSeconds =
    typeof patch.seconds === "number"
      ? patch.seconds
      : Number(existing.seconds);
  const nextEnd =
    patch.endSeconds != null && typeof patch.endSeconds === "number"
      ? patch.endSeconds
      : existing.endSeconds != null
        ? Number(existing.endSeconds)
        : null;
  if (nextEnd != null && nextEnd < nextSeconds) {
    throw new ValidationError("endSeconds must be >= seconds");
  }

  await db.update(videoMarkers).set(patch).where(eq(videoMarkers.id, markerId));
  const [row] = await db
    .select()
    .from(videoMarkers)
    .where(eq(videoMarkers.id, markerId))
    .limit(1);
  return markerToDto(row!);
}

export async function deleteMarkerWrite(db: AppDb, markerId: string) {
  const result = await db
    .delete(videoMarkers)
    .where(eq(videoMarkers.id, markerId))
    .returning({ id: videoMarkers.id });
  if (result.length === 0) throw new NotFoundError("Marker not found");
  return { ok: true as const };
}
