ALTER TABLE "collections" ADD COLUMN "is_nsfw" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "collections_nsfw_idx" ON "collections" USING btree ("is_nsfw");