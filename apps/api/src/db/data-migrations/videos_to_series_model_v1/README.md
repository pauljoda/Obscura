# videos_to_series_model_v1

Two-phase data migration that moves Obscura's video library from the
legacy `scenes` + `scene_folders` shape into the typed
`video_series` / `video_seasons` / `video_episodes` / `video_movies`
model.

## Files

- `index.ts` — assembles the `DataMigration` export.
- `precheck.ts` — detects whether the migration should run.
- `stage.ts` — non-destructive copy from legacy to new tables.
- `finalize.ts` — destructive drop of legacy tables.
- `legacy-schema.ts` — frozen drizzle definitions of retired tables.
  Delete this file (and `read.ts`) after finalize has shipped to
  production in Plan E.
- `read.ts` — query helpers that use the legacy schema.
- `series-tree.ts` — pure helper that groups classified episodes
  into a series→season tree.
- `migration.integration.test.ts` — end-to-end test against a real
  postgres database (skipped when `DATABASE_URL` is unset).

## Registration status

**This migration is NOT registered in `registry.ts` as of Plan B.**
Plan D ships both the UI banner that surfaces it and the code that
registers it, because landing registration without the UI would put
the app in permanent lockdown. Between Plan B and Plan D the module
exists, is fully tested, and is ready to plug in.

## Idempotency

`stage()` is not currently idempotent. The precheck refuses to run
if any `video_*` table already has rows, so a second stage() call
bails. If Plan D needs to support partial-retry of a crashed stage,
revisit this — the framework contract requires idempotency.

## Data preserved from the old model

Per-entity carry-over:

- `rating`, `isNsfw`, `organized`
- `play_count`, `orgasm_count`, `play_duration`, `resume_time`, `last_played_at`
- All file/probe metadata (duration, width, codec, checksums, etc.)
- All generated asset paths (thumbnails, previews, sprites, trickplay)
- Performer and tag links (via join-table rewrites)
- `scene_folders` metadata (customName, details, studio, cover, backdrop, externalSeriesId as `tmdb`) onto the corresponding `video_series` row.
- `scrape_results` entity-type remapping (`scene`/`scene_folder` → `movie`/`episode`/`series`).

Not preserved:

- Subtitle rows. Subtitles will be re-ingested by Plan D's new scan
  pipeline. Cached subtitle files on disk survive.
- Scene markers. The feature is unused by the existing scan pipeline
  and the new model does not have a `video_episode_markers` table yet.

## Running the integration test

The integration test requires a reachable postgres database and a
clean schema. Do not run it against your primary dev DB — the
second test drops the legacy tables and leaves it in a broken state.
Use an ephemeral test database:

```bash
docker compose -f infra/docker/docker-compose.yml exec -T postgres \
  psql -U obscura -d postgres -c "DROP DATABASE IF EXISTS obscura_test"
docker compose -f infra/docker/docker-compose.yml exec -T postgres \
  psql -U obscura -d postgres -c "CREATE DATABASE obscura_test"
DATABASE_URL=postgres://obscura:obscura@localhost:5432/obscura_test \
  pnpm --filter @obscura/api db:migrate
DATABASE_URL=postgres://obscura:obscura@localhost:5432/obscura_test \
  pnpm --filter @obscura/api exec vitest run migration.integration
docker compose -f infra/docker/docker-compose.yml exec -T postgres \
  psql -U obscura -d postgres -c "DROP DATABASE obscura_test"
```
