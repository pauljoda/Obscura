CREATE TABLE "media_file_ignores" (
	"path" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"reason" text DEFAULT 'deleted-from-library' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "media_file_ignores_entity_type_idx" ON "media_file_ignores" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "media_file_ignores_created_at_idx" ON "media_file_ignores" USING btree ("created_at");