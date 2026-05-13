-- Remove obsolete scene tables and the unused migration ledger.
--
-- Some installs already have these tables removed. IF EXISTS keeps both
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
