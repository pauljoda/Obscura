import { json, type RequestHandler } from "@sveltejs/kit";
import { cancelJobRunWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const POST: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(
      await cancelJobRunWrite(db, {
        jobRunId: params.jobRunId!,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
