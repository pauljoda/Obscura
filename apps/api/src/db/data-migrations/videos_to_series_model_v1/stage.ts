import type {
  DataMigrationContext,
  StageResult,
} from "../types";

/**
 * The stage() function originally read from the legacy `scenes` /
 * `scene_folders` tables (via `read.ts` and `legacy-schema.ts`) and
 * populated the new `video_*` table family.  After the destructive
 * finalize (APP-10) dropped those tables, `precheck()` always returns
 * `ok: false`, so this function is unreachable at runtime.
 *
 * The reader helpers and frozen schema snapshot were deleted as dead
 * code (APP-23).  This stub remains so the migration module's
 * `{ precheck, stage, finalize }` shape is preserved.
 */
export async function stage(
  _ctx: DataMigrationContext,
): Promise<StageResult> {
  throw new Error(
    "videos_to_series_model_v1 stage() is no longer runnable — " +
      "the legacy scene tables have been dropped by finalize(). " +
      "If you are seeing this error, precheck() should have " +
      "returned ok:false before stage() was called.",
  );
}
