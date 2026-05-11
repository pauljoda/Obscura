CREATE TABLE "book_volumes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "book_id" uuid NOT NULL,
  "volume_number" integer,
  "title" text NOT NULL,
  "folder_path" text,
  "relative_path" text,
  "cover_image_path" text,
  "external_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_volumes" ADD CONSTRAINT "book_volumes_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "book_chapters" ADD COLUMN "volume_id" uuid;
--> statement-breakpoint
ALTER TABLE "book_chapters" ADD CONSTRAINT "book_chapters_volume_id_book_volumes_id_fk" FOREIGN KEY ("volume_id") REFERENCES "public"."book_volumes"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "book_volumes_book_idx" ON "book_volumes" USING btree ("book_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "book_volumes_book_number_idx" ON "book_volumes" USING btree ("book_id","volume_number");
--> statement-breakpoint
CREATE UNIQUE INDEX "book_volumes_book_relative_idx" ON "book_volumes" USING btree ("book_id","relative_path");
