/**
 * Database migration runner.
 *
 * Uses drizzle-orm's migrator against the versioned SQL files committed
 * under `packages/db/drizzle/`. Each migration applies idempotently once,
 * tracked in `drizzle.__drizzle_migrations`.
 *
 * Obscura is pre-1.0. Breaking schema changes are allowed — they go
 * into CHANGELOG "What's New". We do not maintain legacy-install
 * bridges or a staging/finalize framework.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_JOURNAL_PATH = path.join("meta", "_journal.json");

type ResolveMigrationsFolderOptions = {
  cwd?: string;
  env?: Partial<
    Record<"OBSCURA_DB_MIGRATIONS_DIR" | "OBSCURA_MIGRATIONS_DIR", string>
  >;
  exists?: (candidate: string) => boolean;
  moduleDir?: string;
};

function ancestors(start: string): string[] {
  const folders: string[] = [];
  let current = path.resolve(start);
  while (true) {
    folders.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      return folders;
    }
    current = parent;
  }
}

export function resolveMigrationsFolder(
  options: ResolveMigrationsFolderOptions = {},
): string {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const exists = options.exists ?? existsSync;
  const moduleDir = options.moduleDir ?? __dirname;
  const seen = new Set<string>();
  const candidates: string[] = [];

  const addCandidate = (candidate: string | undefined) => {
    if (!candidate) {
      return;
    }
    const resolved = path.resolve(candidate);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      candidates.push(resolved);
    }
  };

  addCandidate(env.OBSCURA_DB_MIGRATIONS_DIR ?? env.OBSCURA_MIGRATIONS_DIR);
  addCandidate(path.resolve(moduleDir, "../drizzle"));
  addCandidate(path.resolve(cwd, "packages/db/drizzle"));
  addCandidate(path.resolve(cwd, "../packages/db/drizzle"));
  addCandidate(path.resolve(cwd, "../../packages/db/drizzle"));

  for (const base of [...ancestors(cwd), ...ancestors(moduleDir)]) {
    addCandidate(path.join(base, "packages/db/drizzle"));
  }

  for (const candidate of candidates) {
    if (exists(path.join(candidate, MIGRATION_JOURNAL_PATH))) {
      return candidate;
    }
  }

  throw new Error(
    "[obscura migrate] Can't find Drizzle migrations journal. Checked:\n" +
      candidates.map((candidate) => `- ${candidate}`).join("\n"),
  );
}

export async function runMigrations(databaseUrl: string): Promise<void> {
  const client = postgres(databaseUrl, { max: 1 });
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: resolveMigrationsFolder() });
    console.log("[obscura migrate] Migrations up to date");
  } finally {
    await client.end();
  }
}

// CLI entrypoint — invoked from `pnpm --filter @obscura/db db:migrate`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const url =
    process.env.DATABASE_URL ??
    "postgres://obscura:obscura@localhost:5432/obscura";
  runMigrations(url)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[obscura migrate] FAILED:", err);
      process.exit(1);
    });
}
