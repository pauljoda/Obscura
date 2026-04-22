/**
 * Studio business logic — thin Fastify-side shim around the shared
 * helpers in @obscura/app-core.
 */
import {
  createStudioWrite,
  deleteStudioImageWrite,
  deleteStudioWrite,
  findOrCreateStudioWrite,
  getStudioByIdRead,
  listStudiosRead,
  setStudioFavoriteWrite,
  setStudioImageFromUrlWrite,
  setStudioRatingWrite,
  StudioNotFoundError,
  StudioUpstreamError,
  StudioValidationError,
  updateStudioWrite,
  uploadStudioImageWrite,
  type CreateStudioBody,
  type FindOrCreateStudioBody,
  type UpdateStudioBody,
} from "@obscura/app-core";
import { db } from "../db";
import { AppError } from "../plugins/error-handler";

function mapStudioError(err: unknown): never {
  if (err instanceof StudioNotFoundError) throw new AppError(404, err.message);
  if (err instanceof StudioValidationError) throw new AppError(400, err.message);
  if (err instanceof StudioUpstreamError) throw new AppError(502, err.message);
  throw err;
}

export async function listStudios(sfwOnly: boolean) {
  return listStudiosRead(db, sfwOnly);
}

export async function getStudioById(id: string, sfwOnly: boolean) {
  const detail = await getStudioByIdRead(db, id, sfwOnly);
  if (!detail) throw new AppError(404, "Studio not found");
  return detail;
}

export async function updateStudio(id: string, body: UpdateStudioBody) {
  try {
    return await updateStudioWrite(db, id, body);
  } catch (err) {
    mapStudioError(err);
  }
}

export async function createStudio(body: CreateStudioBody) {
  try {
    return await createStudioWrite(db, body);
  } catch (err) {
    mapStudioError(err);
  }
}

export async function findOrCreateStudio(body: FindOrCreateStudioBody) {
  try {
    return await findOrCreateStudioWrite(db, body);
  } catch (err) {
    mapStudioError(err);
  }
}

export async function deleteStudio(id: string) {
  try {
    return await deleteStudioWrite(db, id);
  } catch (err) {
    mapStudioError(err);
  }
}

export async function setStudioFavorite(id: string, favorite: boolean) {
  try {
    return await setStudioFavoriteWrite(db, id, favorite);
  } catch (err) {
    mapStudioError(err);
  }
}

export async function setStudioRating(id: string, rating: number | null) {
  try {
    return await setStudioRatingWrite(db, id, rating);
  } catch (err) {
    mapStudioError(err);
  }
}

export async function uploadStudioImage(id: string, buffer: Buffer) {
  try {
    return await uploadStudioImageWrite(db, id, buffer);
  } catch (err) {
    mapStudioError(err);
  }
}

export async function setStudioImageFromUrl(id: string, imageUrl: string) {
  try {
    return await setStudioImageFromUrlWrite(db, id, imageUrl);
  } catch (err) {
    mapStudioError(err);
  }
}

export async function deleteStudioImage(id: string) {
  try {
    return await deleteStudioImageWrite(db, id);
  } catch (err) {
    mapStudioError(err);
  }
}
