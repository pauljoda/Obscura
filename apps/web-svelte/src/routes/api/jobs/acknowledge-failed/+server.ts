import { json, type RequestHandler } from "@sveltejs/kit";
import { acknowledgeFailedJobsWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { readOptionalJsonObject } from "$lib/v1/server/jobs-request-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

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
