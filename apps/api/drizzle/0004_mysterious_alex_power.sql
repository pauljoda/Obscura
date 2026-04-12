CREATE TABLE "scene_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_root_id" uuid NOT NULL,
	"title" text NOT NULL,
	"folder_path" text NOT NULL,
	"relative_path" text NOT NULL,
	"parent_id" uuid,
	"depth" integer NOT NULL,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"cover_image_path" text,
	"direct_scene_count" integer DEFAULT 0 NOT NULL,
	"total_scene_count" integer DEFAULT 0 NOT NULL,
	"visible_sfw_scene_count" integer DEFAULT 0 NOT NULL,
	"contains_nsfw_descendants" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "scene_folder_id" uuid;--> statement-breakpoint
ALTER TABLE "scene_folders" ADD CONSTRAINT "scene_folders_library_root_id_library_roots_id_fk" FOREIGN KEY ("library_root_id") REFERENCES "public"."library_roots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_folders" ADD CONSTRAINT "scene_folders_parent_id_scene_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."scene_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scene_folders_folder_path_idx" ON "scene_folders" USING btree ("folder_path");--> statement-breakpoint
CREATE INDEX "scene_folders_library_root_idx" ON "scene_folders" USING btree ("library_root_id");--> statement-breakpoint
CREATE INDEX "scene_folders_parent_idx" ON "scene_folders" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "scene_folders_depth_idx" ON "scene_folders" USING btree ("depth");--> statement-breakpoint
CREATE INDEX "scene_folders_nsfw_idx" ON "scene_folders" USING btree ("is_nsfw");--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_scene_folder_id_scene_folders_id_fk" FOREIGN KEY ("scene_folder_id") REFERENCES "public"."scene_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scenes_scene_folder_idx" ON "scenes" USING btree ("scene_folder_id");