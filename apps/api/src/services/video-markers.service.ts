/**
 * Markers for the new video model. Writes into the polymorphic
 * `video_markers` table keyed on `entity_type` + `entity_id`. The wire
 * DTO matches the legacy `SceneMarkerDto` so existing player code
 * consumes the response unchanged.
 */
import { and, asc, eq } from "drizzle-orm";
import type { SceneMarkerDto } from "@obscura/contracts";
import { AppError } from "../plugins/error-handler";
import { db, schema } from "../db";

const { videoMarkers, videoEpisodes, videoMovies } = schema;

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

function markerToDto(
  row: typeof videoMarkers.$inferSelect,
): SceneMarkerDto {
  return {
    id: row.id,
    title: row.title,
    seconds: Number(row.seconds),
    endSeconds: row.endSeconds != null ? Number(row.endSeconds) : null,
  };
}

export async function listMarkers(
  videoId: string,
): Promise<SceneMarkerDto[]> {
  // Touch the video first so bogus ids surface as 404.
  await resolveVideoKind(videoId);
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

export async function createMarker(
  videoId: string,
  body: CreateMarkerBody,
): Promise<SceneMarkerDto> {
  const kind = await resolveVideoKind(videoId);
  if (!body || typeof body.title !== "string" || body.title.trim() === "") {
    throw new AppError(400, "title is required");
  }
  if (!Number.isFinite(body.seconds) || body.seconds < 0) {
    throw new AppError(400, "seconds must be a non-negative number");
  }
  const endSeconds =
    body.endSeconds != null && Number.isFinite(body.endSeconds)
      ? body.endSeconds
      : null;
  if (endSeconds != null && endSeconds < body.seconds) {
    throw new AppError(400, "endSeconds must be >= seconds");
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

async function getMarker(markerId: string) {
  const [row] = await db
    .select()
    .from(videoMarkers)
    .where(eq(videoMarkers.id, markerId))
    .limit(1);
  if (!row) throw new AppError(404, "Marker not found");
  return row;
}

export async function updateMarker(
  markerId: string,
  body: UpdateMarkerBody,
): Promise<SceneMarkerDto> {
  const existing = await getMarker(markerId);
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body.title === "string") {
    const trimmed = body.title.trim();
    if (trimmed === "") throw new AppError(400, "title must not be empty");
    patch.title = trimmed;
  }
  if (body.seconds !== undefined) {
    if (!Number.isFinite(body.seconds) || body.seconds < 0) {
      throw new AppError(400, "seconds must be a non-negative number");
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
    typeof patch.seconds === "number" ? patch.seconds : Number(existing.seconds);
  const nextEnd =
    patch.endSeconds != null && typeof patch.endSeconds === "number"
      ? patch.endSeconds
      : existing.endSeconds != null
        ? Number(existing.endSeconds)
        : null;
  if (nextEnd != null && nextEnd < nextSeconds) {
    throw new AppError(400, "endSeconds must be >= seconds");
  }

  await db
    .update(videoMarkers)
    .set(patch)
    .where(eq(videoMarkers.id, markerId));
  const [row] = await db
    .select()
    .from(videoMarkers)
    .where(eq(videoMarkers.id, markerId))
    .limit(1);
  return markerToDto(row!);
}

export async function deleteMarker(markerId: string) {
  const result = await db
    .delete(videoMarkers)
    .where(eq(videoMarkers.id, markerId))
    .returning({ id: videoMarkers.id });
  if (result.length === 0) throw new AppError(404, "Marker not found");
  return { ok: true as const };
}

// Unused-import suppression when the `and` helper isn't referenced after
// TS narrows the query chain.
void and;
