import { writeGateMarker } from "@obscura/app-core";
import { json, type RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async () => {
  await writeGateMarker();
  setTimeout(() => process.exit(0), 250);
  return json({ ok: true });
};
