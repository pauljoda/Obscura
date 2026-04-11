ALTER TABLE "scene_subtitles" ADD COLUMN "source_format" text DEFAULT 'vtt' NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_subtitles" ADD COLUMN "source_path" text;