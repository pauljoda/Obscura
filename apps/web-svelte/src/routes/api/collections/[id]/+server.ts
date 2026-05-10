import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteCollectionWrite,
  getCollectionDetailRead,
  updateCollectionWrite,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ params, url }) => {
  const db = await getWebDb();
  const nsfw = url.searchParams.get("nsfw");
  try {
    return json(
      await getCollectionDetailRead(db, params.id!, {
        nsfw: nsfw === "on" || nsfw === "off" ? nsfw : undefined,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  try {
    return json(await updateCollectionWrite(db, params.id!, await request.json()));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteCollectionWrite(db, params.id!));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
