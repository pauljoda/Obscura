CREATE TABLE "playlist_sessions" (
	"key" text PRIMARY KEY NOT NULL,
	"collection_id" uuid,
	"collection_name" text NOT NULL,
	"items" jsonb NOT NULL,
	"play_order" jsonb NOT NULL,
	"order_position" integer DEFAULT 0 NOT NULL,
	"shuffle" boolean DEFAULT false NOT NULL,
	"loop" boolean DEFAULT false NOT NULL,
	"slideshow_duration_seconds" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "playlist_sessions" ADD CONSTRAINT "playlist_sessions_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;