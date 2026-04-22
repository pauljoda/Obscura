import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteVideoSeriesCoverWrite,
  uploadVideoSeriesCoverWrite,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return json({ error: "No file uploaded" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    return json(
      await uploadVideoSeriesCoverWrite(db, params.id!, "backdrop", buffer),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(
      await deleteVideoSeriesCoverWrite(db, params.id!, "backdrop"),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
