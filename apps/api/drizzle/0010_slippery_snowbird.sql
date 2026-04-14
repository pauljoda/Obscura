CREATE TABLE "data_migrations" (
	"name" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"staged_at" timestamp,
	"finalized_at" timestamp,
	"failed_at" timestamp,
	"last_error" text,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_episode_performers" (
	"episode_id" uuid NOT NULL,
	"performer_id" uuid NOT NULL,
	"character" text,
	"order" integer
);
--> statement-breakpoint
CREATE TABLE "video_episode_tags" (
	"episode_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"series_id" uuid NOT NULL,
	"season_number" integer NOT NULL,
	"episode_number" integer,
	"absolute_episode_number" integer,
	"title" text,
	"overview" text,
	"air_date" text,
	"still_path" text,
	"runtime" integer,
	"external_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"file_path" text NOT NULL,
	"file_size" real,
	"duration" real,
	"width" integer,
	"height" integer,
	"frame_rate" real,
	"bit_rate" integer,
	"codec" text,
	"container" text,
	"checksum_md5" text,
	"oshash" text,
	"phash" text,
	"thumbnail_path" text,
	"card_thumbnail_path" text,
	"preview_path" text,
	"sprite_path" text,
	"trickplay_vtt_path" text,
	"play_count" integer DEFAULT 0 NOT NULL,
	"orgasm_count" integer DEFAULT 0 NOT NULL,
	"play_duration" real DEFAULT 0 NOT NULL,
	"resume_time" real DEFAULT 0 NOT NULL,
	"last_played_at" timestamp,
	"rating" integer,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"organized" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_movie_performers" (
	"movie_id" uuid NOT NULL,
	"performer_id" uuid NOT NULL,
	"character" text,
	"order" integer
);
--> statement-breakpoint
CREATE TABLE "video_movie_tags" (
	"movie_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_movies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_root_id" uuid NOT NULL,
	"title" text NOT NULL,
	"sort_title" text,
	"original_title" text,
	"overview" text,
	"tagline" text,
	"release_date" text,
	"runtime" integer,
	"poster_path" text,
	"backdrop_path" text,
	"logo_path" text,
	"studio_id" uuid,
	"rating" integer,
	"content_rating" text,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"organized" boolean DEFAULT false NOT NULL,
	"external_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"file_path" text NOT NULL,
	"file_size" real,
	"duration" real,
	"width" integer,
	"height" integer,
	"frame_rate" real,
	"bit_rate" integer,
	"codec" text,
	"container" text,
	"checksum_md5" text,
	"oshash" text,
	"phash" text,
	"thumbnail_path" text,
	"card_thumbnail_path" text,
	"preview_path" text,
	"sprite_path" text,
	"trickplay_vtt_path" text,
	"play_count" integer DEFAULT 0 NOT NULL,
	"orgasm_count" integer DEFAULT 0 NOT NULL,
	"play_duration" real DEFAULT 0 NOT NULL,
	"resume_time" real DEFAULT 0 NOT NULL,
	"last_played_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" uuid NOT NULL,
	"season_number" integer NOT NULL,
	"folder_path" text,
	"title" text,
	"overview" text,
	"poster_path" text,
	"air_date" text,
	"external_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_root_id" uuid NOT NULL,
	"folder_path" text NOT NULL,
	"relative_path" text NOT NULL,
	"title" text NOT NULL,
	"sort_title" text,
	"original_title" text,
	"overview" text,
	"tagline" text,
	"status" text,
	"first_air_date" text,
	"end_air_date" text,
	"poster_path" text,
	"backdrop_path" text,
	"logo_path" text,
	"studio_id" uuid,
	"rating" real,
	"content_rating" text,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"organized" boolean DEFAULT false NOT NULL,
	"external_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_series_performers" (
	"series_id" uuid NOT NULL,
	"performer_id" uuid NOT NULL,
	"character" text,
	"order" integer
);
--> statement-breakpoint
CREATE TABLE "video_series_tags" (
	"series_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_roots" ADD COLUMN "scan_movies" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "library_roots" ADD COLUMN "scan_series" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "video_episode_performers" ADD CONSTRAINT "video_episode_performers_episode_id_video_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."video_episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_episode_performers" ADD CONSTRAINT "video_episode_performers_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_episode_tags" ADD CONSTRAINT "video_episode_tags_episode_id_video_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."video_episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_episode_tags" ADD CONSTRAINT "video_episode_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_episodes" ADD CONSTRAINT "video_episodes_season_id_video_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."video_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_episodes" ADD CONSTRAINT "video_episodes_series_id_video_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."video_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_movie_performers" ADD CONSTRAINT "video_movie_performers_movie_id_video_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."video_movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_movie_performers" ADD CONSTRAINT "video_movie_performers_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_movie_tags" ADD CONSTRAINT "video_movie_tags_movie_id_video_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."video_movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_movie_tags" ADD CONSTRAINT "video_movie_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_movies" ADD CONSTRAINT "video_movies_library_root_id_library_roots_id_fk" FOREIGN KEY ("library_root_id") REFERENCES "public"."library_roots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_movies" ADD CONSTRAINT "video_movies_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_seasons" ADD CONSTRAINT "video_seasons_series_id_video_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."video_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_series" ADD CONSTRAINT "video_series_library_root_id_library_roots_id_fk" FOREIGN KEY ("library_root_id") REFERENCES "public"."library_roots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_series" ADD CONSTRAINT "video_series_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_series_performers" ADD CONSTRAINT "video_series_performers_series_id_video_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."video_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_series_performers" ADD CONSTRAINT "video_series_performers_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_series_tags" ADD CONSTRAINT "video_series_tags_series_id_video_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."video_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_series_tags" ADD CONSTRAINT "video_series_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "video_episode_performers_pk" ON "video_episode_performers" USING btree ("episode_id","performer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_episode_tags_pk" ON "video_episode_tags" USING btree ("episode_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_episodes_file_path_idx" ON "video_episodes" USING btree ("file_path");--> statement-breakpoint
CREATE INDEX "video_episodes_season_idx" ON "video_episodes" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "video_episodes_series_idx" ON "video_episodes" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "video_episodes_is_nsfw_idx" ON "video_episodes" USING btree ("is_nsfw");--> statement-breakpoint
CREATE UNIQUE INDEX "video_movie_performers_pk" ON "video_movie_performers" USING btree ("movie_id","performer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_movie_tags_pk" ON "video_movie_tags" USING btree ("movie_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_movies_file_path_idx" ON "video_movies" USING btree ("file_path");--> statement-breakpoint
CREATE INDEX "video_movies_library_root_idx" ON "video_movies" USING btree ("library_root_id");--> statement-breakpoint
CREATE INDEX "video_movies_studio_idx" ON "video_movies" USING btree ("studio_id");--> statement-breakpoint
CREATE INDEX "video_movies_is_nsfw_idx" ON "video_movies" USING btree ("is_nsfw");--> statement-breakpoint
CREATE UNIQUE INDEX "video_seasons_series_season_idx" ON "video_seasons" USING btree ("series_id","season_number");--> statement-breakpoint
CREATE INDEX "video_seasons_series_idx" ON "video_seasons" USING btree ("series_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_series_folder_path_idx" ON "video_series" USING btree ("folder_path");--> statement-breakpoint
CREATE INDEX "video_series_library_root_idx" ON "video_series" USING btree ("library_root_id");--> statement-breakpoint
CREATE INDEX "video_series_studio_idx" ON "video_series" USING btree ("studio_id");--> statement-breakpoint
CREATE INDEX "video_series_is_nsfw_idx" ON "video_series" USING btree ("is_nsfw");--> statement-breakpoint
CREATE UNIQUE INDEX "video_series_performers_pk" ON "video_series_performers" USING btree ("series_id","performer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_series_tags_pk" ON "video_series_tags" USING btree ("series_id","tag_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_series_tmdb_idx"
  ON "video_series" ((external_ids->>'tmdb'));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_seasons_tmdb_idx"
  ON "video_seasons" ((external_ids->>'tmdb'));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_episodes_tmdb_idx"
  ON "video_episodes" ((external_ids->>'tmdb'));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_movies_tmdb_idx"
  ON "video_movies" ((external_ids->>'tmdb'));