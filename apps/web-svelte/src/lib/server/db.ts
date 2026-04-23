import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { createDbRuntime, runMigrations, schema } from "@obscura/db";
import { env } from "$env/dynamic/private";

type WebQueryClient = ReturnType<typeof postgres>;
type WebDatabase = ReturnType<typeof drizzle<typeof schema>>;

const DEFAULT_DATABASE_URL =
  "postgres://obscura:obscura@localhost:5432/obscura";

const runtime = createDbRuntime<WebQueryClient, WebDatabase>({
  createQueryClient: (url) => postgres(url),
  createDatabase: (client) => drizzle(client, { schema }),
  closeQueryClient: (client) => client.end({ timeout: 5 }),
});
let migrationsPromise: Promise<void> | null = null;

function resolveDatabaseUrl() {
  return env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

async function ensureDatabaseReady() {
  const databaseUrl = resolveDatabaseUrl();
  await runtime.configure(databaseUrl);
  migrationsPromise ??= runMigrations(databaseUrl);
  await migrationsPromise;
}

export async function getWebDb(): Promise<WebDatabase> {
  await ensureDatabaseReady();
  return runtime.getDatabase();
}

export async function getWebDbClient(): Promise<WebQueryClient> {
  await ensureDatabaseReady();
  return runtime.getClient();
}
