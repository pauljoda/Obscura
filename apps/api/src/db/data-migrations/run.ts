import { dataMigrationsRegistry } from "./registry";
import type {
  DataMigration,
  DataMigrationClient,
  DataMigrationContext,
  DataMigrationRow,
  DataMigrationStatus,
} from "./types";

function makeContext(client: DataMigrationClient): DataMigrationContext {
  return {
    client,
    logger: {
      info: (msg, meta) => console.log(`[data-migration] ${msg}`, meta ?? {}),
      warn: (msg, meta) =>
        console.warn(`[data-migration] ${msg}`, meta ?? {}),
      error: (msg, meta) =>
        console.error(`[data-migration] ${msg}`, meta ?? {}),
    },
    reportProgress: (pct, message) => {
      console.log(
        `[data-migration] progress=${pct}${message ? ` ${message}` : ""}`,
      );
    },
  };
}

async function ensureRow(
  client: DataMigrationClient,
  migration: DataMigration,
): Promise<DataMigrationRow> {
  const existing = await client<DataMigrationRow[]>`
    SELECT
      name,
      status,
      staged_at      AS "stagedAt",
      finalized_at   AS "finalizedAt",
      failed_at      AS "failedAt",
      last_error     AS "lastError",
      metrics,
      created_at     AS "createdAt",
      updated_at     AS "updatedAt"
    FROM data_migrations
    WHERE name = ${migration.name}
  `;
  if (existing.length > 0) return existing[0];

  // Race-safe insert: a concurrent process may have inserted this row
  // between our SELECT and INSERT. ON CONFLICT DO NOTHING swallows the
  // unique-constraint violation; we re-SELECT if RETURNING comes back
  // empty.
  const inserted = await client<DataMigrationRow[]>`
    INSERT INTO data_migrations (name, status, metrics)
    VALUES (${migration.name}, 'pending', '{}'::jsonb)
    ON CONFLICT (name) DO NOTHING
    RETURNING
      name,
      status,
      staged_at      AS "stagedAt",
      finalized_at   AS "finalizedAt",
      failed_at      AS "failedAt",
      last_error     AS "lastError",
      metrics,
      created_at     AS "createdAt",
      updated_at     AS "updatedAt"
  `;
  if (inserted.length > 0) return inserted[0];

  const afterRace = await client<DataMigrationRow[]>`
    SELECT
      name,
      status,
      staged_at      AS "stagedAt",
      finalized_at   AS "finalizedAt",
      failed_at      AS "failedAt",
      last_error     AS "lastError",
      metrics,
      created_at     AS "createdAt",
      updated_at     AS "updatedAt"
    FROM data_migrations
    WHERE name = ${migration.name}
  `;
  if (afterRace.length === 0) {
    throw new Error(
      `Failed to ensure data_migrations row for ${migration.name}`,
    );
  }
  return afterRace[0];
}

async function setStatus(
  client: DataMigrationClient,
  name: string,
  patch: {
    status: DataMigrationStatus;
    metrics?: Record<string, unknown>;
    stagedAt?: Date;
    finalizedAt?: Date;
    failedAt?: Date;
    lastError?: string | null;
  },
): Promise<void> {
  // postgres-js's parameter binding struggles with conditional Date
  // values inside COALESCE, so we issue separate UPDATE statements for
  // each field that's actually present in the patch. This is chatty but
  // rock-solid across driver versions.
  await client`
    UPDATE data_migrations
    SET status = ${patch.status}, updated_at = now()
    WHERE name = ${name}
  `;
  if (patch.metrics !== undefined) {
    const metricsJson = JSON.stringify(patch.metrics);
    await client`
      UPDATE data_migrations
      SET metrics = ${metricsJson}::jsonb, updated_at = now()
      WHERE name = ${name}
    `;
  }
  if (patch.stagedAt !== undefined) {
    const iso = patch.stagedAt.toISOString();
    await client`
      UPDATE data_migrations
      SET staged_at = ${iso}::timestamp, updated_at = now()
      WHERE name = ${name}
    `;
  }
  if (patch.finalizedAt !== undefined) {
    const iso = patch.finalizedAt.toISOString();
    await client`
      UPDATE data_migrations
      SET finalized_at = ${iso}::timestamp, updated_at = now()
      WHERE name = ${name}
    `;
  }
  if (patch.failedAt !== undefined) {
    const iso = patch.failedAt.toISOString();
    await client`
      UPDATE data_migrations
      SET failed_at = ${iso}::timestamp, updated_at = now()
      WHERE name = ${name}
    `;
  }
  if (patch.lastError !== undefined) {
    await client`
      UPDATE data_migrations
      SET last_error = ${patch.lastError}, updated_at = now()
      WHERE name = ${name}
    `;
  }
}

export interface StageBootReport {
  name: string;
  status: DataMigrationStatus;
  description: string;
}

/**
 * Runs all registered migrations to the `staged` state (or skips them
 * if already staged/complete). Called from runMigrations() after the
 * drizzle migrator finishes. Never runs finalize() — that only happens
 * via the /system/migrations/:name/finalize endpoint.
 *
 * Returns a report the caller can use to log boot status. Does not
 * throw for individual migration failures — they're recorded as
 * `failed` and the boot continues in a degraded state.
 */
export async function runStagedMigrations(
  client: DataMigrationClient,
): Promise<StageBootReport[]> {
  const report: StageBootReport[] = [];

  for (const migration of dataMigrationsRegistry) {
    const row = await ensureRow(client, migration);
    const ctx = makeContext(client);

    if (row.status === "complete") {
      report.push({
        name: migration.name,
        status: "complete",
        description: migration.description,
      });
      continue;
    }

    if (row.status === "staged") {
      ctx.logger.info(
        `migration ${migration.name} is staged and awaiting finalize`,
      );
      report.push({
        name: migration.name,
        status: "staged",
        description: migration.description,
      });
      continue;
    }

    if (row.status === "failed") {
      ctx.logger.error(
        `migration ${migration.name} is in failed state — skipping`,
        { lastError: row.lastError },
      );
      report.push({
        name: migration.name,
        status: "failed",
        description: migration.description,
      });
      continue;
    }

    if (row.status === "pending" || row.status === "staging") {
      const lockRows = await client<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_lock(hashtext(${migration.name})) AS locked
      `;
      if (!lockRows[0]?.locked) {
        ctx.logger.info(
          `migration ${migration.name} is being staged by another process — skipping on this boot`,
        );
        report.push({
          name: migration.name,
          status: row.status,
          description: migration.description,
        });
        continue;
      }

      try {
        if (migration.precheck) {
          const precheck = await migration.precheck(ctx);
          if (!precheck.ok) {
            ctx.logger.info(
              `migration ${migration.name} precheck failed — skipping`,
              { reasons: precheck.reasons },
            );
            report.push({
              name: migration.name,
              status: "pending",
              description: migration.description,
            });
            continue;
          }
        }

        await setStatus(client, migration.name, { status: "staging" });
        try {
          const result = await client.begin(async (tx) => {
            return migration.stage({
              ...ctx,
              client: tx as unknown as DataMigrationClient,
            });
          });
          await setStatus(client, migration.name, {
            status: "staged",
            metrics: result.metrics,
            stagedAt: new Date(),
            lastError: null,
          });
          ctx.logger.info(`migration ${migration.name} staged`, result.metrics);
          report.push({
            name: migration.name,
            status: "staged",
            description: migration.description,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          try {
            await setStatus(client, migration.name, {
              status: "failed",
              failedAt: new Date(),
              lastError: message,
            });
          } catch (statusErr) {
            ctx.logger.error(
              `failed to record stage failure for ${migration.name}`,
              { statusErr },
            );
          }
          ctx.logger.error(`migration ${migration.name} stage() threw`, {
            message,
          });
          report.push({
            name: migration.name,
            status: "failed",
            description: migration.description,
          });
        }
      } finally {
        await client`SELECT pg_advisory_unlock(hashtext(${migration.name}))`;
      }
    }
  }

  return report;
}

/**
 * Runs the finalize phase for a single named migration. Called from
 * the /system/migrations/:name/finalize route handler. Throws on
 * missing/invalid state — the caller translates that into an HTTP error.
 */
export async function finalizeMigration(
  client: DataMigrationClient,
  name: string,
): Promise<void> {
  const migration = dataMigrationsRegistry.find((m) => m.name === name);
  if (!migration) {
    throw new Error(`Unknown migration: ${name}`);
  }
  const claimed = await client<Array<{ status: DataMigrationStatus }>>`
    UPDATE data_migrations
    SET status = 'finalizing', updated_at = now()
    WHERE name = ${name} AND status = 'staged'
    RETURNING status
  `;
  if (claimed.length === 0) {
    // Either the row doesn't exist, or it's not in 'staged'. Read
    // current status so the caller gets an informative error.
    const existing = await client<Array<{ status: DataMigrationStatus }>>`
      SELECT status FROM data_migrations WHERE name = ${name}
    `;
    if (existing.length === 0) {
      throw new Error(`Migration row not found: ${name}`);
    }
    throw new Error(
      `Migration ${name} is in status ${existing[0].status}, cannot finalize`,
    );
  }

  const ctx = makeContext(client);
  try {
    const result = await client.begin(async (tx) => {
      return migration.finalize({
        ...ctx,
        client: tx as unknown as DataMigrationClient,
      });
    });
    await setStatus(client, name, {
      status: "complete",
      metrics: result.metrics,
      finalizedAt: new Date(),
      lastError: null,
    });
    ctx.logger.info(`migration ${name} finalized`, result.metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await setStatus(client, name, {
        status: "failed",
        failedAt: new Date(),
        lastError: message,
      });
    } catch (statusErr) {
      ctx.logger.error(
        `failed to record finalize failure for ${name}`,
        { statusErr },
      );
    }
    throw err;
  }
}

/**
 * Returns the current status of every registered migration for use by
 * the /system/status endpoint. Never throws.
 */
export async function getMigrationStatuses(
  client: DataMigrationClient,
): Promise<StageBootReport[]> {
  const rows = await client<Array<{ name: string; status: DataMigrationStatus }>>`
    SELECT name, status FROM data_migrations
  `;
  const byName = new Map(rows.map((r) => [r.name, r.status]));
  return dataMigrationsRegistry.map((m) => ({
    name: m.name,
    description: m.description,
    status: byName.get(m.name) ?? "pending",
  }));
}
