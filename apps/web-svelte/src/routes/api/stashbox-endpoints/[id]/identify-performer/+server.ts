import { json, type RequestHandler } from "@sveltejs/kit";
import { identifyPerformerViaStashBoxWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as { performerId: string };

  try {
    return json(
      await identifyPerformerViaStashBoxWrite(db, {
        endpointId: params.id!,
        performerId: body.performerId,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
