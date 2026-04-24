import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deletePlaylistSessionWrite,
  getPlaylistSessionRead,
  setPlaylistSessionWrite,
} from "@obscura/app-core";
import type { PlaylistSessionWriteDto } from "@obscura/contracts";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async () => {
  const db = await getWebDb();
  return json(await getPlaylistSessionRead(db));
};

export const PUT: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  try {
    return json(
      await setPlaylistSessionWrite(
        db,
        (await request.json()) as PlaylistSessionWriteDto,
      ),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async () => {
  const db = await getWebDb();
  return json(await deletePlaylistSessionWrite(db));
};
