CREATE TABLE "scene_folder_performers" (
	"scene_folder_id" uuid NOT NULL,
	"performer_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_folder_tags" (
	"scene_folder_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scene_folders" ADD COLUMN "backdrop_image_path" text;--> statement-breakpoint
ALTER TABLE "scene_folders" ADD COLUMN "details" text;--> statement-breakpoint
ALTER TABLE "scene_folders" ADD COLUMN "studio_id" uuid;--> statement-breakpoint
ALTER TABLE "scene_folders" ADD COLUMN "rating" integer;--> statement-breakpoint
ALTER TABLE "scene_folders" ADD COLUMN "date" text;--> statement-breakpoint
ALTER TABLE "scene_folder_performers" ADD CONSTRAINT "scene_folder_performers_scene_folder_id_scene_folders_id_fk" FOREIGN KEY ("scene_folder_id") REFERENCES "public"."scene_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_folder_performers" ADD CONSTRAINT "scene_folder_performers_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_folder_tags" ADD CONSTRAINT "scene_folder_tags_scene_folder_id_scene_folders_id_fk" FOREIGN KEY ("scene_folder_id") REFERENCES "public"."scene_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_folder_tags" ADD CONSTRAINT "scene_folder_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scene_folder_performers_pk" ON "scene_folder_performers" USING btree ("scene_folder_id","performer_id");--> statement-breakpoint
CREATE INDEX "scene_folder_performers_performer_idx" ON "scene_folder_performers" USING btree ("performer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_folder_tags_pk" ON "scene_folder_tags" USING btree ("scene_folder_id","tag_id");--> statement-breakpoint
CREATE INDEX "scene_folder_tags_tag_idx" ON "scene_folder_tags" USING btree ("tag_id");--> statement-breakpoint
ALTER TABLE "scene_folders" ADD CONSTRAINT "scene_folders_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE set null ON UPDATE no action;