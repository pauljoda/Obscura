import { json, type RequestHandler } from "@sveltejs/kit";
import { mapStashBoxEndpointList } from "@obscura/app-core";
import { schema } from "@obscura/db";
import { getWebDb } from "$lib/server/db";

export const GET: RequestHandler = async () => {
  const db = await getWebDb();
  const rows = await db
    .select()
    .from(schema.stashBoxEndpoints)
    .orderBy(schema.stashBoxEndpoints.name);
  return json(mapStashBoxEndpointList(rows));
};
