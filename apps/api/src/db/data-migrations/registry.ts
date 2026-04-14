import type { DataMigration } from "./types";
import { videosToSeriesModelV1 } from "./videos_to_series_model_v1";

/**
 * Ordered list of registered data migrations. The orchestrator walks
 * this array in declaration order on every boot.
 */
export const dataMigrationsRegistry: DataMigration[] = [
  videosToSeriesModelV1,
];
