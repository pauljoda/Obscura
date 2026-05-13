import { json, type RequestHandler } from "@sveltejs/kit";
import { uploadRootImageWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  const form = await request.formData();
  const files = form.getAll("file").filter((value): value is File => value instanceof File);
  if (files.length === 0) {
    return json({ error: "No file uploaded" }, { status: 400 });
  }
  if (files.length > 1) {
    return json(
      { error: "Only one file per upload request is supported" },
      { status: 400 },
    );
  }

  const libraryRootId =
    typeof form.get("libraryRootId") === "string"
      ? String(form.get("libraryRootId"))
      : null;
  if (!libraryRootId) {
    return json({ error: "libraryRootId field is required" }, { status: 400 });
  }

  const file = files[0]!;
  const input = {
    filename: file instanceof File && file.name ? file.name : "image-upload",
    mimetype: file.type,
    buffer: Buffer.from(await file.arrayBuffer()),
  };

  try {
    return json(await uploadRootImageWrite(db, libraryRootId, input));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
