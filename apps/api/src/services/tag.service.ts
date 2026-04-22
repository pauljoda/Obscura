/**
 * Tag business logic extracted from route handlers.
 *
 * Most of the logic lives in `@obscura/app-core`; this module is a thin
 * shim that binds the shared helpers to the Fastify-side DB instance and
 * translates the sentinel error classes into AppError so the shared
 * error-handler plugin maps them to HTTP responses.
 */
import {
  createTagWrite,
  deleteTagImageWrite,
  deleteTagWrite,
  getTagByIdRead,
  listTagsRead,
  setTagFavoriteWrite,
  setTagImageFromUrlWrite,
  setTagRatingWrite,
  TagNotFoundError,
  TagUpstreamError,
  TagValidationError,
  updateTagWrite,
  uploadTagImageWrite,
  type CreateTagBody,
  type UpdateTagBody,
} from "@obscura/app-core";
import { db } from "../db";
import { AppError } from "../plugins/error-handler";

function mapTagError(err: unknown): never {
  if (err instanceof TagNotFoundError) throw new AppError(404, err.message);
  if (err instanceof TagValidationError) throw new AppError(400, err.message);
  if (err instanceof TagUpstreamError) throw new AppError(502, err.message);
  throw err;
}

export async function listTags(sfwOnly: boolean) {
  return listTagsRead(db, sfwOnly);
}

export async function getTagById(id: string, sfwOnly: boolean) {
  const detail = await getTagByIdRead(db, id, sfwOnly);
  if (!detail) throw new AppError(404, "Tag not found");
  return detail;
}

export async function updateTag(id: string, body: UpdateTagBody) {
  try {
    return await updateTagWrite(db, id, body);
  } catch (err) {
    mapTagError(err);
  }
}

export async function createTag(body: CreateTagBody) {
  try {
    return await createTagWrite(db, body);
  } catch (err) {
    mapTagError(err);
  }
}

export async function deleteTag(id: string) {
  try {
    return await deleteTagWrite(db, id);
  } catch (err) {
    mapTagError(err);
  }
}

export async function setTagFavorite(id: string, favorite: boolean) {
  try {
    return await setTagFavoriteWrite(db, id, favorite);
  } catch (err) {
    mapTagError(err);
  }
}

export async function setTagRating(id: string, rating: number | null) {
  try {
    return await setTagRatingWrite(db, id, rating);
  } catch (err) {
    mapTagError(err);
  }
}

export async function uploadTagImage(id: string, buffer: Buffer) {
  try {
    return await uploadTagImageWrite(db, id, buffer);
  } catch (err) {
    mapTagError(err);
  }
}

export async function setTagImageFromUrl(id: string, imageUrl: string) {
  try {
    return await setTagImageFromUrlWrite(db, id, imageUrl);
  } catch (err) {
    mapTagError(err);
  }
}

export async function deleteTagImage(id: string) {
  try {
    return await deleteTagImageWrite(db, id);
  } catch (err) {
    mapTagError(err);
  }
}
