/**
 * Database migration runner.
 *
 * Uses drizzle-orm's migrator against the versioned SQL files committed
 * under `apps/api/drizzle/`. Each migration applies idempotently once,
 * tracked in `drizzle.__drizzle_migrations`.
 *
 * Obscura is pre-1.0. Breaking schema changes are allowed — they go
 * into CHANGELOG "What's New" and, when the drop is destructive enough
 * to warrant explicit consent, a single-purpose break-gate lives
 * alongside the migration (see `breaking-gate.ts`). We do not maintain
 * legacy-install bridges or a staging/finalize framework.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import {
  BreakingGateAwaitingConsentError,
  checkBreakingGate,
} from "./breaking-gate";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_FOLDER = path.resolve(__dirname, "../../drizzle");

export async function runMigrations(databaseUrl: string): Promise<void> {
  const gate = await checkBreakingGate(databaseUrl);
  if (gate.awaitingConsent) {
    throw new BreakingGateAwaitingConsentError(gate.reason);
  }

  const client = postgres(databaseUrl, { max: 1 });
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("[obscura migrate] Migrations up to date");
  } finally {
    await client.end();
  }
}

// CLI entrypoint — invoked from `pnpm --filter @obscura/api db:migrate`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const url =
    process.env.DATABASE_URL ??
    "postgres://obscura:obscura@localhost:5432/obscura";
  runMigrations(url)
    .then(() => process.exit(0))
    .catch((err) => {
      if (err instanceof BreakingGateAwaitingConsentError) {
        console.error(
          "[obscura migrate] Blocked by one-time breaking-upgrade gate.\n" +
            "Start the API server and accept the upgrade prompt in the\n" +
            "web UI before running migrations directly.",
        );
        process.exit(2);
      }
      console.error("[obscura migrate] FAILED:", err);
      process.exit(1);
    });
}
