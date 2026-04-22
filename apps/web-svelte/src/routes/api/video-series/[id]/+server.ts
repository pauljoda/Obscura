import { json, type RequestHandler } from "@sveltejs/kit";
import {
  getVideoSeriesDetailRead,
  updateVideoSeriesWrite,
  type UpdateVideoSeriesBody,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ params, url }) => {
  const db = await getWebDb();
  const nsfw = url.searchParams.get("nsfw") ?? undefined;
  try {
    return json(await getVideoSeriesDetailRead(db, params.id!, nsfw));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as UpdateVideoSeriesBody;
  try {
    return json(await updateVideoSeriesWrite(db, params.id!, body));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
