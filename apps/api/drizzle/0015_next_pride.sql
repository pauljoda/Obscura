-- Flip the scan_movies / scan_series defaults to TRUE so new library
-- roots opt into the new scan pipeline by default.
ALTER TABLE "library_roots" ALTER COLUMN "scan_movies" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "library_roots" ALTER COLUMN "scan_series" SET DEFAULT true;--> statement-breakpoint

-- Recovery backfill: migration 0010 added scan_movies + scan_series
-- with DEFAULT false and never copied from scan_videos. Installs that
-- had video roots ended up with both toggles off, which (a) broke
-- post-migration scans and (b) caused pruneUntrackedLibraryReferences
-- to treat every row as orphaned and wipe the video tables. Flip both
-- toggles on for any root that still has both set to false AND isn't
-- a pure image / audio library. On pre-0014 installs (scan_videos
-- still present) we respect that flag; on post-0014 installs we fall
-- back to "not explicitly an image or audio only root".
DO $$
DECLARE
  has_scan_videos boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'library_roots'
      AND column_name = 'scan_videos'
  ) INTO has_scan_videos;

  IF has_scan_videos THEN
    EXECUTE $sql$
      UPDATE library_roots
      SET scan_movies = TRUE, scan_series = TRUE
      WHERE scan_videos = TRUE
        AND scan_movies = FALSE
        AND scan_series = FALSE
    $sql$;
  ELSE
    -- Post-finalize: scan_videos is gone. Turn the new toggles on for
    -- any root where both are false AND at least one non-video toggle
    -- is also off (i.e. this root isn't exclusively an image/audio
    -- library). Roots that are intentionally image-only or audio-only
    -- are left alone.
    UPDATE library_roots
    SET scan_movies = TRUE, scan_series = TRUE
    WHERE scan_movies = FALSE
      AND scan_series = FALSE
      AND NOT (scan_images = TRUE AND scan_audio = FALSE)
      AND NOT (scan_audio = TRUE AND scan_images = FALSE);
  END IF;
END $$;
