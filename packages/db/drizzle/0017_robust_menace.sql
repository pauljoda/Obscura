ALTER TABLE "scrape_results" ALTER COLUMN "entity_type" SET DEFAULT 'video';
--> statement-breakpoint
UPDATE "collection_items" SET "entity_type" = 'video' WHERE "entity_type" = 'scene';
--> statement-breakpoint
UPDATE "stash_ids" SET "entity_type" = 'video' WHERE "entity_type" = 'scene';
--> statement-breakpoint
UPDATE "external_ids" SET "entity_type" = 'video' WHERE "entity_type" = 'scene';
--> statement-breakpoint
UPDATE "external_ids" SET "entity_type" = 'video_series' WHERE "entity_type" = 'folder';
--> statement-breakpoint
UPDATE "scrape_results" SET "entity_type" = 'video' WHERE "entity_type" = 'scene';
--> statement-breakpoint
UPDATE "scrape_results" SET "entity_type" = 'video_series' WHERE "entity_type" = 'folder';
--> statement-breakpoint
UPDATE "scrape_results" SET "entity_type" = 'video_series' WHERE "entity_type" = 'scene_folder';