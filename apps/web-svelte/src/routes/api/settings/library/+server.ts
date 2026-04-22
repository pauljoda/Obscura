import { json, type RequestHandler } from "@sveltejs/kit";
import { loadLibraryConfig } from "@obscura/app-core";
import { schema } from "@obscura/db";
import { asc } from "drizzle-orm";
import { getWebDb } from "$lib/server/db";
import { getStorageStats } from "$lib/server/library-storage";

export const GET: RequestHandler = async () => {
  const db = await getWebDb();

  const payload = await loadLibraryConfig({
    ensureSettings: async () => {
      const [existing] = await db.select().from(schema.librarySettings).limit(1);
      if (existing) return existing;
      const [created] = await db.insert(schema.librarySettings).values({}).returning();
      return created;
    },
    loadRoots: () =>
      db.select().from(schema.libraryRoots).orderBy(asc(schema.libraryRoots.path)),
    loadStorage: () => getStorageStats(),
  });

  return json(payload);
};
