import { json, type RequestHandler } from "@sveltejs/kit";
import { lookupStudioViaStashBoxWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as { query: string };

  try {
    return json(
      await lookupStudioViaStashBoxWrite(db, {
        endpointId: params.id!,
        query: body.query,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
