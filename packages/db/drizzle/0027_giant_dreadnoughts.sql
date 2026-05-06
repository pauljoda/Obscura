ALTER TABLE "video_episodes" ADD COLUMN "subtitles_extracted_at" timestamp;--> statement-breakpoint
ALTER TABLE "video_movies" ADD COLUMN "subtitles_extracted_at" timestamp;--> statement-breakpoint
-- Backfill: any video with at least one already-extracted embedded subtitle
-- row has clearly been through extraction once. Mark it done so the new
-- scan-side completion check can skip re-enqueueing it. Videos with no
-- embedded subtitle row still get re-probed once (which is correct — we
-- can't tell "no streams" from "never tried" without that probe).
UPDATE "video_episodes" SET "subtitles_extracted_at" = now()
  WHERE EXISTS (
    SELECT 1 FROM "video_subtitles"
    WHERE "video_subtitles"."entity_type" = 'video_episode'
      AND "video_subtitles"."entity_id" = "video_episodes"."id"
      AND "video_subtitles"."source" = 'embedded'
  );--> statement-breakpoint
UPDATE "video_movies" SET "subtitles_extracted_at" = now()
  WHERE EXISTS (
    SELECT 1 FROM "video_subtitles"
    WHERE "video_subtitles"."entity_type" = 'video_movie'
      AND "video_subtitles"."entity_id" = "video_movies"."id"
      AND "video_subtitles"."source" = 'embedded'
  );