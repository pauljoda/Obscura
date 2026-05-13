import { json, type RequestHandler } from "@sveltejs/kit";
import { uploadImageWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return json({ error: "No file uploaded" }, { status: 400 });
  }

  try {
    return json(
      await uploadImageWrite(db, params.id!, {
        filename: file instanceof File && file.name ? file.name : "image-upload",
        mimetype: file.type,
        buffer: Buffer.from(await file.arrayBuffer()),
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
