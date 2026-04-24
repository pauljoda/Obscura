-- Retire the legacy columns that were previously dropped inline by
-- `videos_to_series_model_v1.finalize()`. Using IF EXISTS so this
-- migration is safe against installs that already finalized (column
-- gone) AND installs that never reached finalize (column present).
ALTER TABLE "library_roots" DROP COLUMN IF EXISTS "scan_videos";--> statement-breakpoint
ALTER TABLE "performers" DROP COLUMN IF EXISTS "scene_count";--> statement-breakpoint
ALTER TABLE "studios" DROP COLUMN IF EXISTS "scene_count";--> statement-breakpoint
ALTER TABLE "tags" DROP COLUMN IF EXISTS "scene_count";
