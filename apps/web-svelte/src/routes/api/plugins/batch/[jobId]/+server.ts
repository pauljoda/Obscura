import { json, type RequestHandler } from "@sveltejs/kit";
import { getPluginBatchJobStatus } from "$lib/server/plugin-batch";

export const GET: RequestHandler = async ({ params }) => {
  const job = getPluginBatchJobStatus(params.jobId!);
  if (!job) {
    return json({ error: "Plugin batch job not found" }, { status: 404 });
  }
  return json(job);
};
