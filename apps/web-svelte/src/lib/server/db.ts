import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { createDbRuntime, schema } from "@obscura/db";
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

function resolveDatabaseUrl() {
  return env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

export async function getWebDb(): Promise<WebDatabase> {
  await runtime.configure(resolveDatabaseUrl());
  return runtime.getDatabase();
}

export async function getWebDbClient(): Promise<WebQueryClient> {
  await runtime.configure(resolveDatabaseUrl());
  return runtime.getClient();
}
