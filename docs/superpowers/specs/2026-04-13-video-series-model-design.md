# Video Series Model — Design Spec

**Date:** 2026-04-13
**Status:** Draft, pending user review
**Scope:** Videos subsystem only (movies, series, seasons, episodes). Images, galleries, and audio are out of scope for this reshape.

---

## 1. Goal

Restructure Obscura's video subsystem around a typed Series → Season → Episode / Movie model, replacing the current `scenes` + `scene_folders` representation. In the same work, refine the MovieDB (TMDb) plugin into a full cascade identification agent with a rich review UI, and introduce a reusable staged-migration framework so this and future schema reshapes can ship without a dump-and-restore.

Success means:

- Libraries classify their contents as Movies, Series, or both based on explicit toggles and disk layout.
- Series have first-class seasons and episodes with their own metadata, their own images, and their own plugin identification flow.
- A single TMDb identification run against a series fetches series + season + episode metadata in one cascade, and the user reviews and accepts (or partially accepts) everything in one screen.
- Existing installs upgrade in place via a two-phase staged migration that preserves user work (ratings, watch state, NSFW toggles, play counts, organized flag) without breaking the app.
- The folder view UI is preserved visually but driven by the new typed entities.

## 2. Non-goals

- Image, gallery, and audio tables are untouched.
- No UI rewrite. Existing views are adapted to the new data, not replaced.
- No new scan diagnostics UI beyond what already exists (may come in a follow-up).
- No preemptive creation of empty seasons the user hasn't downloaded.
- No drag-and-drop episode reassignment in the review screen (button pickers only for v1).

## 3. Background

Today, the videos subsystem uses:

- `scenes` — one row per video file, carrying metadata, probe data, watch state, and a single `episodeNumber` integer.
- `scene_folders` — hierarchical folders derived from disk, conflating "filesystem directory" with "semantic grouping." Carries cover/backdrop, studio, performers, rating, `externalSeriesId`.
- `scene_performers`, `scene_tags`, `scene_markers`, `scene_folder_performers`, `scene_folder_tags` — join tables.
- A plugin system that returns a single `NormalizedFolderResult` shape for folder-level identification, with support for `episodeMap`-style cascading that is incompletely wired through the UI.

The core problem is that "scene" (borrowed from Stash) is the wrong abstraction for a world where users want TV shows with seasons, episodes, and specials. The current model forces every concept through scene/scene_folder, which is why the MovieDB plugin only produces series-level metadata today — there's no typed place for season or episode data to land.

Obscura has few installs, is pre-1.0, and the user has explicitly authorized breaking the schema in exchange for a correct model.

## 4. Data model

### 4.1 New tables

All four tables use a flexible JSONB map for external IDs instead of dedicated provider columns.

**`video_series`** — one row per show.

```
id                uuid pk
library_root_id   uuid fk library_roots.id
folder_path       text unique not null
relative_path     text not null
title             text not null
sort_title        text
original_title    text
overview          text
tagline           text
status            text                 -- 'returning' | 'ended' | 'canceled' | 'unknown'
first_air_date    date
end_air_date      date
poster_path       text
backdrop_path     text
logo_path         text
studio_id         uuid fk studios.id
rating            numeric
content_rating    text
is_nsfw           boolean not null default false
organized         boolean not null default false
external_ids      jsonb not null default '{}'::jsonb
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
```

**`video_seasons`** — one row per season of a series.

```
id              uuid pk
series_id       uuid fk video_series.id on delete cascade
season_number   integer not null      -- 0 = Specials, positive = numbered season
folder_path     text                  -- nullable: synthetic seasons for flat series have null
title           text
overview        text
poster_path     text
air_date        date
external_ids    jsonb not null default '{}'::jsonb
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()
unique (series_id, season_number)
```

**`video_episodes`** — one row per episode file.

```
id                        uuid pk
season_id                 uuid fk video_seasons.id on delete cascade
series_id                 uuid fk video_series.id     -- denormalized for query speed
season_number             integer not null
episode_number            integer                     -- may be null for absolute-numbered
absolute_episode_number   integer                     -- may be null
title                     text
overview                  text
air_date                  date
still_path                text
runtime                   integer
external_ids              jsonb not null default '{}'::jsonb

-- file identity and probe
file_path                 text unique not null
file_size                 bigint
duration                  numeric
width                     integer
height                    integer
frame_rate                numeric
bit_rate                  integer
codec                     text
container                 text
checksum_md5              text
oshash                    text
phash                     text

-- generated assets
thumbnail_path            text
card_thumbnail_path       text
preview_path              text
sprite_path               text
trickplay_vtt_path        text

-- watch state and user fields
play_count                integer not null default 0
orgasm_count              integer not null default 0
play_duration             numeric not null default 0
resume_time               numeric
last_played_at            timestamptz
rating                    numeric
is_nsfw                   boolean not null default false
organized                 boolean not null default false

created_at                timestamptz not null default now()
updated_at                timestamptz not null default now()
```

**`video_movies`** — one row per movie file.

```
id                        uuid pk
library_root_id           uuid fk library_roots.id
title                     text not null
sort_title                text
original_title            text
overview                  text
tagline                   text
release_date              date
runtime                   integer
poster_path               text
backdrop_path             text
logo_path                 text
studio_id                 uuid fk studios.id
rating                    numeric
content_rating            text
is_nsfw                   boolean not null default false
organized                 boolean not null default false
external_ids              jsonb not null default '{}'::jsonb

-- file identity, probe, generated assets, and watch state: same columns as video_episodes
file_path                 text unique not null
file_size                 bigint
duration                  numeric
width                     integer
height                    integer
frame_rate                numeric
bit_rate                  integer
codec                     text
container                 text
checksum_md5              text
oshash                    text
phash                     text
thumbnail_path            text
card_thumbnail_path       text
preview_path              text
sprite_path               text
trickplay_vtt_path        text
play_count                integer not null default 0
orgasm_count              integer not null default 0
play_duration             numeric not null default 0
resume_time               numeric
last_played_at            timestamptz
created_at                timestamptz not null default now()
updated_at                timestamptz not null default now()
```

### 4.2 Typed join tables

Each entity has its own join tables. No polymorphism.

- `video_movie_performers (movie_id, performer_id, character, order)`
- `video_movie_tags (movie_id, tag_id)`
- `video_series_performers (series_id, performer_id, character, order)` — regular cast
- `video_series_tags (series_id, tag_id)` — genres and freeform tags
- `video_episode_performers (episode_id, performer_id, character, order)` — guest stars
- `video_episode_tags (episode_id, tag_id)`

Seasons have no direct join tables; they inherit from their series.

### 4.3 External IDs format

All four entity tables use `external_ids jsonb not null default '{}'`. Shape is a flat `provider → string` map:

```json
{ "tmdb": "1396", "imdb": "tt0903747", "tvdb": "81189", "anidb": "8692" }
```

- Values are always strings. A value may be a bare ID, a full URL, or a composite — the plugin decides the format and the consuming code expects a string.
- Known provider keys are defined in `@obscura/contracts` as `KnownExternalIdProviders` constants (`tmdb`, `tvdb`, `imdb`, `anidb`, `mal`, `trakt`, plus a `custom:<pluginId>` namespace). The constants drive display labels, link-out rendering, and plugin ergonomics. They are not enforced at the DB layer — a new plugin may write any key.
- Plugin access is mediated by typed helpers in `@obscura/plugins`:

  ```ts
  externalIds.get(entity, 'tmdb')      // → string | undefined
  externalIds.set(entity, 'tmdb', id)  // merges into existing map, does not clobber other keys
  externalIds.has(entity, 'tmdb')
  ```

  Plugins must only read and write their own keys; the helper enforces this by scoping via the plugin id passed in the auth context.
- Functional BTREE indexes on `(external_ids->>'tmdb')` for each of the four tables cover scraping-dedupe lookups. Additional index keys added per-plugin as need arises. No GIN indexes until multi-key ad-hoc queries become a real workload.
- A shared `ExternalIds` TypeScript type (`Record<string, string>`) lives in `@obscura/contracts` and is reused across the API, the worker, the plugins engine, and the web UI.

### 4.4 `library_roots` changes

- `scan_videos` boolean is replaced by two booleans: `scan_movies` and `scan_series`. Both may be enabled simultaneously.
- Existing `scan_images` and `scan_audio` booleans are untouched.
- `is_nsfw`, `recursive`, `label`, `path` are unchanged.

### 4.5 Retired tables

Deleted in the finalize phase of the staged migration:

- `scenes`
- `scene_folders`
- `scene_performers`
- `scene_tags`
- `scene_markers`
- `scene_folder_performers`
- `scene_folder_tags`

Any FKs or indexes referencing these tables are dropped in the same transaction.

### 4.6 Scrape results shape

`scrape_results` already has generic `entity_type` + `entity_id` columns. Changes:

- `entity_type` values become `movie`, `series`, `season`, `episode`. The legacy `scene` and `scene_folder` values are migrated.
- The family of `proposed_*` named columns (`proposed_title`, `proposed_date`, `proposed_details`, `proposed_url`, `proposed_studio_name`, `proposed_performer_names`, `proposed_tag_names`, `proposed_image_url`, `proposed_episode_number`, `proposed_folder_result`, `proposed_audio_result`) is dropped in favor of one column:

  ```
  proposed_result  jsonb  not null
  ```

  The JSONB holds the full `NormalizedScrapeResult` discriminated union as returned by the plugin, plus any user-side augmentations (e.g., image picker selections, per-field accept checkboxes) persisted between review sessions.

- A new nullable `cascade_parent_id uuid references scrape_results(id) on delete cascade` column links child season and episode scrape rows to the parent series scrape that produced them. The review UI walks `cascade_parent_id` to assemble the cascade tree.

### 4.7 Other FK updates

- `fingerprints` (and any subtitle/HLS cache table) that previously referenced `scenes` now reference either `video_episodes` or `video_movies`, or become polymorphic on `entity_type` + `entity_id`. The data migration walks the old scene ids and rewrites them based on classification.
- `job_runs` rows reference a string entity type + id; the orchestrator updates in-flight job payloads during migration where needed.

## 5. Library scan and parsing rules

### 5.1 Classification

Run after file discovery, before any DB writes. For each discovered video file:

1. Compute `depth` from the library root (0 = directly in root, 1 = one folder deep, etc).
2. Classify by depth and library toggles:

| Depth | scanMovies | scanSeries | Result |
|-------|------------|------------|--------|
| 0     | on         | —          | Movie  |
| 0     | off        | on         | Skipped with warning |
| 0     | off        | off        | Skipped |
| 1     | —          | on         | Episode of a flat series (the depth-1 folder is the series) |
| 1     | —          | off        | Skipped |
| 2     | —          | on         | Episode (depth-1 folder is series, depth-2 folder is season) |
| 2     | —          | off        | Skipped |
| ≥3    | —          | —          | Rejected with warning. Depth cap is 3 folder levels (library → series → season → episode). |

### 5.2 Season placement rule (two cases)

The placement of an episode file into a `video_seasons` row is determined by folder structure alone. The filename parser is used only to populate metadata fields — it never overrides placement.

**Case A — No season folders exist under the series.** The series is flat. A single `video_seasons` row is created with `season_number = 0`, `folder_path = NULL`, title defaulting to the series title. All episode files at the series root go into it. No other seasons exist for this series until identify moves episodes into numbered seasons.

**Case B — At least one season folder exists under the series.** Each recognized season folder (`Season 1`, `S01`, a pure-number folder, `Specials`, etc.) becomes its own `video_seasons` row. Loose files at the series root (siblings of the season folders) go into a `video_seasons` row with `season_number = 0` labeled **Specials**.

Data-layer, both cases use `season_number = 0` for the root-level container. UI-layer, Case A renders the series as a flat episode list (no season headers, no "Specials" label) and Case B renders numbered seasons followed by a Specials section. The renderer picks by checking whether any `video_seasons` rows exist for the series with `season_number > 0`.

Season 0 rows are created on demand only. An empty Season 0 is deleted.

### 5.3 Parsing library (`packages/media-core/src/parsing/`)

Pure, synchronous, deterministic, unit-testable. Never touches the DB.

**`parseSeasonFolder(name): { seasonNumber: number | null, title: string | null }`** — regex cascade:

- `Season 1`, `Season 01`, `season.1`, `Season_1`
- `S1`, `S01`, `S 01`
- `Saison 1`, `Temporada 1`, `Staffel 1` (common non-English variants)
- `Specials`, `Special`, `Extras`, `OVA` → `seasonNumber = 0`
- A folder whose entire name is a number → that number

**`parseSeriesFolder(name): { title: string, year: number | null }`** — extracts trailing `(2019)` or `[2019]` year hint, strips known release-group suffixes (`.1080p.WEB-DL.x264-GROUP`), collapses separators (`.` `_` → space). Display-title cleanup only, not a full sanitizer.

**`parseEpisodeFilename(name): { seasonNumber, episodeNumber, absoluteEpisodeNumber, title, year } | null`** — ordered regex cascade:

1. `S01E02`, `s1e2`, `S01.E02`, `S01xE02`
2. `1x02`, `01x02`
3. `Season 1 Episode 2`, `Season 1 - Episode 2`
4. Bare episode numbers with separator context (`Series Title - 05 -`, `Series Title.05.1080p`) → `absoluteEpisodeNumber` only, leaving `episodeNumber` null
5. Trailing ` E05`, `.e05`, `.ep05`

Title extraction takes everything after the SxxExx token, trimmed of release artifacts. Year from `(2019)` or `.2019.`.

**`parseMovieFilename(name): { title, year }`** — similar shape, expects no S/E token, extracts year and title.

### 5.4 Metadata source priority

All three sources run. Per-field, the higher-priority source wins:

1. **NFO** (XMl sidecar) — highest priority.
2. **JSON sidecar** (`.info.json` and compatible) — middle priority.
3. **Filename parser** — lowest priority (implied metadata, only fills gaps).

A partially-populated NFO does not block JSON or filename-parsed values from filling its gaps.

None of the three override folder-structure placement at scan time. Folder structure is authoritative for season assignment until an identify accept moves an episode to a different season.

### 5.5 Scan flow (replaces `processLibraryScan`)

1. Discover files (`discoverVideoFiles(root)` unchanged).
2. Classify each file into `movie | episode | skipped | rejected`.
3. Group episode files by series folder path and (where present) season folder path.
4. Upsert entities in order: `video_series` first keyed on `folder_path`, then `video_seasons` keyed on `(series_id, season_number)`, then `video_episodes` keyed on `file_path`. Movies upserted independently keyed on `file_path`.
5. On existing-row upserts, carry forward user state fields (`rating`, `is_nsfw`, `organized`, `play_count`, `orgasm_count`, `play_duration`, `resume_time`, `last_played_at`, custom title/overview if set). Do not touch parsed fields if `organized = true` — organized rows are user-confirmed and parser changes should not mutate them.
6. Remove stale rows: episodes with missing files are deleted; seasons with no remaining episodes are deleted; series with no remaining seasons are deleted; movies with missing files are deleted.
7. Enqueue `media-probe`, `fingerprint`, `preview`, `trickplay` jobs for new/changed entries, keyed by `entity_type` + `entity_id`.

`scene-folder-sync.ts` is retired — the scan writes typed entities directly. `useLibraryRootAsFolder` setting is retired — the library root is never treated as a folder in the new model.

Sidecar ingestion (NFO, `.info.json`, subtitles) still runs and writes to the typed tables.

## 6. Staged migration framework

### 6.1 Generic framework

**Schema:**

```
data_migrations
  name         text primary key
  status       text not null      -- 'pending' | 'staging' | 'staged' | 'finalizing' | 'complete' | 'failed'
  staged_at    timestamptz
  finalized_at timestamptz
  failed_at    timestamptz
  last_error   text
  metrics      jsonb not null default '{}'
  created_at   timestamptz not null default now()
  updated_at   timestamptz not null default now()
```

Distinct from drizzle's `__drizzle_migrations` table (which tracks DDL only).

**Interface** (`apps/api/src/db/data-migrations/types.ts`):

```ts
export interface DataMigration {
  name: string;
  description: string;
  precheck?(ctx: DataMigrationContext): Promise<PrecheckResult>;
  stage(ctx: DataMigrationContext): Promise<StageResult>;
  finalize(ctx: DataMigrationContext): Promise<FinalizeResult>;
}

export interface DataMigrationContext {
  db: PostgresJsDatabase<typeof schema>;
  logger: Logger;
  reportProgress(pct: number, message?: string): void;
}

export interface PrecheckResult { ok: boolean; reasons: string[] }
export interface StageResult    { metrics: Record<string, unknown>; warnings: string[] }
export interface FinalizeResult { metrics: Record<string, unknown> }
```

Each migration is a module under `apps/api/src/db/data-migrations/<name>/index.ts`. A registry file (`apps/api/src/db/data-migrations/registry.ts`) lists migrations in declared order.

**Orchestrator** (`apps/api/src/db/data-migrations/run.ts`, called from `migrate.ts` after drizzle DDL migrations):

1. Ensure `data_migrations` table exists (first drizzle migration).
2. For each registered migration in declared order:
   - Read its row; insert `pending` if absent.
   - If `complete` → skip.
   - If `pending` → run `precheck()`, bail on fail. Set `staging`, run `stage()` inside a single transaction, set `staged` with metrics. Continue boot.
   - If `staged` → continue boot but report a "migration pending finalize" state. Do not re-run `stage()`, do not auto-run `finalize()`.
   - If `failed` → continue boot into a degraded state; the API exposes the error to the UI for retry.
3. `/system/status` endpoint reports `{ migrations: [{ name, status, description }] }` so the web UI can render the banner and finalize button.

**Finalize endpoint:** `POST /system/migrations/:name/finalize`. Marks `finalizing`, runs `finalize()` inside a transaction, marks `complete` on success or `failed` + `last_error` on throw.

**Write lockdown during staged state.** While any migration is in `staged` or `finalizing` status, the API rejects writes to affected entities and the worker pauses background jobs (library scans, fingerprint/probe/preview, identify). Reads remain available. Image/gallery/audio routes continue normally. The goal is a "quiet" app during migration so the user can verify data without accidentally producing conflicting edits.

**Adapter pattern for legacy reads.** Code that reads retired tables must live in an adapter module owned by the migration. For `videos_to_series_model_v1`, this means:

- `apps/api/src/db/data-migrations/videos_to_series_model_v1/legacy-schema.ts` — frozen drizzle table definitions matching the old `scenes`, `scene_folders`, and friends as of the commit that introduces this migration.
- `apps/api/src/db/data-migrations/videos_to_series_model_v1/read.ts` — query helpers using the frozen schema.
- The main `packages/db/src/schema.ts` file contains only the new tables. The main codebase never knows about retired tables.
- On `finalize` success, the adapter module is deleted in a follow-up commit.

### 6.2 First migration: `videos_to_series_model_v1`

**Precheck:**

- Verify old `scenes` and `scene_folders` tables exist via the legacy-schema adapter. If absent → skip migration entirely (fresh install).
- Verify new `video_*` tables exist and are empty. If non-empty → bail: migration must run exactly once.

**Stage (inside one transaction, rollback on any throw):**

1. Classify every old `scenes` row as `movie` or `episode` using Section 5 rules resolved against current disk state. Missing files are skipped and counted in `metrics.missingFiles`.
2. Build the series/season map for classified episodes. Upsert `video_series` by `folder_path`, then `video_seasons` by `(series_id, season_number)`.
3. Create `video_episodes` rows, carrying forward: `file_path`, `file_size`, `duration`, `width`, `height`, `frame_rate`, `bit_rate`, `codec`, `container`, `checksum_md5`, `oshash`, `phash`, `thumbnail_path`, `card_thumbnail_path`, `preview_path`, `sprite_path`, `trickplay_vtt_path`, `play_count`, `orgasm_count`, `play_duration`, `resume_time`, `last_played_at`, `rating`, `is_nsfw`, `organized`, `created_at`. Set `updated_at = now()`. Parse filename for season/episode numbers; fall back to the old `scenes.episode_number` column where parsing fails.
4. Create `video_movies` rows, same carry-forward set of file/watch columns. Title from old `scenes.title`, overview from `scenes.details`, etc.
5. Rewrite `scene_performers` and `scene_tags` join rows into `video_episode_performers`/`video_movie_performers` and `video_episode_tags`/`video_movie_tags`, resolved by old-scene-id → new-entity-id mapping built in steps 3–4.
6. Carry over `scene_folders` metadata onto `video_series` rows where a `scene_folders` row maps to what's now a series: `custom_name` → `title` (if non-null), `details` → `overview`, `studio_id`, `rating`, `date` → `first_air_date`, `is_nsfw`, `cover_image_path` → `poster_path`, `backdrop_image_path` → `backdrop_path`. The legacy `external_series_id` column is assumed to be a TMDb id and written to `external_ids` as `{"tmdb": "..."}`; unrecognized formats are warned and skipped. `scene_folder_performers`/`scene_folder_tags` flow into `video_series_performers`/`video_series_tags`.
7. Rewrite `scrape_results.entity_type` values: `scene` rows re-point at the new `video_episodes` or `video_movies` row matched by `file_path`, `scene_folder` rows re-point at the new `video_series` row matched by folder path. Rows that can't be resolved are left orphaned and counted in `metrics.orphanedScrapes`.
8. Populate `data_migrations.metrics`: `{ moviesCreated, seriesCreated, seasonsCreated, episodesCreated, missingFiles, orphanedScrapes, rejectedByDepth }`.

**Post-stage, pre-finalize:** the API boots into a locked-down state. The web UI shows a banner:

> **Migration staged — Videos → Series model.** New video tables are populated. Review your library, and when you're ready, click **Finalize migration** to remove the old tables. Video writes are paused until migration completes.

Library scans and identify flows are disabled for video entities during this window. Reads against both old and new tables are permitted for the user to sanity-check.

**Finalize (destructive):**

1. Drop `scenes`, `scene_folders`, `scene_performers`, `scene_tags`, `scene_markers`, `scene_folder_performers`, `scene_folder_tags`, and any indexes or constraints referencing them.
2. Drop `library_roots.scan_videos` (replaced by `scan_movies`/`scan_series`, which were added as part of the schema migration, not the data migration).
3. Commit transaction. Mark the `data_migrations` row as `complete`.
4. Enqueue a library scan per root to catch any files that appeared on disk during the staged window or were missed during stage. This uses the new scan pipeline and writes to the typed tables.

## 7. Identify / scrape flow rework

### 7.1 Plugin capabilities

The old `folderBy*` / `videoBy*` capability list is retired. New capability list on `OscuraPluginManifest.capabilities`:

```ts
{
  // Movies
  movieByName?: boolean;
  movieByURL?: boolean;
  movieByFragment?: boolean;

  // Series (show-level lookup, no children)
  seriesByName?: boolean;
  seriesByURL?: boolean;
  seriesByFragment?: boolean;

  // Series cascade (series-level lookup that returns full season+episode tree)
  seriesCascade?: boolean;

  // Episodes (per-file lookup)
  episodeByName?: boolean;
  episodeByFragment?: boolean;

  // Generic video lookup (unused by MovieDB, kept for future plugins)
  videoByName?: boolean;
  videoByURL?: boolean;
  videoByFragment?: boolean;
}
```

### 7.2 Plugin I/O contract

Plugins are a "value in → JSON out" interface. The plugin runtime passes a typed input and receives JSON validated by zod against a discriminated union:

```ts
type NormalizedScrapeResult =
  | { kind: 'movie';   movie:   NormalizedMovieResult }
  | { kind: 'series';  series:  NormalizedSeriesResult }   // optional nested seasons+episodes for cascade
  | { kind: 'season';  season:  NormalizedSeasonResult }   // rarely returned standalone
  | { kind: 'episode'; episode: NormalizedEpisodeResult };
```

Because Obscura plugins are unreleased, no manifest version bump is needed — the contract simply changes. The only legacy compatibility concern is the **stash-compat runtime**, which must translate stash-plugin output (scene/performer/studio shapes) into this union. That translation lives in `packages/plugins/src/runtimes/stash-compat/adapter.ts` as a single chokepoint.

### 7.3 Normalized result shapes

All image fields are arrays of candidates rather than single URLs:

```ts
interface ImageCandidate {
  url: string;
  language?: string | null;
  width?: number;
  height?: number;
  aspectRatio?: number;
  rank?: number;        // provider-supplied ordering hint
  source: string;       // provider key, e.g. 'tmdb'
}

interface NormalizedMovieResult {
  title: string;
  originalTitle?: string;
  overview?: string;
  tagline?: string;
  releaseDate?: string;     // ISO 8601 date
  runtime?: number;         // minutes
  genres?: string[];        // → tag names
  studioName?: string;
  cast?: Array<{ name: string; character?: string; order?: number }>;
  posterCandidates: ImageCandidate[];
  backdropCandidates: ImageCandidate[];
  logoCandidates: ImageCandidate[];
  externalIds: Record<string, string>;
  rating?: number;
  contentRating?: string;
}

interface NormalizedSeriesResult {
  title: string;
  originalTitle?: string;
  overview?: string;
  tagline?: string;
  firstAirDate?: string;
  endAirDate?: string;
  status?: 'returning' | 'ended' | 'canceled' | 'unknown';
  genres?: string[];
  studioName?: string;
  cast?: Array<{ name: string; character?: string; order?: number }>;
  posterCandidates: ImageCandidate[];
  backdropCandidates: ImageCandidate[];
  logoCandidates: ImageCandidate[];
  externalIds: Record<string, string>;
  seasons?: NormalizedSeasonResult[];  // populated for cascade
  candidates?: Array<{                  // present only when disambiguation is needed
    externalIds: Record<string, string>;
    title: string;
    year?: number;
    overview?: string;
    posterUrl?: string;
    popularity?: number;
  }>;
}

interface NormalizedSeasonResult {
  seasonNumber: number;
  title?: string;
  overview?: string;
  airDate?: string;
  posterCandidates: ImageCandidate[];
  externalIds: Record<string, string>;
  episodes?: NormalizedEpisodeResult[];  // populated for cascade
}

interface NormalizedEpisodeResult {
  seasonNumber: number;
  episodeNumber: number;
  absoluteEpisodeNumber?: number;
  title?: string;
  overview?: string;
  airDate?: string;
  runtime?: number;
  stillCandidates: ImageCandidate[];
  guestStars?: Array<{ name: string; character?: string; order?: number }>;
  externalIds: Record<string, string>;
  matched?: boolean;  // false when the cascade couldn't match this local episode
  localFilePath?: string;  // round-trip from the cascade input
}
```

### 7.4 Accept flow

Module `apps/api/src/services/scrape-accept.service.ts`:

```ts
acceptMovieScrape(scrapeResultId, { fieldMask, selectedImages }): Promise<VideoMovie>
acceptSeriesScrape(scrapeResultId, { fieldMask, selectedImages, cascade: CascadeAcceptSpec }): Promise<VideoSeries>
acceptEpisodeScrape(scrapeResultId, { fieldMask, selectedImages }): Promise<VideoEpisode>
```

- **`AcceptFieldMask`** — `Record<fieldName, boolean>` built from review UI checkboxes. Fields not in the mask are left as-is.
- **`SelectedImages`** — `{ poster?: string, backdrop?: string, logo?: string, still?: string }`, holding URLs chosen from the image picker. Unset fields default to the first candidate.
- **`CascadeAcceptSpec`**:

  ```ts
  {
    acceptAllSeasons: boolean;
    seasonOverrides: Record<seasonNumber, {
      accepted: boolean;
      fieldMask: AcceptFieldMask;
      selectedImages: SelectedImages;
      episodes: Record<episodeNumber, {
        accepted: boolean;
        fieldMask: AcceptFieldMask;
        selectedImages: SelectedImages;
      }>;
    }>;
  }
  ```

- **Relocation rule.** Accepting an episode with a plugin-provided season number different from its current season relocates the `video_episodes` row: it moves to the correct `video_seasons` row (creating it if needed), and if the former season ends up empty it's deleted.
- **Non-preemptive seasons.** The cascade only creates seasons the user actually has files for. TMDb reporting 10 seasons when the user only has 3 never results in 7 empty `video_seasons` rows.
- **Image downloads.** Only the selected images are fetched during accept. Downloaded files go to `/data/assets/video-{movies|series|seasons|episodes}/:id/{poster,backdrop,logo,still}.{ext}`. Download failures log a warning, leave the field null, and do not block accept.
- **Partial acceptance.** The user may accept the series + most episodes while skipping a few. The spec encodes per-season and per-episode `accepted: false` for skipped items.

### 7.5 Review UI top-level restructure

Current identify tabs are **Videos** / **Folders**. New tabs:

- **Movies** — grid of unorganized `video_movies`. Row action opens movie review.
- **Series** — grid of unorganized `video_series`. Row action runs the default `seriesCascade` plugin and opens the cascade review.
- **Episodes** — grid of unorganized `video_episodes` for one-off re-identification.

Bulk accept action is preserved with type-aware confirmation ("Accept 14 series and 287 episodes?").

## 8. MovieDB cascade agent

### 8.1 Inputs

Per-capability input shapes. The series cascade is the key case:

```ts
seriesCascade input = {
  title: string;
  year?: number;
  folderPath?: string;
  externalIds?: Record<string, string>;
  localSeasons: Array<{
    seasonNumber: number;  // 0 for specials/flat
    episodes: Array<{
      filePath: string;
      parsed: {
        seasonNumber?: number;
        episodeNumber?: number;
        absoluteEpisodeNumber?: number;
        title?: string;
        year?: number;
      };
    }>;
  }>;
}
```

The cascade tells the plugin exactly what exists on disk so it fetches only the relevant episodes. Matters for rate limits and latency.

### 8.2 TMDb endpoints

- Search: `GET /search/movie`, `GET /search/tv`.
- Detail: `GET /movie/{id}?append_to_response=credits,external_ids,images`, `GET /tv/{id}?append_to_response=credits,external_ids,images,content_ratings`.
- Season detail: `GET /tv/{id}/season/{season}?append_to_response=credits,external_ids,images`.
- Image detail: `GET /movie/{id}/images`, `GET /tv/{id}/images`, `GET /tv/{id}/season/{n}/images`, `GET /tv/{id}/season/{n}/episode/{m}/images`.
- Configuration: `GET /configuration` cached for 24h to build full image URLs.

### 8.3 Matching (cascade path)

1. Resolve the series. Try `externalIds.tmdb` first. Otherwise search by `title + year`, score candidates by popularity and title similarity (Levenshtein + token ratio). Top candidate above confidence threshold → auto-pick. Otherwise return `candidates[]` for disambiguation.
2. For each `localSeasons[].seasonNumber`, fetch the matching TMDb season detail. Local 0 → TMDb season 0 (Specials). Local seasons TMDb doesn't recognize → returned with `tmdbStatus: 'unknown'`, episodes left unmatched.
3. For each local episode, match against the TMDb season's episode list in this order:
   - `(seasonNumber, episodeNumber)` from parsed filename.
   - `absoluteEpisodeNumber` converted via cumulative episode count.
   - Title fuzzy match against TMDb episode titles.
   - Nothing → `matched: false`.
4. Return `NormalizedSeriesResult` with nested seasons and episodes.

### 8.4 Disambiguation flow

If the series search returns multiple unclear candidates, the plugin returns `NormalizedSeriesResult` plus a `candidates[]` list. The review UI surfaces a picker; the user picks one → API re-executes the plugin with `externalIds.tmdb` set → cascade runs with the confirmed id.

### 8.5 Image handling

- **Scrape phase:** plugin returns `ImageCandidate[]` arrays with TMDb-hosted URLs. No downloads.
- **Review phase:** the review UI loads thumbnails directly from TMDb. User picks per-slot from the multi-candidate image picker (Section 9). Picks are persisted into `scrape_results.proposed_result` so they survive review session reloads.
- **Accept phase:** only the selected URLs are downloaded to local disk. Failures log and leave the field null.

Sizes: `original` for posters/backdrops/logos, `w780` for episode stills. Configurable later.

### 8.6 Rate limiting and errors

- TMDb allows ~40 req / 10 seconds. The agent serializes per-cascade requests; no parallel fanout per show. A 20-season show is ~21 requests.
- Auth uses the existing plugin auth config UI. Missing/invalid key → structured error surfaced to the UI.
- Transient failures (429, 5xx) retry once with backoff, then fail cleanly.

## 9. Folder view UI and user documentation

### 9.1 Approach: adapt, don't rebuild

Existing card components, top-level views, detail hero layouts, and player shells are preserved visually. They are renamed and repointed at the new typed tables. Existing view modes (folder view, flat video feed, etc.) remain selectable. The **folder view becomes the default** when opening a library, and its hierarchy is now Series → Season → Episode instead of scene_folder → scene.

### 9.2 Routes

- `/library` — top-level landing. Lists all `library_roots`. When exactly one library exists, the page auto-redirects to `/library/:rootId`. When ≥2 exist, renders the list.
- `/library/:rootId` — library detail. Shows Movies and Series zones per the library's toggles.
- `/movies/:movieId` — movie detail.
- `/series/:seriesId` — series detail with seasons list.
- `/series/:seriesId/season/:seasonNumber` — dedicated season route. Season data has its own page so season-level metadata, cast, and rescraping have somewhere to live.
- `/episodes/:episodeId` — episode detail with player.

Breadcrumbs on every nested route: `Library › Library Name › Series Name › Season 1 › Episode 3`.

### 9.3 Case A vs Case B rendering

- **Case A** (flat series, Season 0 is the only season): series detail page shows the series hero and a flat episode grid directly. No season headers, no "Specials" label, no mention of Season 0. The user never sees Season 0 as a concept.
- **Case B** (numbered seasons with optional Season 0 specials): series detail page shows the series hero and a seasons row. Numbered seasons first, ordered ascending. Season 0 renders last, labeled "Specials."

Renderer picks with one query: `SELECT count(*) FROM video_seasons WHERE series_id = $1 AND season_number > 0`. Zero → Case A, else → Case B.

### 9.4 Identify entry points

- **Series detail:** "Identify Series" button runs the default `seriesCascade` plugin and opens the cascade review.
- **Season detail:** "Re-identify this season" runs the cascade scoped to a single season.
- **Episode detail:** "Re-identify this episode" runs `episodeByFragment` on one file.
- **Movie detail:** "Identify Movie" runs `movieByName`/`movieByURL`.

### 9.5 New UI pieces

Only these are genuinely new; everything else is adapted existing code:

- **`ImagePicker` component** (`packages/ui/src/components/image-picker/`) — generic over `ImageCandidate[]`, used from all four review screens.
- **Cascade review screen** — new route, containing series header + disambiguation picker (when needed) + collapsible season sections + per-episode rows with match status + accept footer.
- **Movie review screen** — compact single-entity variant of the review layout.
- **Single-episode re-identify screen** — compact variant used from the episodes tab and from the cascade review's "change match" flow.
- **Migration banner + finalize button** on a new system status view.
- **`docs/library-organization.md`** — user-facing markdown documentation.

### 9.6 Image picker behavior

- Each image slot (poster, backdrop, logo, still) renders as a thumbnail. Click opens the picker modal.
- Modal shows a responsive grid of all candidates at preview resolution with language/resolution/rank badges.
- Filters: language dropdown, "hide language-agnostic" toggle, sort by rank/resolution/language.
- "No image" option → sets the field to NULL on accept.
- Selection persists into `scrape_results.proposed_result` under `selectedImages`, surviving review session reloads.

### 9.7 Per-field acceptance

Every text field in the review screens has its own checkbox. Users can accept fine-grained changes, but an "Accept all once everything looks good" button at the footer toggles all checkboxes at once for users who have reviewed and want to bulk-accept.

### 9.8 Retired UI

- `identify-video-folders-tab.tsx` in its current form → replaced by new Movies/Series/Episodes tabs that reuse existing card grids.
- Rename-and-retype pass: `apps/web/src/components/scene-folders/` → `apps/web/src/components/video-series/` and related; hooks `useSceneFolder` / `useSceneFolderChildren` → `useVideoSeries` / `useSeriesSeasons`.

### 9.9 User-facing documentation (`docs/library-organization.md`)

Linked from the library settings page. Structure:

1. **Intro** — one sentence explaining Movies vs Series.
2. **Library toggles** — short list of what `scanMovies` and `scanSeries` do.
3. **The rule** — three bullets:
   - Files directly in the library root → Movies.
   - Files inside a single folder → Flat series (that folder is the series).
   - Files inside a folder inside a folder → Series with seasons.
4. **Good layouts** — code-block markdown trees for:
   - **A** Movies only
   - **B** Flat series (no season folders)
   - **C** Series with seasons
   - **D** Series with specials
5. **Mixed library** — a single tree showing both movies and series coexisting.
6. **Bad layouts** — examples of:
   - Depth > 3 (rejected)
   - Loose files at root with series toggle off (ignored)
   - Ambiguous folder naming (`Folder A/Folder B/video.mkv`)
7. **Filename conventions table** — columns: Example Filename | Parsed Season | Parsed Episode. Rows covering S01E02, 1x02, bare absolute, "Season X Episode Y" long form.
8. **Metadata priority** — one paragraph: NFO wins, then JSON sidecar, then filename parser. Folder placement is always authoritative for season until identify moves things.

## 10. Out of scope / deferred

- Scan diagnostics UI (rejected-by-depth counts, unmatched counts).
- Drag-and-drop episode reassignment in the review screen.
- Pre-creating empty seasons from TMDb when the user hasn't downloaded them.
- Audio identification plugin capabilities (the discriminated union has room for it but no plugins implement it).
- Images and galleries subsystem changes.

## 11. Implementation order

The dependency graph argues for this sequencing. Each phase lands as its own PR.

1. **Schema additions (non-destructive).** Add `data_migrations` table. Add `video_series`, `video_seasons`, `video_episodes`, `video_movies`, and typed join tables. Add `library_roots.scan_movies` and `scan_series`. Add `external_ids` functional indexes. Do not touch the old tables. Ship as a drizzle migration plus corresponding `LEGACY_SCHEMA_SENTINELS` entries per `CLAUDE.md` policy.
2. **Staged migration framework.** Implement the `DataMigration` interface, the orchestrator, the `/system/status` endpoint, and the `/system/migrations/:name/finalize` endpoint. Ship without any migration in the registry yet.
3. **Parsing library.** Implement `packages/media-core/src/parsing/` with unit tests for the three parsers. No integration yet.
4. **New scan pipeline.** New `processLibraryScan` writes to `video_*` tables. Legacy scan pipeline still present but unused in new-install code paths. Add `scene-folder-sync.ts` to the deprecation list.
5. **`videos_to_series_model_v1` data migration.** Implement precheck/stage/finalize. Register in the orchestrator. Test against a snapshot of an existing install.
6. **Plugin contract rework.** New `NormalizedScrapeResult` union, new capabilities, zod validation, stash-compat adapter. MovieDB plugin updated to emit new shapes with `ImageCandidate` arrays.
7. **Accept flow rework.** `scrape-accept.service.ts` with per-entity entry points and cascade support.
8. **Identify UI tabs.** Movies/Series/Episodes tabs, reusing existing card grids.
9. **Cascade review screen + ImagePicker.** The hardest UI piece. Builds on top of the existing review primitives where possible.
10. **Folder view adaptation.** Rename-and-retype pass for `scene-folders/` → `video-series/`, hooks, and route handlers. Wire up the season route.
11. **Migration banner + user documentation.** System status view with the finalize button. `docs/library-organization.md`.
12. **Drop legacy tables.** After finalize has been exercised on test installs, remove the adapter modules and the frozen legacy schema in a follow-up commit.

## 12. Open questions

None blocking. All clarifying questions from the brainstorming session have been resolved and their answers are captured in the sections above.
