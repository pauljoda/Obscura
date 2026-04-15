CREATE TABLE "video_markers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"title" text NOT NULL,
	"seconds" real NOT NULL,
	"end_seconds" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_subtitles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"language" text NOT NULL,
	"label" text,
	"format" text NOT NULL,
	"source" text NOT NULL,
	"storage_path" text NOT NULL,
	"source_format" text DEFAULT 'vtt' NOT NULL,
	"source_path" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_series" ADD COLUMN "custom_name" text;--> statement-breakpoint
CREATE INDEX "video_markers_entity_idx" ON "video_markers" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "video_subtitles_entity_idx" ON "video_subtitles" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_subtitles_entity_lang_source_idx" ON "video_subtitles" USING btree ("entity_type","entity_id","language","source");