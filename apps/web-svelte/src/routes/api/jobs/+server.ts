import { json, type RequestHandler } from "@sveltejs/kit";
import { getJobsDashboardRead } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";

function readSfwOnly(request: Request, url: URL): boolean {
  if (url.searchParams.get("nsfw") === "off") return true;
  const header = request.headers.get("x-obscura-nsfw-mode");
  return header === "off";
}

export const GET: RequestHandler = async ({ request, url }) => {
  const db = await getWebDb();
  const sfwOnly = readSfwOnly(request, url);
  return json(await getJobsDashboardRead(db, sfwOnly));
};
