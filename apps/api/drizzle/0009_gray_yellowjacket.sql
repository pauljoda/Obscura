CREATE TABLE "external_ids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"external_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_auth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" text NOT NULL,
	"auth_key" text NOT NULL,
	"encrypted_value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" text NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"runtime" text NOT NULL,
	"install_path" text NOT NULL,
	"sha256" text,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"capabilities" jsonb,
	"manifest_raw" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"source_index" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scrape_results" ALTER COLUMN "scene_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audio_libraries" ADD COLUMN "urls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "audio_tracks" ADD COLUMN "urls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "urls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "urls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_folders" ADD COLUMN "urls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_folders" ADD COLUMN "external_series_id" text;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "urls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "episode_number" integer;--> statement-breakpoint
ALTER TABLE "scrape_results" ADD COLUMN "entity_type" text DEFAULT 'scene' NOT NULL;--> statement-breakpoint
ALTER TABLE "scrape_results" ADD COLUMN "entity_id" uuid;--> statement-breakpoint
ALTER TABLE "scrape_results" ADD COLUMN "plugin_package_id" uuid;--> statement-breakpoint
ALTER TABLE "scrape_results" ADD COLUMN "proposed_urls" jsonb;--> statement-breakpoint
ALTER TABLE "scrape_results" ADD COLUMN "proposed_episode_number" integer;--> statement-breakpoint
ALTER TABLE "scrape_results" ADD COLUMN "proposed_folder_result" jsonb;--> statement-breakpoint
ALTER TABLE "scrape_results" ADD COLUMN "proposed_audio_result" jsonb;--> statement-breakpoint
ALTER TABLE "scraper_packages" ADD COLUMN "is_nsfw" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "scraper_packages" ADD COLUMN "plugin_type" text DEFAULT 'stash-compat' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "external_ids_entity_provider_idx" ON "external_ids" USING btree ("entity_type","entity_id","provider");--> statement-breakpoint
CREATE INDEX "external_ids_entity_idx" ON "external_ids" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "external_ids_provider_idx" ON "external_ids" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_auth_plugin_key_idx" ON "plugin_auth" USING btree ("plugin_id","auth_key");--> statement-breakpoint
CREATE INDEX "plugin_auth_plugin_idx" ON "plugin_auth" USING btree ("plugin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_packages_plugin_id_idx" ON "plugin_packages" USING btree ("plugin_id");--> statement-breakpoint
ALTER TABLE "scrape_results" ADD CONSTRAINT "scrape_results_plugin_package_id_plugin_packages_id_fk" FOREIGN KEY ("plugin_package_id") REFERENCES "public"."plugin_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scrape_results_entity_idx" ON "scrape_results" USING btree ("entity_type","entity_id");--> statement-breakpoint
UPDATE "scrape_results" SET "entity_id" = "scene_id" WHERE "scene_id" IS NOT NULL AND "entity_id" IS NULL;