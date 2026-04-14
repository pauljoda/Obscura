import type { WorkerQueryClient } from "./db";

export type DataMigrationStatus =
  | "pending"
  | "precheck_failed"
  | "staging"
  | "staged"
  | "finalizing"
  | "finalized"
  | "rolled_back"
  | "failed";

export interface LockdownStatus {
  /** True when a registered migration is in a staging/staged/finalizing state. */
  active: boolean;
  /** The name of the first migration that caused the lockdown, if active. */
  blockedBy: string | null;
  /** The status of that blocking migration. */
  blockingStatus: DataMigrationStatus | null;
}

/**
 * Worker-local mirror of `apps/api/src/db/data-migrations/lockdown.ts`.
 * The worker is not a workspace consumer of `@obscura/api`, so we keep
 * a tiny self-contained copy here. Keep the query in sync with the API.
 */
export async function getLockdownStatus(
  client: WorkerQueryClient,
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
