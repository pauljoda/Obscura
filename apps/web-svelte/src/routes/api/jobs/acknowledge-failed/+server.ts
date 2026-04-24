import { json, type RequestHandler } from "@sveltejs/kit";
import { acknowledgeFailedJobsWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { readOptionalJsonObject } from "$lib/server/jobs-request";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  const body = await readOptionalJsonObject(request);
  try {
    return json(
      await acknowledgeFailedJobsWrite(db, {
        queueName: body.queueName as string | undefined,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
