import type { DataMigrationClient, DataMigrationStatus } from "./types";

export interface LockdownStatus {
  /** True when a registered migration is in `staged` or `finalizing` state. */
  active: boolean;
  /** The name of the first migration that caused the lockdown, if active. */
  blockedBy: string | null;
  /** The status of that blocking migration. */
  blockingStatus: DataMigrationStatus | null;
}

/**
 * Check the `data_migrations` table for any migration in a state that
 * should block video writes. Reads are permitted during all states.
 *
 * This function is cheap (single indexed query) and safe to call from
 * route handlers on every write request.
 */
export async function getLockdownStatus(
  client: DataMigrationClient,
): Promise<LockdownStatus> {
  const rows = await client<
    Array<{ name: string; status: DataMigrationStatus }>
  >`
    SELECT name, status
    FROM data_migrations
    WHERE status IN ('staged', 'finalizing', 'staging')
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) {
    return { active: false, blockedBy: null, blockingStatus: null };
  }
  return {
    active: true,
    blockedBy: rows[0].name,
    blockingStatus: rows[0].status,
  };
}

/**
 * Throws a standard error with a machine-readable `.code` property if
 * video writes are currently locked down. Route handlers should call
 * this at the top of any write path that touches video entities.
 *
 * Example:
 *   await assertNotLockedDown(client);
 *   await writeTheThing(...);
 */
export async function assertNotLockedDown(
  client: DataMigrationClient,
): Promise<void> {
  const status = await getLockdownStatus(client);
  if (!status.active) return;
  const err = new Error(
    `Video writes are temporarily disabled while migration "${status.blockedBy}" is ${status.blockingStatus}.`,
  );
  (err as Error & { code?: string }).code = "MIGRATION_LOCKDOWN";
  throw err;
}
