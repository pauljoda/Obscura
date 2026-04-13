import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import * as schema from "../../packages/db/src/schema.ts";
import { runMigrations } from "../../apps/api/src/db/migrate.ts";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export async function createPostgresTestContext() {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const connectionString = container.getConnectionUri();
  await runMigrations(connectionString);
  const queryClient = postgres(connectionString);
  const db = drizzle(queryClient, { schema });

  return {
    container,
    connectionString,
    queryClient,
    db,
    async close() {
      await queryClient.end({ timeout: 5 });
      await container.stop();
    },
  };
}
