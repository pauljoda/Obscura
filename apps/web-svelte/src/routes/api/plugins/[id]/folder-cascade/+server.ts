import { json, type RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async () => {
  return json({ error: "Folder cascade not yet implemented" }, { status: 501 });
};
