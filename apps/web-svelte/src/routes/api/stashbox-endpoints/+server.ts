import { json, type RequestHandler } from "@sveltejs/kit";
import {
  createStashBoxEndpointWrite,
  mapStashBoxEndpointList,
} from "@obscura/app-core";
import { schema } from "@obscura/db";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async () => {
  const db = await getWebDb();
  const rows = await db
    .select()
    .from(schema.stashBoxEndpoints)
    .orderBy(schema.stashBoxEndpoints.name);
  return json(mapStashBoxEndpointList(rows));
};

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as {
    name: string;
    endpoint: string;
    apiKey: string;
  };

  try {
    return json(await createStashBoxEndpointWrite(db, body), { status: 201 });
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
