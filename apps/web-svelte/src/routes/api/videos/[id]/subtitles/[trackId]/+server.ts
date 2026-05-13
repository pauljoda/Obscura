import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteSubtitleTrackWrite,
  readSubtitleVtt,
  updateSubtitleTrackWrite,
  type UpdateSubtitleBody,
} from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    const vtt = await readSubtitleVtt(db, params.id!, params.trackId!);
    return new Response(vtt, {
      headers: { "Content-Type": "text/vtt; charset=utf-8" },
    });
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as UpdateSubtitleBody;
  try {
    return json(
      await updateSubtitleTrackWrite(db, params.id!, params.trackId!, body),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(
      await deleteSubtitleTrackWrite(db, params.id!, params.trackId!),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
