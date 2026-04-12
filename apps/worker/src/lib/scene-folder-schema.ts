import { sql } from "drizzle-orm";
import { db } from "./db.js";

const SCHEMA_CACHE_MS = 5_000;

let cachedValue: boolean | null = null;
let cacheExpiresAt = 0;
let inflightProbe: Promise<boolean> | null = null;

async function probeSceneFolderSchema() {
  const rows = await db.execute<{
    hasSceneFolders: boolean;
    hasSceneFolderColumn: boolean;
  }>(sql`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'scene_folders'
      ) AS "hasSceneFolders",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'scenes'
          AND column_name = 'scene_folder_id'
      ) AS "hasSceneFolderColumn"
  `);
  const row = (
    rows as unknown as Array<{
      hasSceneFolders: boolean;
      hasSceneFolderColumn: boolean;
    }>
  )[0];
  return Boolean(row?.hasSceneFolders && row?.hasSceneFolderColumn);
}

export async function hasSceneFolderSchema() {
  const now = Date.now();
  if (cachedValue !== null && now < cacheExpiresAt) {
    return cachedValue;
  }

  if (!inflightProbe) {
    inflightProbe = probeSceneFolderSchema()
      .then((available) => {
        cachedValue = available;
        cacheExpiresAt = Date.now() + SCHEMA_CACHE_MS;
        return available;
      })
      .finally(() => {
        inflightProbe = null;
      });
  }

  return inflightProbe;
}
