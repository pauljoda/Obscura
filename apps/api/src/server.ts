import { runMigrations } from "./db/migrate";
import { closeDatabase, configureDatabase } from "./db";
import { initQueues, stopQueues } from "./lib/queues";
import { buildApiApp, type ApiTestDeps } from "./app";

const DEFAULT_DATABASE_URL =
  "postgres://obscura:obscura@localhost:5432/obscura";

export async function startApiServer(deps: ApiTestDeps = {}) {
  const databaseUrl = deps.databaseUrl ?? process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  await configureDatabase({ connectionString: databaseUrl });
  await runMigrations(databaseUrl);
  await initQueues();

  const app = await buildApiApp({
    ...deps,
    databaseUrl,
    logger: deps.logger ?? true,
  });

  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";

  await app.listen({ port, host });

  let closing: Promise<void> | null = null;
  const close = async () => {
    if (!closing) {
      closing = (async () => {
        await stopQueues();
        await app.close();
        await closeDatabase();
      })();
    }
    await closing;
  };

  return { app, close };
}
