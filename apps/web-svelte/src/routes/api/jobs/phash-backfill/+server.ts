import { json, type RequestHandler } from "@sveltejs/kit";
import { backfillPhashesWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import {
  readOptionalJsonObject,
  readSfwOnlyFromRequest,
} from "$lib/server/jobs-request";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  const body = await readOptionalJsonObject(request);
  try {
    return json(
      await backfillPhashesWrite(db, {
        sfwOnly: readSfwOnlyFromRequest(request, body),
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
