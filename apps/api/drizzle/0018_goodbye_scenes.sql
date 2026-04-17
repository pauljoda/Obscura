-- Drop legacy scene tables and the data-migration ledger.
--
-- The videos-to-series model has fully replaced scenes. Paul's install
-- already ran the old `videos_to_series_model_v1` finalize, so the
-- scene_* tables are already gone there. On any install that still
-- has them, the one-time breaking-upgrade gate ran first
-- (see apps/api/src/db/breaking-gate.ts) and the user consented to
-- the rescan before this migration executes. IF EXISTS makes both
-- paths safe.
DROP TABLE IF EXISTS "scene_folder_performers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "scene_folder_tags" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "scene_folders" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "scene_markers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "scene_performers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "scene_subtitles" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "scene_tags" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "scenes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "data_migrations" CASCADE;
