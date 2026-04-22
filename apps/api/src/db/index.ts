import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createDbRuntime } from "@obscura/db";
import * as schema from "./schema";

const DEFAULT_DATABASE_URL =
  "postgres://obscura:obscura@localhost:5432/obscura";

export type ApiQueryClient = ReturnType<typeof postgres>;
export type ApiDatabase = ReturnType<typeof drizzle<typeof schema>>;

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

const runtime = createDbRuntime<ApiQueryClient, ApiDatabase>({
  createQueryClient: (url) => postgres(url),
  createDatabase: (client) => drizzle(client, { schema }),
  closeQueryClient: (client) => client.end({ timeout: 5 }),
});

// Eagerly configure with the default/env connection so legacy `db` /
// `queryClient` exports are usable synchronously at import time.
function syncConfigure(connectionString: string) {
  // `configure` is async only because of optional previous-client cleanup.
  // The first call has no previous client, so we can safely discard the
  // returned promise — nothing awaits close here.
  void runtime.configure(connectionString);
}

syncConfigure(resolveDatabaseUrl());

export let queryClient: ApiQueryClient = runtime.getClient();
export let db: ApiDatabase = runtime.getDatabase();

export async function configureDatabase(options?: {
  connectionString?: string;
}): Promise<void> {
  const nextConnectionString = options?.connectionString ?? resolveDatabaseUrl();
  if (nextConnectionString === runtime.getConnectionString()) {
    return;
  }

  await runtime.configure(nextConnectionString);
  queryClient = runtime.getClient();
  db = runtime.getDatabase();
}

export async function closeDatabase(): Promise<void> {
  await runtime.close();
}

export function getDatabaseUrl() {
  return runtime.getConnectionString() ?? resolveDatabaseUrl();
}

/**
 * Returns the raw `postgres` client backing the current database state.
 * Prefer this over importing `queryClient` directly when you need the
 * raw client inside long-lived code (e.g. route handlers), because
 * `configureDatabase()` can swap the underlying instance and a captured
 * reference would go stale.
 */
export function getDatabaseClient(): ApiQueryClient {
  return runtime.getClient();
}

export { schema };
