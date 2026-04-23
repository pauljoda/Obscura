import { json, type RequestHandler } from "@sveltejs/kit";
import {
  installScraperPackageWrite,
  mapInstalledScraperPackages,
} from "@obscura/app-core";
import { schema } from "@obscura/db";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async () => {
  const db = await getWebDb();
  const packages = await db
    .select()
    .from(schema.scraperPackages)
    .orderBy(schema.scraperPackages.name);
  return json(mapInstalledScraperPackages(packages));
};

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as {
    packageId: string;
    zipUrl?: string;
    sha256?: string;
  };

  try {
    return json(await installScraperPackageWrite(db, body));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
