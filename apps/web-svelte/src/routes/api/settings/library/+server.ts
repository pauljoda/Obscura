import { json, type RequestHandler } from "@sveltejs/kit";
import {
  loadLibraryConfig,
  updateLibrarySettingsWrite,
  type LibrarySettingsWritePayload,
} from "@obscura/app-core";
import { schema } from "@obscura/db";
import { asc } from "drizzle-orm";
import { getWebDb } from "$lib/v1/server/db-v1";

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
  });

  return json(payload);
};

export const PUT: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as LibrarySettingsWritePayload;
  const updated = await updateLibrarySettingsWrite(db, body);
  return json(updated);
};
