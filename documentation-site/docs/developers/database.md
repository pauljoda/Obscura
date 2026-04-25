---
sidebar_position: 3
title: Database
description: Schema overview, versioned migrations, and the breaking-gate pattern.
---

# Database

PostgreSQL 16, accessed through Drizzle ORM. The schema is a single TypeScript file; migrations are versioned SQL files generated from it; the breaking-gate is the pattern for destructive changes that need user consent.

## Schema overview

`packages/db/src/schema.ts` defines every table. Here it is grouped by domain.

### Library & settings

| Table | Holds |
| --- | --- |
| `library_roots` | One row per watched path. `path`, `label`, `recursive`, `scan_videos`, `scan_galleries`, `scan_audio`, `scan_images`, `is_nsfw`, `last_scanned_at`. |
| `library_settings` | Singleton row with global scan + generation + playback settings. |
| `ui_prefs` | Per-list preferences (view mode, sort, filters, presets). One row per key, opaque JSON value. |

### Videos

The video model is hierarchical and replaces the legacy `scenes`/`scene_folders` tables.

| Table | Holds |
| --- | --- |
| `video_series` | Series-level row. `library_root_id`, `folder_path`, `title`, `overview`, `poster_path`, `backdrop_path`, `logo_path`, `studio_id`, plus rating/NSFW/external IDs. |
| `video_seasons` | One row per season under a series. `series_id`, `season_number`, `folder_path`, `title`, `poster_path`, `air_date`. |
| `video_episodes` | One row per episode file. `season_id`, `series_id`, `episode_number`, `title`, `file_path`, `duration`, `width`, `height`, `frame_rate`, `bit_rate`, `codec`, `container`, `oshash`, `md5`, `phash`, plus thumbnail/preview/sprite/trickplay paths and playback stats (`play_count`, `play_duration`, `resume_time`, `last_played_at`). |
| `video_movies` | Same shape as `video_episodes` but standalone. `library_root_id`, `title`, `release_date`, `runtime`, `poster_path`, `backdrop_path`, `studio_id`, `file_path`, plus the same playback/fingerprint fields. |
| `video_subtitles` | Per-video subtitle tracks. `entity_type` (`episode`/`movie`), `entity_id`, `language`, `format`, `source` (`sidecar`/`upload`/`embedded`), `storage_path`. |
| `video_markers` | Per-video time-stamped markers. `entity_type`, `entity_id`, `title`, `seconds`, `end_seconds`. |
| Join tables | `video_movie_performers`, `video_movie_tags`, `video_series_performers`, `video_series_tags`, `video_episode_performers`, `video_episode_tags`. |

### Galleries & images

| Table | Holds |
| --- | --- |
| `galleries` | `gallery_type` (`virtual`/`folder`/`zip`), `folder_path`, `zip_file_path`, `cover_image_id`, `image_count`, `studio_id`, plus rating/NSFW. |
| `images` | Loose images and gallery members. `file_path` (supports zip member paths like `/path/archive.cbz::member/file.jpg`), `file_size`, `width`, `height`, `format`, `thumbnail_path`, `checksum_md5`, `oshash`, `gallery_id`, `sort_order`. |
| `gallery_chapters` | Optional chapter markers in a gallery. |
| Join tables | `gallery_performers`, `gallery_tags`, `image_performers`, `image_tags`. |

### Audio

| Table | Holds |
| --- | --- |
| `audio_libraries` | Album / library row. `folder_path`, `cover_image_path`, `track_count`, `studio_id`. |
| `audio_tracks` | Per-track row. `library_id`, `file_path`, `duration`, `bit_rate`, `sample_rate`, `channels`, `codec`, `container`, `embedded_artist`, `embedded_album`, `track_number`, `waveform_path`, plus playback stats. |
| `audio_track_markers` | Time-stamped markers. |
| Join tables | `audio_library_performers`, `audio_library_tags`, `audio_track_performers`, `audio_track_tags`. |

### Taxonomy

| Table | Holds |
| --- | --- |
| `performers` | `name`, `aliases`, `gender`, `birthdate`, `country`, `ethnicity`, `eye_color`, `hair_color`, `height`, `weight`, `career_start`, `career_end`, `details`, plus image fields. |
| `studios` | `name`, `description`, `aliases`, `url`, `parent_id`, plus image fields. |
| `tags` | `name`, `description`, `aliases`, `parent_id`, `ignore_auto_tag`, plus image fields. |
| `performer_tags` | Performer-to-tag join. |

### Collections

| Table | Holds |
| --- | --- |
| `collections` | `mode` (`manual`/`dynamic`/`hybrid`), `rule_tree` (JSONB rule expression), `cover_mode` (`mosaic`/`custom`/`item`), `slideshow_duration_seconds`, `last_refreshed_at`. |
| `collection_items` | `collection_id`, `entity_type`, `entity_id`, `source` (`manual`/`dynamic`), `sort_order`. |
| `playlist_sessions` | One row per playlist session. `collection_id`, `items` (JSONB), `play_order`, `order_position`, `shuffle`, `loop`. |

### Plugins, scrapers, scrape state

| Table | Holds |
| --- | --- |
| `plugin_packages` | Installed plugins. `plugin_id`, `version`, `runtime` (`typescript`/`python`/`stash-compat`), `install_path`, `sha256`, `capabilities` (JSONB), `manifest_raw`, `enabled`, `source_index`. |
| `plugin_auth` | Per-plugin auth credentials. `plugin_id`, `auth_key`, `encrypted_value`. |
| `scraper_packages` | Stash-compat scraper packages (separate from plugin_packages for legacy reasons). |
| `stashbox_endpoints` | StashBox endpoint config. `name`, `endpoint`, `api_key`, `enabled`. |
| `scrape_results` | Pending or applied identify results. `entity_type`, `entity_id`, `proposed_*` fields, `cascade_parent_id`, `status` (`pending`/`accepted`/`rejected`/`errored`), `applied_at`. |
| `external_ids` | External provider IDs per entity. `entity_type`, `entity_id`, `provider`, `external_id`, `external_url`. |
| `stash_ids` | StashBox-specific external IDs. `entity_type`, `entity_id`, `stashbox_endpoint_id`, `stash_id`. |
| `fingerprint_submissions` | Audit log for fingerprints submitted back to StashBox. `entity_type`, `entity_id`, `stashbox_endpoint_id`, `algorithm`, `hash`, `status`. |

### Operations

| Table | Holds |
| --- | --- |
| `job_runs` | The Operations dashboard ledger. One row per job execution. `queue_name`, `bullmq_job_id`, `status`, `target_type`, `target_id`, `target_label`, `progress`, `attempts`, `payload`, `error`, `started_at`, `finished_at`. |
| `pgboss.*` | pg-boss internal state. Don't read or write directly. |

## Versioned migrations

Schema lives in `packages/db/src/schema.ts`. Migrations are SQL files in `packages/db/drizzle/`, generated by `drizzle-kit` and committed to the repo.

The migration runner (`packages/db/src/migrate.ts`) is invoked from both `apps/web-svelte` and `apps/worker` on startup. It uses the `drizzle.__drizzle_migrations` table as the ledger — each migration applies exactly once per database.

### Adding a schema change

```bash
# 1. Edit the schema
$EDITOR packages/db/src/schema.ts

# 2. Generate the SQL diff
pnpm --filter @obscura/db db:generate

# 3. READ the generated SQL (this is the important step)
$EDITOR packages/db/drizzle/NNNN_<name>.sql
```

Drizzle-kit is conservative but **will** emit destructive SQL when intent is ambiguous — column renames look like drop+add, optional fields look like NOT NULL drops, etc. Always read the generated file before committing it.

```bash
# 4. Commit schema + migration + snapshot + journal together
git add packages/db/src/schema.ts \
        packages/db/drizzle/NNNN_<name>.sql \
        packages/db/drizzle/meta/

# 5. Apply locally
pnpm --filter @obscura/db db:migrate
# (or just restart the web app / worker — they run migrations on boot)
```

### Idempotent SQL

When the migration drops or alters something that may not exist on every install, use idempotent SQL by hand:

```sql
DROP TABLE IF EXISTS legacy_thing CASCADE;
ALTER TABLE foo DROP COLUMN IF EXISTS bar;
CREATE INDEX IF NOT EXISTS foo_bar_idx ON foo(bar);
```

This makes migrations safe on installs that never had the thing being dropped.

### `db:generate` vs `db:push`

| Command | What it does | When to use |
| --- | --- | --- |
| `db:generate` | Diff schema vs the saved snapshot, write a new SQL migration file. | **Always**, when changing schema. Versioned, reviewable, ships in releases. |
| `db:push` | Apply the schema diff directly to a running database, no SQL file written. | **Never** against a deployment you care about. Useful only for throwaway local experiments. |

`db:push` bypasses the migration ledger and the breaking-gate. If you accidentally run it against a real database, the next deployment that runs migrations may fail or, worse, drop unexpected columns.

## The breaking-gate

When a migration would destroy user data, we ship a one-time **breaking-gate** that blocks startup until the user explicitly consents. The pattern is in `packages/db/src/breaking-gate.ts`.

### How it works

1. Define a single-purpose gate ID for the breaking change (e.g. `scenes-to-videos-v0.20`).
2. The gate check runs **before** the migrator on app boot:
   - If a marker file exists at `/data/.breaking-gate/<gate-id>.accepted` → gate passes.
   - If no row count exists in the doomed table(s) → gate passes (nothing to lose).
   - Otherwise → gate blocks startup and the API exposes the gate state.
3. The web app reads `/api/system/status` on layout load. If the gate is blocking, it renders `BreakingUpgradeGate.svelte` instead of the dashboard.
4. User consents → `/api/system/breaking-gate/accept` writes the marker file and restarts the API process.
5. On restart the gate passes; the migrator runs the destructive migration.

### When to use it

Add a gate when the migration drops a populated table or otherwise destroys data the user hasn't been warned about. Don't add a gate for additive changes — `CREATE TABLE`, new columns with defaults, new indexes.

### Don't abstract this

The breaking-gate is a **pattern**, not a framework. The current implementation handles one gate at a time. If a future break needs another gate, copy the pattern; don't generalize. When the gate becomes irrelevant (the destructive migration has been deployed everywhere), delete it.

The CLAUDE.md "Breaking-change policy" section is the authoritative version of this guidance.

## Querying outside the app

For maintenance, debugging, or one-off scripts, you can connect with `psql` or any Postgres client:

```bash
docker compose exec obscura psql -U obscura -d obscura
```

Useful queries:

```sql
-- Recent failed jobs
SELECT queue_name, target_label, error, finished_at
FROM job_runs WHERE status = 'failed'
ORDER BY finished_at DESC LIMIT 20;

-- Episodes missing a fingerprint
SELECT id, file_path FROM video_episodes
WHERE oshash IS NULL OR md5 IS NULL;

-- Library root scan-flag overview
SELECT path, scan_videos, scan_galleries, scan_audio, scan_images, is_nsfw
FROM library_roots ORDER BY path;
```

Don't write to `pgboss.*` directly — it has invariants the queue depends on. Stick to `job_runs` for read-only inspection.
