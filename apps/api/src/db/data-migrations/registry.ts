import type { DataMigration } from "./types";

/**
 * Ordered list of registered data migrations. The orchestrator walks
 * this array in declaration order on every boot.
 *
 * Plan B adds `videos_to_series_model_v1` to this list. Plan A
 * intentionally ships it empty so the framework can be exercised
 * without any destructive migration in flight.
 */
export const dataMigrationsRegistry: DataMigration[] = [];
