import {
  createSearchProviders,
  type SearchProvider,
} from "@obscura/app-core";
import type { EntityKind } from "@obscura/contracts";
import { getWebDb } from "./db";

let cached: {
  db: unknown;
  providers: Map<EntityKind, SearchProvider>;
} | null = null;

export async function getSearchProviders(): Promise<
  Map<EntityKind, SearchProvider>
> {
  const db = await getWebDb();
  if (cached?.db === db) return cached.providers;
  const providers = createSearchProviders(db);
  cached = { db, providers };
  return providers;
}
