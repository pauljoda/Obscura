import { json, type RequestHandler } from "@sveltejs/kit";
import { installPluginPackageWrite, mapInstalledPluginPackages } from "@obscura/app-core";
import { schema } from "@obscura/db";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async () => {
  const db = await getWebDb();
  const [packageRows, authRows] = await Promise.all([
    db.select().from(schema.pluginPackages).orderBy(schema.pluginPackages.name),
    db.select().from(schema.pluginAuth),
  ]);

  return json(mapInstalledPluginPackages({ packageRows, authRows }));
};

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();

  try {
    return json(await installPluginPackageWrite(db, await request.json()));
  } catch (error) {
    return mapAppCoreErrorToJson(error);
  }
};
