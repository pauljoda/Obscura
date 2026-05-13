import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteBookChapterCoverWrite,
  setBookChapterCoverPageWrite,
} from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as { pageId?: string };
  try {
    if (!body.pageId) {
      return json({ error: "pageId is required" }, { status: 400 });
    }
    return json(await setBookChapterCoverPageWrite(db, params.id!, body.pageId));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteBookChapterCoverWrite(db, params.id!));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
