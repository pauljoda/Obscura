# Data Migrations Framework

This directory holds Obscura's reusable two-phase data migration
system. It is distinct from drizzle's `__drizzle_migrations` table,
which tracks schema DDL. The `data_migrations` table tracks data
*reshapes* that span two boots and preserve user state.

## When to use this

Use a data migration when you need to reshape existing rows across
tables in a way that can't be expressed as a simple `ALTER TABLE` or
backfill — for example, splitting one table into several typed tables,
merging entities, or changing the semantic model. Schema-only changes
continue to ship as drizzle migrations.

## Lifecycle

Each migration progresses through these states stored in
`data_migrations.status`:

1. **pending** — registered but not yet run.
2. **staging** — `stage()` is running (transient; only visible if a
   prior process crashed mid-stage).
3. **staged** — `stage()` succeeded. The app is in write-lockdown for
   affected entities. The web UI shows a banner with a finalize button.
4. **finalizing** — `finalize()` is running (transient).
5. **complete** — done. Skipped on future boots.
6. **failed** — `stage()` or `finalize()` threw. `last_error` holds the
   message. Requires manual investigation before retry.

## Writing a new migration

1. Create a directory `apps/api/src/db/data-migrations/<name>/`.
2. Inside it, add `index.ts` exporting a `DataMigration` object.
3. Add any frozen legacy-schema adapter modules for retired tables in
   the same directory — the main schema file must not reference
   retired tables.
4. Register the migration in `registry.ts` by appending it to
   `dataMigrationsRegistry` in the correct order.
5. When `finalize()` has shipped and been exercised, delete the legacy
   adapter modules in a follow-up commit.

## Contract

```ts
interface DataMigration {
  name: string;              // unique, stable
  description: string;       // shown in the UI banner
  precheck?(ctx): Promise<PrecheckResult>;
  stage(ctx): Promise<StageResult>;     // non-destructive, runs in a tx
  finalize(ctx): Promise<FinalizeResult>; // destructive, runs in a tx
}
```

- `stage()` runs automatically on boot after drizzle DDL migrations.
- `stage()` **must be idempotent**. The orchestrator re-runs `stage()`
  if a previous boot crashed after the stage transaction committed but
  before the status update landed. Use `INSERT ... ON CONFLICT DO
  NOTHING` (or equivalent upsert semantics) so re-running doesn't
  produce duplicates.
- `finalize()` only runs via a user click on
  `POST /system/migrations/:name/finalize`.
- Both run inside `client.begin` transactions provided by the
  orchestrator.
- `precheck()` is optional. Return `{ok: false, reasons}` to leave the
  migration in `pending` (e.g. "fresh install, nothing to migrate").

## Write lockdown

While any registered migration is in `staged` or `finalizing` state,
route handlers that write to affected entities must call
`assertNotLockedDown(client)` from `./lockdown.ts` and let the
resulting `MIGRATION_LOCKDOWN` error propagate. Reads are always
permitted. Images/galleries/audio routes are unaffected because the
first real migration (Plan B) is a video-subsystem reshape.

## Concurrent boots

Obscura's unified Docker image runs the API and the worker as separate
processes that both call `runMigrations()` at startup. The framework
handles this with an upsert in `ensureRow` so concurrent boots cannot
collide on the `data_migrations.name` primary key.

## Observability

- Successful stage/finalize runs print `[data-migration]` log lines with
  metrics.
- Failed stages leave the row in `failed` with `last_error`. Query
  `SELECT name, status, last_error FROM data_migrations` to inspect.
- `GET /system/status` exposes the current state of every registered
  migration for the UI.
- `assertNotLockedDown` emits a console warning when it blocks a write.
