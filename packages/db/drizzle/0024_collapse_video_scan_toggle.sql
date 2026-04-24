-- Collapse the per-kind video scan toggles (`scan_movies`, `scan_series`)
-- back into a single `scan_videos` flag now that the UI exposes one
-- "Videos" toggle per library root. Backfill `scan_videos` from the OR
-- of the legacy columns so a root with either one enabled stays
-- scannable.
ALTER TABLE "library_roots"
  ADD COLUMN IF NOT EXISTS "scan_videos" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
UPDATE "library_roots"
SET "scan_videos" = (
  COALESCE("scan_movies", true) OR COALESCE("scan_series", true)
)
WHERE EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'library_roots'
    AND column_name IN ('scan_movies', 'scan_series')
);
--> statement-breakpoint
ALTER TABLE "library_roots" DROP COLUMN IF EXISTS "scan_movies";
--> statement-breakpoint
ALTER TABLE "library_roots" DROP COLUMN IF EXISTS "scan_series";
