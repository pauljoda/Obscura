import { json, type RequestHandler } from "@sveltejs/kit";
import { createTagWrite, listTagsRead, type CreateTagBody } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapTagErrorToJson } from "$lib/server/tag-error-mapper";

export const GET: RequestHandler = async ({ url }) => {
  const sfwOnly = url.searchParams.get("nsfw") === "off";
  const db = await getWebDb();
  return json(await listTagsRead(db, sfwOnly));
};

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as CreateTagBody;
  try {
    const created = await createTagWrite(db, body);
    return json(created, { status: 201 });
  } catch (err) {
    return mapTagErrorToJson(err);
  }
};
