import { json, type RequestHandler } from "@sveltejs/kit";
import { mapInstalledPluginPackages } from "@obscura/app-core";
import { schema } from "@obscura/db";
import { getWebDb } from "$lib/server/db";

export const GET: RequestHandler = async () => {
  const db = await getWebDb();
  const [packageRows, authRows] = await Promise.all([
    db.select().from(schema.pluginPackages).orderBy(schema.pluginPackages.name),
    db.select().from(schema.pluginAuth),
  ]);

  return json(mapInstalledPluginPackages({ packageRows, authRows }));
};
