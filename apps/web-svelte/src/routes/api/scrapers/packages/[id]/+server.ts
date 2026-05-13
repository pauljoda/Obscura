import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteScraperPackageWrite,
  updateScraperPackageWrite,
} from "@obscura/app-core/scraper-runtime";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

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
