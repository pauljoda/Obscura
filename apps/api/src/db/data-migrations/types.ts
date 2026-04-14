import type postgres from "postgres";

/**
 * Raw postgres.js client type. The project standardises on the namespace
 * type from the `postgres` package rather than a top-level `Sql` import
 * (the package only exports `Sql` via its namespace).
 */
export type DataMigrationClient = postgres.Sql<{}>;

/**
 * The lifecycle states a data migration can be in. Stored in
 * `data_migrations.status` as text.
 *
 * - pending     — not yet staged. Will be staged on next boot.
 * - staging     — stage() is currently running (transient; only visible
 *                 if a previous process crashed mid-stage).
 * - staged      — stage() completed successfully. Waiting for a user to
 *                 click the finalize button. Write lockdown is active.
 * - finalizing  — finalize() is currently running (transient).
 * - complete    — fully done. Will be skipped on future boots.
 * - failed      — stage() or finalize() threw. last_error holds the
 *                 message. Operator must investigate and clear manually.
 */
export type DataMigrationStatus =
  | "pending"
  | "staging"
  | "staged"
  | "finalizing"
  | "complete"
  | "failed";

export interface DataMigrationRow {
  name: string;
  status: DataMigrationStatus;
  stagedAt: Date | null;
  finalizedAt: Date | null;
  failedAt: Date | null;
  lastError: string | null;
  metrics: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataMigrationContext {
  /**
   * Raw postgres.js client. Use this for SQL, transactions, and adapter
   * reads against retired-table schemas. Drizzle is intentionally NOT
   * exposed here — data migrations own their own query shapes and must
   * not import from packages/db/src/schema.ts for tables that may be
   * retired later.
   */
  client: DataMigrationClient;
  logger: {
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
  };
  reportProgress(pct: number, message?: string): void;
}

export interface PrecheckResult {
  ok: boolean;
  reasons: string[];
}

export interface StageResult {
  metrics: Record<string, unknown>;
  warnings: string[];
}

export interface FinalizeResult {
  metrics: Record<string, unknown>;
}

export interface DataMigration {
  /** Stable unique id. E.g. "videos_to_series_model_v1". */
  name: string;
  /** Human-readable description shown in the migration banner. */
  description: string;
  /**
   * Optional safety check. Called before stage(). Return `{ok: false, reasons}`
   * to skip the migration entirely and leave status `pending` with a warning.
   * Use this to detect "fresh install, nothing to migrate" conditions.
   */
  precheck?(ctx: DataMigrationContext): Promise<PrecheckResult>;
  /**
   * Non-destructive. Reads from old tables (via a frozen legacy-schema
   * adapter owned by this migration), writes to new tables. Must run
   * inside a single transaction wrapper provided by the orchestrator.
   */
  stage(ctx: DataMigrationContext): Promise<StageResult>;
  /**
   * Destructive. Drops retired tables and columns. Only called via the
   * /system/migrations/:name/finalize endpoint after the user confirms.
   * Runs inside a transaction.
   */
  finalize(ctx: DataMigrationContext): Promise<FinalizeResult>;
}
