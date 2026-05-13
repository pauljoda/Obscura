import { json, type RequestHandler } from "@sveltejs/kit";
import { getPluginBatchJobStatus } from "$lib/v1/server/plugin-batch-v1";

export const GET: RequestHandler = async ({ params }) => {
  const job = getPluginBatchJobStatus(params.jobId!);
  if (!job) {
    return json({ error: "Plugin batch job not found" }, { status: 404 });
  }
  return json(job);
};
