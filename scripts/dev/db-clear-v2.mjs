#!/usr/bin/env node
import {
  DEFAULT_COMPOSE_FILE,
  DEFAULT_DATABASE_URL,
  DEFAULT_POSTGRES_SERVICE,
  databaseParts,
  dockerComposeArgs,
  envForLocalPostgres,
  parseArgs,
  run,
  toolMode,
} from "./db-snapshot-utils.mjs";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`Usage: pnpm dev:db:clear-v2 --yes [--docker|--local] [--dry-run]

Clears v2 migration data from the local development database, then
re-preserves legacy library settings and roots for another migration pass.

Defaults:
  DATABASE_URL=${DEFAULT_DATABASE_URL}
  --compose-file=${DEFAULT_COMPOSE_FILE}
  --service=${DEFAULT_POSTGRES_SERVICE}`);
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
const dryRun = Boolean(args["dry-run"]);

if (!args.yes && !dryRun) {
  throw new Error("Refusing to clear v2 data without --yes. This resets local v2 migration tables.");
}

const mode = toolMode(args, "psql");
const { database, user } = databaseParts(databaseUrl);

const clearSql = `
DO $$
DECLARE
    v2_tables text;
BEGIN
    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ' ORDER BY tablename)
    INTO v2_tables
    FROM pg_tables
    WHERE schemaname = 'v2';

    IF v2_tables IS NULL THEN
        RAISE NOTICE 'No v2 schema tables found; nothing to clear.';
        RETURN;
    END IF;

    EXECUTE 'TRUNCATE TABLE ' || v2_tables || ' RESTART IDENTITY CASCADE';

    IF to_regclass('v2.library_settings') IS NOT NULL
       AND to_regclass('public.library_settings') IS NOT NULL THEN
        INSERT INTO v2.library_settings (
            id,
            auto_scan_enabled,
            scan_interval_minutes,
            auto_generate_metadata,
            auto_generate_fingerprints,
            generate_phash,
            auto_generate_preview,
            generate_trickplay,
            trickplay_interval_seconds,
            preview_clip_duration_seconds,
            thumbnail_quality,
            trickplay_quality,
            background_worker_concurrency,
            nsfw_lan_auto_enable,
            hide_nsfw,
            metadata_storage_dedicated,
            subtitles_auto_enable,
            subtitles_preferred_languages,
            subtitle_style,
            subtitle_font_scale,
            subtitle_position_percent,
            subtitle_opacity,
            default_playback_mode,
            show_cast_controls,
            created_at,
            updated_at
        )
        SELECT
            id,
            auto_scan_enabled,
            scan_interval_minutes,
            auto_generate_metadata,
            auto_generate_fingerprints,
            generate_phash,
            auto_generate_preview,
            generate_trickplay,
            trickplay_interval_seconds,
            preview_clip_duration_seconds,
            thumbnail_quality,
            trickplay_quality,
            background_worker_concurrency,
            nsfw_lan_auto_enable,
            false,
            metadata_storage_dedicated,
            subtitles_auto_enable,
            subtitles_preferred_languages,
            subtitle_style,
            subtitle_font_scale,
            subtitle_position_percent,
            subtitle_opacity,
            default_playback_mode,
            show_cast_controls,
            created_at,
            updated_at
        FROM public.library_settings
        ORDER BY created_at
        LIMIT 1;
    END IF;

    IF to_regclass('v2.library_roots') IS NOT NULL
       AND to_regclass('public.library_roots') IS NOT NULL THEN
        INSERT INTO v2.library_roots (
            id,
            path,
            label,
            enabled,
            recursive,
            scan_videos,
            scan_images,
            scan_audio,
            scan_books,
            is_nsfw,
            last_scanned_at,
            created_at,
            updated_at
        )
        SELECT
            id,
            path,
            label,
            enabled,
            recursive,
            scan_videos,
            scan_images,
            scan_audio,
            scan_books,
            is_nsfw,
            last_scanned_at,
            created_at,
            updated_at
        FROM public.library_roots
        ORDER BY path;
    END IF;
END $$;
`;

if (mode === "local") {
  await run("psql", ["--set", "ON_ERROR_STOP=1", "--command", clearSql], {
    dryRun,
    env: envForLocalPostgres(databaseUrl),
  });
} else {
  const service = String(args.service ?? DEFAULT_POSTGRES_SERVICE);
  await run(
    "docker",
    dockerComposeArgs(args, service, [
      "psql",
      "-U",
      user,
      "-d",
      database,
      "--set",
      "ON_ERROR_STOP=1",
      "--command",
      clearSql,
    ]),
    { dryRun },
  );
}

console.log(`${dryRun ? "Planned v2 data reset" : "Cleared v2 data for local migration testing"}.`);
