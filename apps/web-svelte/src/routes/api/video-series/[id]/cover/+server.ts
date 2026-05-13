import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteVideoSeriesCoverWrite,
  uploadVideoSeriesCoverWrite,
} from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return json({ error: "No file uploaded" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    return json(await uploadVideoSeriesCoverWrite(db, params.id!, "cover", buffer));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteVideoSeriesCoverWrite(db, params.id!, "cover"));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
