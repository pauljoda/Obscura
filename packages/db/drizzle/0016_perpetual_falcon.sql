-- Retire library_settings.use_library_root_as_folder. The videos-to-
-- series model gives seasons first-class status, so the library root
-- is never treated as a folder anywhere in the app. Audio and gallery
-- scans now hardcode the "folder starts at first subdirectory" depth
-- rule. IF EXISTS so installs that already finalized without the
-- column re-apply the migration as a no-op.
ALTER TABLE "library_settings" DROP COLUMN IF EXISTS "use_library_root_as_folder";
