import { json, type RequestHandler } from "@sveltejs/kit";
import { deleteTagImageWrite, uploadTagImageWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapTagErrorToJson } from "$lib/server/tag-error-mapper";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return json({ error: "No file uploaded" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    return json(await uploadTagImageWrite(db, params.id!, buffer));
  } catch (err) {
    return mapTagErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteTagImageWrite(db, params.id!));
  } catch (err) {
    return mapTagErrorToJson(err);
  }
};
