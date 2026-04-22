/**
 * Markers for the new video model — thin Fastify-side shim around
 * @obscura/app-core helpers.
 */
import {
  createMarkerWrite,
  deleteMarkerWrite,
  listMarkersRead,
  NotFoundError,
  updateMarkerWrite,
  ValidationError,
  type CreateMarkerBody,
  type UpdateMarkerBody,
  type VideoEntityKind,
} from "@obscura/app-core";
import { db } from "../db";
import { AppError } from "../plugins/error-handler";

export type { VideoEntityKind, CreateMarkerBody, UpdateMarkerBody };

function mapError(err: unknown): never {
  if (err instanceof NotFoundError) throw new AppError(404, err.message);
  if (err instanceof ValidationError) throw new AppError(400, err.message);
  throw err;
}

export async function listMarkers(videoId: string) {
  try {
    return await listMarkersRead(db, videoId);
  } catch (err) {
    mapError(err);
  }
}

export async function createMarker(videoId: string, body: CreateMarkerBody) {
  try {
    return await createMarkerWrite(db, videoId, body);
  } catch (err) {
    mapError(err);
  }
}

export async function updateMarker(markerId: string, body: UpdateMarkerBody) {
  try {
    return await updateMarkerWrite(db, markerId, body);
  } catch (err) {
    mapError(err);
  }
}

export async function deleteMarker(markerId: string) {
  try {
    return await deleteMarkerWrite(db, markerId);
  } catch (err) {
    mapError(err);
  }
}
