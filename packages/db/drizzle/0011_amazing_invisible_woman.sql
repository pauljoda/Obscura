ALTER TABLE "scrape_results" ADD COLUMN "proposed_result" jsonb;--> statement-breakpoint
ALTER TABLE "scrape_results" ADD COLUMN "cascade_parent_id" uuid;--> statement-breakpoint
ALTER TABLE "scrape_results"
  ADD CONSTRAINT "scrape_results_cascade_parent_id_fk"
  FOREIGN KEY ("cascade_parent_id")
  REFERENCES "scrape_results"("id")
  ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scrape_results_cascade_parent_idx"
  ON "scrape_results" ("cascade_parent_id");
