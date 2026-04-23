import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteScraperPackageWrite,
  updateScraperPackageWrite,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteScraperPackageWrite(db, { id: params.id! }));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as { enabled?: boolean };

  try {
    return json(
      await updateScraperPackageWrite(db, {
        id: params.id!,
        enabled: body.enabled,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
