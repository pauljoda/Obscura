CREATE TABLE "audio_libraries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"date" text,
	"rating" integer,
	"organized" boolean DEFAULT false NOT NULL,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"folder_path" text,
	"parent_id" uuid,
	"cover_image_path" text,
	"icon_path" text,
	"track_count" integer DEFAULT 0 NOT NULL,
	"studio_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_library_performers" (
	"library_id" uuid NOT NULL,
	"performer_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_library_tags" (
	"library_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_track_markers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"title" text NOT NULL,
	"seconds" real NOT NULL,
	"end_seconds" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_track_performers" (
	"track_id" uuid NOT NULL,
	"performer_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_track_tags" (
	"track_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"date" text,
	"rating" integer,
	"organized" boolean DEFAULT false NOT NULL,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"file_path" text NOT NULL,
	"file_size" real,
	"duration" real,
	"bit_rate" integer,
	"sample_rate" integer,
	"channels" integer,
	"codec" text,
	"container" text,
	"embedded_artist" text,
	"embedded_album" text,
	"track_number" integer,
	"checksum_md5" text,
	"oshash" text,
	"waveform_path" text,
	"play_count" integer DEFAULT 0 NOT NULL,
	"play_duration" real DEFAULT 0 NOT NULL,
	"resume_time" real DEFAULT 0 NOT NULL,
	"last_played_at" timestamp,
	"library_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"studio_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "galleries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"date" text,
	"rating" integer,
	"organized" boolean DEFAULT false NOT NULL,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"photographer" text,
	"gallery_type" text DEFAULT 'virtual' NOT NULL,
	"folder_path" text,
	"zip_file_path" text,
	"parent_id" uuid,
	"cover_image_id" uuid,
	"image_count" integer DEFAULT 0 NOT NULL,
	"studio_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"title" text NOT NULL,
	"image_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_performers" (
	"gallery_id" uuid NOT NULL,
	"performer_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_tags" (
	"gallery_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_performers" (
	"image_id" uuid NOT NULL,
	"performer_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_tags" (
	"image_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"date" text,
	"rating" integer,
	"organized" boolean DEFAULT false NOT NULL,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"file_path" text NOT NULL,
	"file_size" real,
	"width" integer,
	"height" integer,
	"format" text,
	"thumbnail_path" text,
	"checksum_md5" text,
	"oshash" text,
	"gallery_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"studio_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_name" text NOT NULL,
	"bullmq_job_id" text NOT NULL,
	"status" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"target_label" text,
	"progress" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"payload" jsonb,
	"error" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_roots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"label" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"recursive" boolean DEFAULT true NOT NULL,
	"scan_videos" boolean DEFAULT true NOT NULL,
	"scan_images" boolean DEFAULT true NOT NULL,
	"scan_audio" boolean DEFAULT true NOT NULL,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"last_scanned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auto_scan_enabled" boolean DEFAULT false NOT NULL,
	"scan_interval_minutes" integer DEFAULT 60 NOT NULL,
	"auto_generate_metadata" boolean DEFAULT true NOT NULL,
	"auto_generate_fingerprints" boolean DEFAULT true NOT NULL,
	"auto_generate_preview" boolean DEFAULT true NOT NULL,
	"generate_trickplay" boolean DEFAULT true NOT NULL,
	"trickplay_interval_seconds" integer DEFAULT 10 NOT NULL,
	"preview_clip_duration_seconds" integer DEFAULT 8 NOT NULL,
	"thumbnail_quality" integer DEFAULT 2 NOT NULL,
	"trickplay_quality" integer DEFAULT 2 NOT NULL,
	"background_worker_concurrency" integer DEFAULT 1 NOT NULL,
	"nsfw_lan_auto_enable" boolean DEFAULT false NOT NULL,
	"metadata_storage_dedicated" boolean DEFAULT true NOT NULL,
	"subtitles_auto_enable" boolean DEFAULT false NOT NULL,
	"subtitles_preferred_languages" text DEFAULT 'en,eng' NOT NULL,
	"subtitle_style" text DEFAULT 'stylized' NOT NULL,
	"subtitle_font_scale" real DEFAULT 1 NOT NULL,
	"subtitle_position_percent" real DEFAULT 88 NOT NULL,
	"subtitle_opacity" real DEFAULT 1 NOT NULL,
	"default_playback_mode" text DEFAULT 'direct' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performer_tags" (
	"performer_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"disambiguation" text,
	"aliases" text,
	"gender" text,
	"birthdate" text,
	"country" text,
	"ethnicity" text,
	"eye_color" text,
	"hair_color" text,
	"height" integer,
	"weight" integer,
	"measurements" text,
	"tattoos" text,
	"piercings" text,
	"career_start" integer,
	"career_end" integer,
	"details" text,
	"image_url" text,
	"image_path" text,
	"favorite" boolean DEFAULT false NOT NULL,
	"rating" integer,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"scene_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_markers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" uuid NOT NULL,
	"title" text NOT NULL,
	"seconds" real NOT NULL,
	"end_seconds" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_performers" (
	"scene_id" uuid NOT NULL,
	"performer_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_subtitles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" uuid NOT NULL,
	"language" text NOT NULL,
	"label" text,
	"format" text NOT NULL,
	"source" text NOT NULL,
	"storage_path" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_tags" (
	"scene_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"url" text,
	"date" text,
	"rating" integer,
	"organized" boolean DEFAULT false NOT NULL,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"interactive" boolean DEFAULT false NOT NULL,
	"file_path" text,
	"file_size" real,
	"duration" real,
	"width" integer,
	"height" integer,
	"frame_rate" real,
	"bit_rate" integer,
	"codec" text,
	"container" text,
	"thumbnail_path" text,
	"card_thumbnail_path" text,
	"preview_path" text,
	"sprite_path" text,
	"trickplay_vtt_path" text,
	"checksum_md5" text,
	"oshash" text,
	"phash" text,
	"play_count" integer DEFAULT 0 NOT NULL,
	"orgasm_count" integer DEFAULT 0 NOT NULL,
	"play_duration" real DEFAULT 0 NOT NULL,
	"resume_time" real DEFAULT 0 NOT NULL,
	"last_played_at" timestamp,
	"studio_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrape_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" uuid NOT NULL,
	"scraper_package_id" uuid,
	"stash_box_endpoint_id" uuid,
	"action" text NOT NULL,
	"match_type" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"raw_result" jsonb,
	"proposed_title" text,
	"proposed_date" text,
	"proposed_details" text,
	"proposed_url" text,
	"proposed_studio_name" text,
	"proposed_performer_names" jsonb,
	"proposed_tag_names" jsonb,
	"proposed_image_url" text,
	"applied_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" text NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"install_path" text NOT NULL,
	"sha256" text,
	"capabilities" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stash_box_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"endpoint" text NOT NULL,
	"api_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stash_ids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"stash_box_endpoint_id" uuid NOT NULL,
	"stash_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"aliases" text,
	"url" text,
	"parent_id" uuid,
	"image_url" text,
	"image_path" text,
	"favorite" boolean DEFAULT false NOT NULL,
	"rating" integer,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"scene_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"aliases" text,
	"parent_id" uuid,
	"favorite" boolean DEFAULT false NOT NULL,
	"ignore_auto_tag" boolean DEFAULT false NOT NULL,
	"image_url" text,
	"image_path" text,
	"rating" integer,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"scene_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audio_libraries" ADD CONSTRAINT "audio_libraries_parent_id_audio_libraries_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."audio_libraries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_libraries" ADD CONSTRAINT "audio_libraries_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_library_performers" ADD CONSTRAINT "audio_library_performers_library_id_audio_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."audio_libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_library_performers" ADD CONSTRAINT "audio_library_performers_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_library_tags" ADD CONSTRAINT "audio_library_tags_library_id_audio_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."audio_libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_library_tags" ADD CONSTRAINT "audio_library_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_track_markers" ADD CONSTRAINT "audio_track_markers_track_id_audio_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."audio_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_track_performers" ADD CONSTRAINT "audio_track_performers_track_id_audio_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."audio_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_track_performers" ADD CONSTRAINT "audio_track_performers_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_track_tags" ADD CONSTRAINT "audio_track_tags_track_id_audio_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."audio_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_track_tags" ADD CONSTRAINT "audio_track_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_tracks" ADD CONSTRAINT "audio_tracks_library_id_audio_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."audio_libraries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_tracks" ADD CONSTRAINT "audio_tracks_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_parent_id_galleries_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."galleries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_chapters" ADD CONSTRAINT "gallery_chapters_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_performers" ADD CONSTRAINT "gallery_performers_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_performers" ADD CONSTRAINT "gallery_performers_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_tags" ADD CONSTRAINT "gallery_tags_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_tags" ADD CONSTRAINT "gallery_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_performers" ADD CONSTRAINT "image_performers_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_performers" ADD CONSTRAINT "image_performers_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_tags" ADD CONSTRAINT "image_tags_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_tags" ADD CONSTRAINT "image_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performer_tags" ADD CONSTRAINT "performer_tags_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performer_tags" ADD CONSTRAINT "performer_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_markers" ADD CONSTRAINT "scene_markers_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_performers" ADD CONSTRAINT "scene_performers_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_performers" ADD CONSTRAINT "scene_performers_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_subtitles" ADD CONSTRAINT "scene_subtitles_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_tags" ADD CONSTRAINT "scene_tags_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_tags" ADD CONSTRAINT "scene_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrape_results" ADD CONSTRAINT "scrape_results_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrape_results" ADD CONSTRAINT "scrape_results_scraper_package_id_scraper_packages_id_fk" FOREIGN KEY ("scraper_package_id") REFERENCES "public"."scraper_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrape_results" ADD CONSTRAINT "scrape_results_stash_box_endpoint_id_stash_box_endpoints_id_fk" FOREIGN KEY ("stash_box_endpoint_id") REFERENCES "public"."stash_box_endpoints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stash_ids" ADD CONSTRAINT "stash_ids_stash_box_endpoint_id_stash_box_endpoints_id_fk" FOREIGN KEY ("stash_box_endpoint_id") REFERENCES "public"."stash_box_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studios" ADD CONSTRAINT "studios_parent_id_studios_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."studios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_parent_id_tags_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audio_libraries_parent_idx" ON "audio_libraries" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audio_libraries_folder_path_idx" ON "audio_libraries" USING btree ("folder_path");--> statement-breakpoint
CREATE INDEX "audio_libraries_rating_idx" ON "audio_libraries" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "audio_libraries_created_at_idx" ON "audio_libraries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audio_libraries_studio_idx" ON "audio_libraries" USING btree ("studio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audio_library_performers_pk" ON "audio_library_performers" USING btree ("library_id","performer_id");--> statement-breakpoint
CREATE INDEX "audio_library_performers_performer_idx" ON "audio_library_performers" USING btree ("performer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audio_library_tags_pk" ON "audio_library_tags" USING btree ("library_id","tag_id");--> statement-breakpoint
CREATE INDEX "audio_library_tags_tag_idx" ON "audio_library_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "audio_track_markers_track_idx" ON "audio_track_markers" USING btree ("track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audio_track_performers_pk" ON "audio_track_performers" USING btree ("track_id","performer_id");--> statement-breakpoint
CREATE INDEX "audio_track_performers_performer_idx" ON "audio_track_performers" USING btree ("performer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audio_track_tags_pk" ON "audio_track_tags" USING btree ("track_id","tag_id");--> statement-breakpoint
CREATE INDEX "audio_track_tags_tag_idx" ON "audio_track_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audio_tracks_file_path_idx" ON "audio_tracks" USING btree ("file_path");--> statement-breakpoint
CREATE INDEX "audio_tracks_library_idx" ON "audio_tracks" USING btree ("library_id");--> statement-breakpoint
CREATE INDEX "audio_tracks_library_sort_idx" ON "audio_tracks" USING btree ("library_id","sort_order");--> statement-breakpoint
CREATE INDEX "audio_tracks_studio_idx" ON "audio_tracks" USING btree ("studio_id");--> statement-breakpoint
CREATE INDEX "audio_tracks_rating_idx" ON "audio_tracks" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "audio_tracks_created_at_idx" ON "audio_tracks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "galleries_studio_idx" ON "galleries" USING btree ("studio_id");--> statement-breakpoint
CREATE INDEX "galleries_parent_idx" ON "galleries" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "galleries_type_idx" ON "galleries" USING btree ("gallery_type");--> statement-breakpoint
CREATE INDEX "galleries_date_idx" ON "galleries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "galleries_rating_idx" ON "galleries" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "galleries_created_at_idx" ON "galleries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "galleries_folder_path_idx" ON "galleries" USING btree ("folder_path");--> statement-breakpoint
CREATE INDEX "galleries_zip_path_idx" ON "galleries" USING btree ("zip_file_path");--> statement-breakpoint
CREATE INDEX "gallery_chapters_gallery_idx" ON "gallery_chapters" USING btree ("gallery_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gallery_performers_pk" ON "gallery_performers" USING btree ("gallery_id","performer_id");--> statement-breakpoint
CREATE INDEX "gallery_performers_performer_idx" ON "gallery_performers" USING btree ("performer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gallery_tags_pk" ON "gallery_tags" USING btree ("gallery_id","tag_id");--> statement-breakpoint
CREATE INDEX "gallery_tags_tag_idx" ON "gallery_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "image_performers_pk" ON "image_performers" USING btree ("image_id","performer_id");--> statement-breakpoint
CREATE INDEX "image_performers_performer_idx" ON "image_performers" USING btree ("performer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "image_tags_pk" ON "image_tags" USING btree ("image_id","tag_id");--> statement-breakpoint
CREATE INDEX "image_tags_tag_idx" ON "image_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "images_file_path_idx" ON "images" USING btree ("file_path");--> statement-breakpoint
CREATE INDEX "images_gallery_idx" ON "images" USING btree ("gallery_id");--> statement-breakpoint
CREATE INDEX "images_gallery_sort_idx" ON "images" USING btree ("gallery_id","sort_order");--> statement-breakpoint
CREATE INDEX "images_studio_idx" ON "images" USING btree ("studio_id");--> statement-breakpoint
CREATE INDEX "images_rating_idx" ON "images" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "images_created_at_idx" ON "images" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_runs_bullmq_job_id_idx" ON "job_runs" USING btree ("bullmq_job_id");--> statement-breakpoint
CREATE INDEX "job_runs_queue_name_idx" ON "job_runs" USING btree ("queue_name");--> statement-breakpoint
CREATE INDEX "job_runs_status_idx" ON "job_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_runs_created_at_idx" ON "job_runs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "library_roots_path_idx" ON "library_roots" USING btree ("path");--> statement-breakpoint
CREATE UNIQUE INDEX "performer_tags_pk" ON "performer_tags" USING btree ("performer_id","tag_id");--> statement-breakpoint
CREATE INDEX "performer_tags_tag_idx" ON "performer_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "performers_name_idx" ON "performers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "performers_gender_idx" ON "performers" USING btree ("gender");--> statement-breakpoint
CREATE INDEX "performers_favorite_idx" ON "performers" USING btree ("favorite");--> statement-breakpoint
CREATE INDEX "performers_rating_idx" ON "performers" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "performers_created_at_idx" ON "performers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scene_markers_scene_idx" ON "scene_markers" USING btree ("scene_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_performers_pk" ON "scene_performers" USING btree ("scene_id","performer_id");--> statement-breakpoint
CREATE INDEX "scene_performers_performer_idx" ON "scene_performers" USING btree ("performer_id");--> statement-breakpoint
CREATE INDEX "scene_subtitles_scene_idx" ON "scene_subtitles" USING btree ("scene_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_subtitles_scene_lang_source_idx" ON "scene_subtitles" USING btree ("scene_id","language","source");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_tags_pk" ON "scene_tags" USING btree ("scene_id","tag_id");--> statement-breakpoint
CREATE INDEX "scene_tags_tag_idx" ON "scene_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "scenes_studio_idx" ON "scenes" USING btree ("studio_id");--> statement-breakpoint
CREATE INDEX "scenes_date_idx" ON "scenes" USING btree ("date");--> statement-breakpoint
CREATE INDEX "scenes_rating_idx" ON "scenes" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "scenes_created_at_idx" ON "scenes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scrape_results_scene_idx" ON "scrape_results" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "scrape_results_status_idx" ON "scrape_results" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scrape_results_created_at_idx" ON "scrape_results" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scraper_packages_package_id_idx" ON "scraper_packages" USING btree ("package_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stash_box_endpoints_endpoint_idx" ON "stash_box_endpoints" USING btree ("endpoint");--> statement-breakpoint
CREATE UNIQUE INDEX "stash_ids_entity_endpoint_idx" ON "stash_ids" USING btree ("entity_type","entity_id","stash_box_endpoint_id");--> statement-breakpoint
CREATE INDEX "stash_ids_entity_idx" ON "stash_ids" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "stash_ids_endpoint_idx" ON "stash_ids" USING btree ("stash_box_endpoint_id");--> statement-breakpoint
CREATE INDEX "studios_name_idx" ON "studios" USING btree ("name");--> statement-breakpoint
CREATE INDEX "studios_favorite_idx" ON "studios" USING btree ("favorite");--> statement-breakpoint
CREATE INDEX "studios_rating_idx" ON "studios" USING btree ("rating");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_idx" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tags_favorite_idx" ON "tags" USING btree ("favorite");--> statement-breakpoint
CREATE INDEX "tags_rating_idx" ON "tags" USING btree ("rating");