-- Remove per-marker tag link (tags remain on scenes / tracks / galleries via junction tables).
ALTER TABLE scene_markers DROP COLUMN IF EXISTS primary_tag_id;
ALTER TABLE audio_track_markers DROP COLUMN IF EXISTS primary_tag_id;
