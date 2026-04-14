import type { DataMigrationContext, FinalizeResult } from "../types";

/**
 * Non-destructive finalize. The original videos_to_series_model_v1
 * plan called for dropping the legacy `scenes` and `scene_folders`
 * tables here, but the web UI still reads from them. Until a
 * dedicated cleanup plan adapts every consumer, finalize just marks
 * the migration complete and leaves the legacy schema in place.
 *
 * Side effects:
 *   - None to the database.
 *   - The orchestrator wraps this call in a transaction and flips
 *     the data_migrations row to `complete` after it returns.
 *
 * Legacy-table cleanup is deferred to a future plan that lands after
 * the web UI stops reading from scenes/scene_folders.
 */
export async function finalize(
  ctx: DataMigrationContext,
): Promise<FinalizeResult> {
  const { logger, reportProgress } = ctx;
  reportProgress(100, "finalize (non-destructive)");
  logger.info("videos_to_series_model_v1 finalize complete (non-destructive)");
  return {
    metrics: {
      destructive: false,
      droppedTables: 0,
    },
  };
}
