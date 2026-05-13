import { json, type RequestHandler } from "@sveltejs/kit";
import { uploadGalleryCoverWrite } from "@obscura/app-core";
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
      await uploadGalleryCoverWrite(
        db,
        params.id!,
        Buffer.from(await file.arrayBuffer()),
      ),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
