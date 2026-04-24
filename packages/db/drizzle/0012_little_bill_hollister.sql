ALTER TABLE "fingerprint_submissions" DROP CONSTRAINT "fingerprint_submissions_scene_id_scenes_id_fk";
--> statement-breakpoint
ALTER TABLE "scrape_results" DROP CONSTRAINT "scrape_results_scene_id_scenes_id_fk";
--> statement-breakpoint
ALTER TABLE "fingerprint_submissions" ALTER COLUMN "scene_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fingerprint_submissions" ADD COLUMN "entity_type" text;--> statement-breakpoint
ALTER TABLE "fingerprint_submissions" ADD COLUMN "entity_id" uuid;--> statement-breakpoint
CREATE INDEX "fingerprint_submissions_entity_idx" ON "fingerprint_submissions" USING btree ("entity_type","entity_id");