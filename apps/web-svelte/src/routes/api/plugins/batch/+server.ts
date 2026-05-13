import { json, type RequestHandler } from "@sveltejs/kit";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";
import { startPluginBatchJob } from "$lib/v1/server/plugin-batch-v1";

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as {
    pluginId?: string;
    action: string;
    entityType: string;
    entityIds: string[];
    autoAccept?: boolean;
    folderCascade?: boolean;
  };

  try {
    const job = await startPluginBatchJob(db, body);
    return json({ ok: true, jobId: job.jobId, status: job.status });
  } catch (error) {
    return mapAppCoreErrorToJson(error);
  }
};
