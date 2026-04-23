import { json, type RequestHandler } from "@sveltejs/kit";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";
import { startPluginBatchJob } from "$lib/server/plugin-batch";

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
