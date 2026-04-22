/**
 * Video series service — thin Fastify shim around @obscura/app-core helpers.
 */
import type { MultipartFile } from "@fastify/multipart";
import {
  deleteVideoSeriesCoverWrite,
  getVideoSeriesDetailRead,
  listVideoSeriesRead,
  NotFoundError,
  setVideoSeriesCoverFromUrlWrite,
  updateVideoSeriesWrite,
  UpstreamError,
  uploadVideoSeriesCoverWrite,
  ValidationError,
  type CoverKind,
  type ListVideoSeriesQuery,
  type UpdateVideoSeriesBody,
} from "@obscura/app-core";
import { db } from "../db";
import { AppError } from "../plugins/error-handler";

export type { CoverKind, UpdateVideoSeriesBody };

function mapError(err: unknown): never {
  if (err instanceof NotFoundError) throw new AppError(404, err.message);
  if (err instanceof ValidationError) throw new AppError(400, err.message);
  if (err instanceof UpstreamError) throw new AppError(502, err.message);
  throw err;
}

export async function listVideoSeries(query: ListVideoSeriesQuery) {
  return listVideoSeriesRead(db, query);
}

export async function getVideoSeriesDetail(id: string, nsfwMode?: string) {
  try {
    return await getVideoSeriesDetailRead(db, id, nsfwMode);
  } catch (err) {
    mapError(err);
  }
}

export async function updateVideoSeries(id: string, patch: UpdateVideoSeriesBody) {
  try {
    return await updateVideoSeriesWrite(db, id, patch);
  } catch (err) {
    mapError(err);
  }
}

export async function uploadVideoSeriesCover(
  id: string,
  kind: CoverKind,
  file: MultipartFile,
) {
  const buffer = await file.toBuffer();
  try {
    return await uploadVideoSeriesCoverWrite(db, id, kind, buffer);
  } catch (err) {
    mapError(err);
  }
}

export async function setVideoSeriesCoverFromUrl(
  id: string,
  kind: CoverKind,
  imageUrl: string,
) {
  try {
    return await setVideoSeriesCoverFromUrlWrite(db, id, kind, imageUrl);
  } catch (err) {
    mapError(err);
  }
}

export async function deleteVideoSeriesCover(id: string, kind: CoverKind) {
  try {
    return await deleteVideoSeriesCoverWrite(db, id, kind);
  } catch (err) {
    mapError(err);
  }
}
