import { json, type RequestHandler } from "@sveltejs/kit";
import { mapInstalledScraperPackages } from "@obscura/app-core";
import { schema } from "@obscura/db";
import { getWebDb } from "$lib/server/db";

export const GET: RequestHandler = async () => {
  const db = await getWebDb();
  const packages = await db
    .select()
    .from(schema.scraperPackages)
    .orderBy(schema.scraperPackages.name);
  return json(mapInstalledScraperPackages(packages));
};
