CREATE TABLE "collection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"mode" text DEFAULT 'manual' NOT NULL,
	"rule_tree" jsonb,
	"item_count" integer DEFAULT 0 NOT NULL,
	"cover_mode" text DEFAULT 'mosaic' NOT NULL,
	"cover_image_path" text,
	"cover_item_id" uuid,
	"cover_item_type" text,
	"slideshow_duration_seconds" integer DEFAULT 5 NOT NULL,
	"slideshow_auto_advance" boolean DEFAULT true NOT NULL,
	"last_refreshed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_items_unique" ON "collection_items" USING btree ("collection_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "collection_items_collection_idx" ON "collection_items" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "collection_items_entity_idx" ON "collection_items" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "collection_items_sort_idx" ON "collection_items" USING btree ("collection_id","sort_order");--> statement-breakpoint
CREATE INDEX "collections_name_idx" ON "collections" USING btree ("name");--> statement-breakpoint
CREATE INDEX "collections_mode_idx" ON "collections" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "collections_created_at_idx" ON "collections" USING btree ("created_at");