import { json, type RequestHandler } from "@sveltejs/kit";
import { createStashIdWrite, listStashIdsRead } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  try {
    return json(
      await listStashIdsRead(db, {
        entityType: url.searchParams.get("entityType") ?? undefined,
        entityId: url.searchParams.get("entityId") ?? undefined,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as {
    entityType: string;
    entityId: string;
    stashBoxEndpointId: string;
    stashId: string;
  };

  try {
    return json(await createStashIdWrite(db, body), { status: 201 });
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
