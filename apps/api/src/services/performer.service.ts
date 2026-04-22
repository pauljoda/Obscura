/**
 * Performer business logic — thin Fastify-side shim around
 * @obscura/app-core helpers.
 */
import {
  createPerformerWrite,
  deletePerformerImageWrite,
  deletePerformerWrite,
  getPerformerByIdRead,
  listPerformersRead,
  PerformerNotFoundError,
  PerformerUpstreamError,
  PerformerValidationError,
  setPerformerFavoriteWrite,
  setPerformerImageFromUrlWrite,
  setPerformerRatingWrite,
  updatePerformerWrite,
  uploadPerformerImageWrite,
  type CreatePerformerBody,
  type ListPerformersQuery as SharedListPerformersQuery,
  type UpdatePerformerBody,
} from "@obscura/app-core";
import { db } from "../db";
import { AppError } from "../plugins/error-handler";

function mapPerformerError(err: unknown): never {
  if (err instanceof PerformerNotFoundError)
    throw new AppError(404, err.message);
  if (err instanceof PerformerValidationError)
    throw new AppError(400, err.message);
  if (err instanceof PerformerUpstreamError)
    throw new AppError(502, err.message);
  throw err;
}

export interface ListPerformersQuery extends SharedListPerformersQuery {}
export type { CreatePerformerBody, UpdatePerformerBody };

export async function listPerformers(query: ListPerformersQuery) {
  return listPerformersRead(db, query);
}

export async function getPerformerById(id: string, sfwOnly: boolean) {
  const detail = await getPerformerByIdRead(db, id, sfwOnly);
  if (!detail) throw new AppError(404, "Actor not found");
  return detail;
}

export async function createPerformer(body: CreatePerformerBody) {
  try {
    return await createPerformerWrite(db, body);
  } catch (err) {
    mapPerformerError(err);
  }
}

export async function updatePerformer(id: string, body: UpdatePerformerBody) {
  try {
    return await updatePerformerWrite(db, id, body);
  } catch (err) {
    mapPerformerError(err);
  }
}

export async function deletePerformer(id: string) {
  try {
    return await deletePerformerWrite(db, id);
  } catch (err) {
    mapPerformerError(err);
  }
}

export async function setPerformerFavorite(id: string, favorite: boolean) {
  try {
    return await setPerformerFavoriteWrite(db, id, favorite);
  } catch (err) {
    mapPerformerError(err);
  }
}

export async function setPerformerRating(id: string, rating: number | null) {
  try {
    return await setPerformerRatingWrite(db, id, rating);
  } catch (err) {
    mapPerformerError(err);
  }
}

export async function uploadPerformerImage(id: string, buffer: Buffer) {
  try {
    return await uploadPerformerImageWrite(db, id, buffer);
  } catch (err) {
    mapPerformerError(err);
  }
}

export async function setPerformerImageFromUrl(id: string, imageUrl: string) {
  try {
    return await setPerformerImageFromUrlWrite(db, id, imageUrl);
  } catch (err) {
    mapPerformerError(err);
  }
}

export async function deletePerformerImage(id: string) {
  try {
    return await deletePerformerImageWrite(db, id);
  } catch (err) {
    mapPerformerError(err);
  }
}
