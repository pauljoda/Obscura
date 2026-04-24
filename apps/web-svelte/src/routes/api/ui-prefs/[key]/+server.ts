import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteUiPrefWrite,
  getUiPrefRead,
  setUiPrefWrite,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    const row = await getUiPrefRead(db, params.key!);
    return json(row ?? { key: params.key, value: null });
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const PUT: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  try {
    const body = (await request.json()) as { value: unknown };
    return json(await setUiPrefWrite(db, params.key!, body.value));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteUiPrefWrite(db, params.key!));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
