import { json, type RequestHandler } from "@sveltejs/kit";
import {
  listSubtitleTracksRead,
  uploadSubtitleWrite,
  type UploadSubtitleInput,
} from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    const tracks = await listSubtitleTracksRead(db, params.id!);
    return json({ tracks });
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return json({ error: "file is required" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const input: UploadSubtitleInput = {
    filename:
      file instanceof File && file.name ? file.name : "subtitle",
    buffer,
    language:
      typeof form.get("language") === "string"
        ? (form.get("language") as string)
        : undefined,
    label:
      typeof form.get("label") === "string"
        ? (form.get("label") as string)
        : null,
  };
  try {
    return json(await uploadSubtitleWrite(db, params.id!, input));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
