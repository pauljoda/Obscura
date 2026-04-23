import { json, type RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async () => {
  return json({ error: "Batch status not yet implemented" }, { status: 501 });
};
