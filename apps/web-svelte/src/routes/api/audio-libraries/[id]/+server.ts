import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteAudioLibraryWrite,
  getAudioLibraryDetailRead,
  updateAudioLibraryWrite,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ params, url }) => {
  const db = await getWebDb();
  try {
    return json(
      await getAudioLibraryDetailRead(db, params.id!, {
        trackLimit: url.searchParams.get("trackLimit") ?? undefined,
        trackOffset: url.searchParams.get("trackOffset") ?? undefined,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  try {
    return json(await updateAudioLibraryWrite(db, params.id!, await request.json()));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteAudioLibraryWrite(db, params.id!));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
