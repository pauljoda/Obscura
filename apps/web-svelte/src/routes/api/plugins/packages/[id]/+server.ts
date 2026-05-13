import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deletePluginPackageWrite,
  setPluginPackageEnabledWrite,
} from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as { enabled: boolean };

  try {
    return json(await setPluginPackageEnabledWrite(db, params.id!, body.enabled));
  } catch (error) {
    return mapAppCoreErrorToJson(error);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();

  try {
    return json(await deletePluginPackageWrite(db, params.id!));
  } catch (error) {
    return mapAppCoreErrorToJson(error);
  }
};
