import { json, type RequestHandler } from "@sveltejs/kit";
import { lookupTagViaStashBoxWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as { query: string };

  try {
    return json(
      await lookupTagViaStashBoxWrite(db, {
        endpointId: params.id!,
        query: body.query,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
