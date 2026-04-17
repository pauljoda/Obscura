import Fastify from "fastify";
import cors from "@fastify/cors";
import { runMigrations } from "./db/migrate";
import {
  BreakingGateAwaitingConsentError,
  checkBreakingGate,
} from "./db/breaking-gate";
import { closeDatabase, configureDatabase } from "./db";
import { initQueues, stopQueues } from "./lib/queues";
import { buildApiApp, type ApiTestDeps } from "./app";
import { breakingGateRoutes } from "./routes/system";

const DEFAULT_DATABASE_URL =
  "postgres://obscura:obscura@localhost:5432/obscura";

export async function startApiServer(deps: ApiTestDeps = {}) {
  const databaseUrl =
    deps.databaseUrl ?? process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  await configureDatabase({ connectionString: databaseUrl });

  const gate = await checkBreakingGate(databaseUrl);
  if (gate.awaitingConsent) {
    return startGateServer(gate.reason);
  }

  try {
    await runMigrations(databaseUrl);
  } catch (err) {
    if (err instanceof BreakingGateAwaitingConsentError) {
      return startGateServer(err.message);
    }
    throw err;
  }
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

async function startGateServer(reason: string) {
  console.log(
    `[obscura] Breaking-upgrade gate active: ${reason}. Serving consent prompt only.`,
  );
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: true,
    methods: ["GET", "HEAD", "POST", "OPTIONS"],
  });
  app.get("/health", async () => ({ status: "gate", service: "api" }));
  await app.register(breakingGateRoutes);

  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";
  await app.listen({ port, host });

  return {
    app,
    close: async () => {
      await app.close();
      await closeDatabase();
    },
  };
}
