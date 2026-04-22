import { json, type RequestHandler } from "@sveltejs/kit";
import {
  addCollectionItemsWrite,
  getCollectionItemsRead,
  removeCollectionItemsWrite,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ params, url }) => {
  const db = await getWebDb();
  const limit = Number(url.searchParams.get("limit"));
  const offset = Number(url.searchParams.get("offset"));
  const entityType = url.searchParams.get("entityType");
  try {
    return json(
      await getCollectionItemsRead(db, params.id!, {
        limit: Number.isFinite(limit) ? limit : undefined,
        offset: Number.isFinite(offset) ? offset : undefined,
        entityType:
          entityType === "video" ||
          entityType === "gallery" ||
          entityType === "image" ||
          entityType === "audio-track"
            ? entityType
            : undefined,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  try {
    return json(await addCollectionItemsWrite(db, params.id!, await request.json()), {
      status: 201,
    });
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  try {
    return json(await removeCollectionItemsWrite(db, params.id!, await request.json()));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
