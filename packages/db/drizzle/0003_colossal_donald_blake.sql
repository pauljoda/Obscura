CREATE TABLE "fingerprint_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" uuid NOT NULL,
	"stash_box_endpoint_id" uuid NOT NULL,
	"algorithm" text NOT NULL,
	"hash" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fingerprint_submissions" ADD CONSTRAINT "fingerprint_submissions_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fingerprint_submissions" ADD CONSTRAINT "fingerprint_submissions_stash_box_endpoint_id_stash_box_endpoints_id_fk" FOREIGN KEY ("stash_box_endpoint_id") REFERENCES "public"."stash_box_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fingerprint_submissions_unique" ON "fingerprint_submissions" USING btree ("scene_id","stash_box_endpoint_id","algorithm","hash");--> statement-breakpoint
CREATE INDEX "fingerprint_submissions_scene_idx" ON "fingerprint_submissions" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "fingerprint_submissions_endpoint_idx" ON "fingerprint_submissions" USING btree ("stash_box_endpoint_id");