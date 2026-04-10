# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.8.0] - 2026-04-10

### Changed

- **Job queue backend** — Replaced BullMQ + Redis with **pg-boss**. The worker, API, and Operations dashboard now use PostgreSQL as the sole queue backend and single source of truth for job state. Dashboard counts (waiting / active / delayed / failed / completed) are served from one grouped query against `job_runs` instead of splitting between Redis and Postgres, which fixes the recurring "refresh to see" drift where BullMQ and the mirror disagreed.
- **Distributed lock** — `scheduleRecurringScans` now uses a Postgres `pg_try_advisory_lock` instead of a Redis `SET NX` key.
- **Concurrency model** — pg-boss v10 expresses per-queue concurrency as `batchSize`; jobs in a batch run in parallel via `Promise.all`. Worker concurrency is fixed at process start — to change `backgroundWorkerConcurrency`, restart the worker (previously BullMQ was resized in-place every 15s).
- **API response** — `/jobs/:id/cancel` now returns `queueState` instead of `redisState`; `/jobs/acknowledge-failed` returns `externalRemovedByQueue` instead of `redisRemovedByQueue`.

### Removed

- Redis from the unified Docker image, dev `docker-compose.yml`, and all service env files. No more `redis-server`, `/data/redis`, RDB format-version migrations, memory-overcommit warnings, or Alpine Redis package pins.
- `bullmq` and `ioredis` dependencies from `@obscura/api` and `@obscura/worker`.
- `queueRedisRetention` from `@obscura/contracts` — pg-boss manages its own archival/retention.
- `REDIS_URL` from `.env.example` and the entrypoint.

### Migration notes

- **Pending jobs from earlier versions are lost.** BullMQ queue state lived in Redis, which is gone. On first boot of 0.8.0, re-run any scans/imports from Operations if needed. Historical `job_runs` rows are preserved.
- pg-boss creates its own `pgboss` Postgres schema lazily on first start; no manual migration is required. It lives alongside Obscura's drizzle-managed schema without touching it.
- `max_connections` in the embedded Postgres tune-up was raised from 20 to 40 to accommodate pg-boss's pool in addition to API, worker, and drizzle push.
- Existing `/data/redis` directories on deployed volumes are now unused and can be deleted manually to reclaim space.

## [0.7.20] - 2026-04-10

### Fixed

- **Docker (unified image)** — Container refused to start because `/data/redis/dump.rdb` had been written by a newer Redis (`RDB format version 12`) and the Alpine-packaged Redis 7.2.9 in this image only handles up to version 11, crashing on every boot with `Can't handle RDB format version 12`. The entrypoint now detects this specific failure, quarantines the incompatible snapshot to `dump.rdb.incompatible-<timestamp>`, and restarts Redis once so the container can come up. Pending queue state is lost on migration (BullMQ jobs can be re-triggered from the UI).

## [0.7.19] - 2026-04-10

### Fixed

- **Docker (unified image)** — Container hung at `Waiting for Redis to accept connections...` and API/worker kept hitting `ECONNREFUSED` on `127.0.0.1:6379`. The 0.7.18 fix still used `daemonize yes`, so after Redis forked, the child closed stdin/stdout/stderr and any bind / pidfile / `dir` failure was invisible. The entrypoint now runs `redis-server` in the foreground (backgrounded by the shell) with explicit `pidfile`, `logfile`, and `daemonize no`, monitors the child pid while waiting for `PONG`, and prints the tail of the Redis log on failure so startup errors are actually diagnosable.

## [0.7.18] - 2026-04-10

### Fixed

- **Docker (unified image)** — API and worker could not reach Redis (`ECONNREFUSED` on `127.0.0.1:6379`) when the packaged default `redis.conf` expected systemd supervision or otherwise prevented the server from listening. Startup now uses a minimal config under `/run` and waits for `redis-cli PONG` before schema push and Node processes start.

## [0.7.17] - 2026-04-10

### Fixed

- **Docker (unified image)** — Production `audiowaveform` failed at runtime with missing `libboost_filesystem` and `libid3tag` / unresolved symbols when `node:22-alpine` drifted ahead of the `alpine:3.20` audiowaveform build stage. The runner now installs `boost1.84-filesystem` (and pins Boost runtime packages to `boost1.84-*`), and all Node stages use `node:22-alpine3.20` so shared-library SONAMEs match the copied binary.

## [0.7.16] - 2026-04-10

### Fixed

- **Identify & Resolve** — Scene and performer lists were capped at 100 rows server-side regardless of client `limit`, so Identify tabs and the Resolve queue could not show the full library. List endpoints now allow up to 50,000 rows per request, and the web app pages that need everything use paged `fetchAllScenes` / `fetchAllPerformers` until `total` is satisfied.
- **Resolve review** — Pending scrape results load with paging (and the API cap raised to 10,000 per call) so large tagger queues are not truncated at 100–200 items.

## [0.7.15] - 2026-04-10

### Fixed

- **Web** — Tailwind v4 now scans `packages/ui` via `@source`, so utilities from `@obscura/ui` (including `peer-checked` on the checkbox) are emitted. Checkboxes again show the brass fill, glow, and check icon when selected.

## [0.7.14] - 2026-04-10

### Fixed

- **Docker (unified image)** — Schema push again uses `node apps/api/node_modules/drizzle-kit/bin.cjs push --force` from `/app/apps/api`. The runtime image does not ship `pnpm` (only Node), so the 0.7.13 entrypoint’s `pnpm exec drizzle-kit` failed immediately; the shell also stays in `apps/api` after push so the API `tsx src/index.ts` line runs from the correct directory.

## [0.7.13] - 2026-04-10

### Fixed

- **Docker (unified image)** — The entrypoint no longer ignores `drizzle-kit push` failures (`|| true`). A failed schema push left PostgreSQL missing tables required by the API (e.g. cross-media count queries), which surfaced as widespread HTTP 500s on `/api/performers`, `/api/studios`, `/api/jobs`, and scene asset routes. Startup runs `drizzle-kit push --force` (with `CI=true`) and **exits non-zero** if push fails so the problem is visible in container logs. `--force` avoids interactive prompts in non-TTY containers; back up `/data` before upgrading across breaking schema changes.

## [0.7.12] - 2026-04-10

### Added

- **Audio library** — **Shuffle** next to **Play All** turns shuffle on in the player, starts on a random track, and continues in shuffle order.

- **Mobile header** — The canvas top bar shows the Obscura mark as a **Dashboard** link (`/`) when the sidebar is hidden; desktop layout is unchanged.

- **Audio player** — Global keyboard shortcuts on the audio library view (when focus is not in an input, textarea, select, or contenteditable): **Space** or **k** play/pause, **←**/**→** seek ±5s, **j**/**l** seek ±10s, **m** mute—aligned with the video player.

- **Tag detail** — The tag page loads linked **galleries** and **audio libraries** in addition to videos (same idea as the performer detail page), with summary counts for each media type.

### Changed

- **Audio library (mobile)** — The fixed audio player sits slightly above the bottom tab bar (`6px` gap) instead of flush against it.

- **Markers** — Scene and audio-track markers no longer store or expose a “primary tag.” The marker form and list UI only edit title and time range; `primary_tag_id` was removed from `scene_markers` and `audio_track_markers` (run `apps/api/sql/0007_drop_marker_primary_tag.sql` on existing PostgreSQL databases, or `pnpm --filter @obscura/api db:push` in dev). Create/update marker API bodies no longer accept `primaryTagName`; responses omit `primaryTag` on marker objects.

- **Audio player** — Transport controls (shuffle, skip, play/pause, repeat) are centered in the bar; volume stays right-aligned.
- **Library scan** — Stale reference cleanup (scenes, images, galleries outside enabled roots or missing on disk) runs once at the start of each manual library-scan dispatch and scheduled scan tick, before per-root jobs are queued. With no watched folders, “Run scan” still performs that cleanup so the library is not left pointing at removed paths.
- **Jobs** — Library maintenance run notification uses neutral copy (“Cleaning up files.”) instead of referencing content modes.

### Fixed

- **Docker (CI)** — Alpine 3.20 audiowaveform build installs `gd-dev` (Alpine’s GD headers package; `libgd-dev` does not exist) and `libid3tag-dev` so CMake can find LibGD and LibId3Tag. Runner image includes `libid3tag` for the linked binary.

- **Scene markers (time fields)** — Start/end time inputs use draft text while typing and commit on blur or Save, so partial values like `1` or `1:3` are no longer immediately rewritten. End time placeholder shows an em dash (`—`) instead of the literal `\u2014`. Save sends parsed times from the draft so values are correct even if the field was not blurred first.

- **Scene detail** — Description text wraps long unbroken strings and stays within the content column (`w-full max-w-full min-w-0 break-words` instead of overflowing past `max-w-3xl`).
- **Library maintenance queue** — Running `library-maintenance` from Jobs now enqueues one scene-asset migration job (matching the current “dedicated vs beside media” setting) instead of reporting zero jobs. Migration always processes every scene with a file path; SFW mode only affects job labels and redacted UI copy, not which files are moved.
- **Scene asset migration API** — `POST /jobs/migrate-scene-asset-storage` uses the same deduplication as other jobs and returns 409 when a migration is already active; respects `nsfw` in the body for SFW-safe labels.

## [0.7.0] - 2026-04-09

### Added

- **Scene generated asset storage** — Library setting `metadataStorageDedicated` (default on) stores video thumbnails, preview clips, sprites, and trickplay VTT under `OBSCURA_CACHE_DIR` instead of next to each media file. Settings offers moving existing files (background `library-maintenance` job) or leaving them in place; the API serves from the active layout first with fallback to the other. Scene `.nfo` files always stay beside the video. New endpoint `POST /jobs/migrate-scene-asset-storage` with `{ "targetDedicated": boolean }`. `@obscura/media-core` adds `getSceneVideoGeneratedDiskPaths` and related helpers.

## [0.6.9] - 2026-04-09

### Added

- **Performer & studio list API** — Each row includes `imageAppearanceCount` (linked galleries plus standalone images) and `audioLibraryCount` (linked audio libraries for performers; studio-assigned libraries for studios). Counts respect SFW mode the same way scene counts do.
- **Entity cards** — Actor and studio grid/list/compact cards show **Film / Images / Music** icons with numeric counts via shared `MediaAppearanceCounts`.

### Changed

- **Search** — Performer and studio results use the same cross-media counts in SQL, meta payloads, and subtitles.

## [0.6.8] - 2026-04-09

### Added

- **Gallery & image metadata** — Gallery edit mode includes **Actors** and **Tags** chip inputs (same `performerNames` / `tagNames` PATCH as the API). Read view always shows both sections with empty copy when none. After save, gallery performers/tags refresh from the API without reloading the full image grid.
- **Image lightbox** — Edit panel adds **Actors** (`ChipInput` + suggestions); save sends `performerNames` and rehydrates from `GET /images/:id`. Images index lightbox passes tag/performer lists that respect NSFW refetch.

### Changed

- **Gallery detail page** — Loads performer suggestions server-side (with NSFW cookie) alongside tags.

## [0.6.7] - 2026-04-09

### Added

- **Performer & studio detail** — Each page loads **galleries** and **audio libraries** linked via join tables / `studioId`, with summary counts and grid sections (same NSFW behavior as the main library lists). Server and client use `root=all` so nested galleries and sub-libraries are included when filtering by performer or studio.
- **Web API client** — `fetchAudioLibraries` for browser-side fetches (e.g. performer refetch on NSFW mode change).

### Changed

- **Gallery list API** — `GET /galleries` accepts optional `nsfw=off` to exclude NSFW galleries, consistent with scenes and audio library lists.

## [0.6.6] - 2026-04-09

### Changed

- **Audio player** — On the library detail page, the now-playing thumbnail uses the **library cover** when set; otherwise the music note placeholder.

## [0.6.5] - 2026-04-09

### Added

- **Audio library cover art** — `POST /audio-libraries/:id/cover` (multipart) and `DELETE /audio-libraries/:id/cover` save or clear a custom JPEG in the audio-library cache dir; `GET /assets/audio-libraries/:id/cover` serves it. Library detail edit mode adds **Art** / **Clear** on the cover.
- **Per-track star ratings** — Track rows use an interactive `StarRatingPicker` (clicks do not change the playing track) wired to existing `PATCH /audio-tracks/:id` with `{ rating }`. Client helpers `uploadAudioLibraryCover`, `deleteAudioLibraryCover`, `updateAudioTrack`; contract type `AudioTrackPatchDto`.

## [0.6.4] - 2026-04-09

### Changed

- **Audio library player** — Playback UI is a fixed bottom dock (`surface-elevated`) above the mobile tab bar; desktop aligns with the main column (`md:left-60` / `md:left-14`). Page content uses extra bottom padding so the track list scrolls clear of the player. Added `AppChromeProvider` / `useAppChrome` for sidebar-aware fixed UI. `AudioPlayer` accepts optional `className`.

## [0.6.3] - 2026-04-09

### Changed

- **Audio player** — Matches the scene **film strip** pattern: a standard `video-progress-track` timeline in the main chrome for coarse seek, and a separate **waveform strip** below with a fixed center playhead; the waveform translates under the head during playback and supports drag + desktop wheel scrub (like video trickplay). Removed the old single-canvas waveform seeker.

## [0.6.2] - 2026-04-09

### Fixed

- **Audio waveform display** — Added missing `GET /assets/audio-tracks/:id/waveform.json` API route. The worker was generating waveform JSON files correctly, but the API had no handler to serve them, so the audio player silently fell back to no waveform. The player now also logs fetch failures to the console instead of swallowing them.

## [0.6.1] - 2026-04-09

### Changed

- **Audio library detail** — Removed the redundant “Audio Library” kicker; the library title (and edit field) is the primary heading, with actions aligned on the same row.

## [0.6.0] - 2026-04-09

### Added

- **Audio library editing** — Detail page supports inline edit (pencil control): title, description, date, NSFW flag, rating, studio, organized state, artists (performer links), and tags. Saves via existing `PATCH /audio-libraries/:id`, then refetches the library and revalidates cache. Performers are labeled **Artists** on this page only. Added `AudioLibraryPatchDto` in contracts and client helpers `fetchAudioLibraryDetail` / `updateAudioLibrary`.

### Fixed

- **Audio library studio on save** — `PATCH /audio-libraries/:id` now finds or creates a studio by name (aligned with scene updates) instead of dropping `studioId` when the name did not match an existing row.

## [0.5.9] - 2026-04-09

### Changed

- **Audio library detail** — Hero row places cover and title beside the Library Info card; performers and tags follow; player and track list are last. Sub-libraries stay between tags and playback.

## [0.5.8] - 2026-04-09

### Changed

- **Audio library detail** — Metadata (performers, tags, library info) and sub-library cards now appear above the track list.

## [0.5.7] - 2026-04-09

### Added

- **On-the-fly audio transcoding** — The audio stream route now detects tracks whose codec isn't natively supported by browsers (ALAC, APE, WMA, AIFF, DSD, etc.) and transcodes them to MP3 192kbps via ffmpeg on the fly. Browser-native codecs (MP3, AAC, Opus, Vorbis, FLAC, PCM) continue to stream directly with HTTP Range support for seeking. Fixes the `NotSupportedError: Failed to load because no supported source was found` error for ALAC files in Chrome/Firefox.

## [0.5.6] - 2026-04-09

### Fixed

- **Audio playback never starts** — Removed the fragile `wantPlayRef`/`canplay` handoff and now directly call `audio.play()` after setting `src`, which modern browsers handle via the returned Promise. Added `loadedmetadata` and `error` event handlers for better observability, switched preload to `"auto"` so buffering starts immediately, and hardened the track-change effect to depend on the track ID string rather than the object reference.

## [0.5.5] - 2026-04-09

### Fixed

- **Audio playback not starting** — The player now loads the audio source via `audio.load()` and triggers `play()` on the `canplay` event, rather than calling `play()` synchronously after setting `src` (which rejected before the media was ready). Audio event listeners are now registered once using refs for callback access, avoiding stale closures. `togglePlay` also handles the case where the user clicks play before any source has been loaded.

## [0.5.4] - 2026-04-09

### Fixed

- **Waveform generation fallback** — When `audiowaveform` binary is not installed (local dev), waveform generation now falls back to pure ffmpeg + Node PCM peak computation instead of crashing with `ENOENT`.

### Changed

- **Audio player redesign** — Static library-level player that's always visible. Shows "now playing" info, waveform seek bar, and transport controls (shuffle, prev, play/pause, next, repeat). Play button glows when active. Volume slider expands on hover. Track list shows animated bars for the playing track, play icon on hover for others.
- **Play All button** — Prominent brass "Play All" button in the library header starts playback from the first track (or random if shuffle is on).
- **Loop and shuffle** — Three repeat modes (off → all → one) and shuffle toggle. When a track ends: repeat-one restarts it, shuffle picks a random next, repeat-all wraps around, otherwise advances sequentially.
- **Previous track behavior** — Pressing previous when more than 3 seconds into a track restarts it instead of going to the prior track.

## [0.5.3] - 2026-04-09

### Fixed

- **Audio scan dispatch** — Added manual dispatch handlers for `audio-scan`, `gallery-scan`, `audio-probe`, `audio-fingerprint`, and `audio-waveform` queues in the jobs API. Previously only `library-scan` had a dedicated handler; all other queues fell through to scene-only logic.

### Changed

- **Jobs page grouping** — Audio queues now grouped into "Library scans" (audio-scan alongside library-scan and gallery-scan) and a new "Audio pipeline" section (audio-probe, audio-fingerprint, audio-waveform) on the jobs dashboard.

## [0.5.2] - 2026-04-09

### Fixed

- **Audio nav icon** — Added `music` to the sidebar icon map so the Audio nav entry renders its icon correctly.

## [0.5.1] - 2026-04-09

### Added

- **Docker: audiowaveform** — Build BBC audiowaveform from source in a dedicated Alpine build stage and copy the binary into the production image. Adds runtime dependencies (libmad, libsndfile, libgd, boost) for waveform peak generation.

## [0.5.0] - 2026-04-09

### Added

- **Audio section** — New `/audio` route with grid and browser views for audio libraries, and `/audio/:id` detail page with track list, inline audio player, and waveform visualization.
- **Audio player** — Inline audio player with play/pause, seek, volume, next/prev track, waveform canvas with pointer drag scrubbing, and playhead glow effect.
- **Audio waveform canvas** — Custom canvas component rendering BBC audiowaveform peaks data with brass accent gradient for played portion and pointer drag-to-seek interaction.
- **Settings: audio scanning** — Library root settings now include a `scanAudio` toggle alongside `scanVideos` and `scanImages`.
- **Search: audio entities** — Audio libraries and tracks appear in search results.

### Changed

- **Navigation** — Replaced "Images" nav entry with "Audio". Images are now accessible as a view mode within Galleries.
- **Settings API** — Library root create/update endpoints now accept `scanAudio` field.

## [0.4.3] - 2026-04-09

### Added

- **Audio library API** — Full CRUD for audio libraries: list (with hierarchy, tag/performer/studio filters, pagination), detail (with paginated tracks, children, total duration), stats, update (metadata + performers/tags inline creation), delete.
- **Audio track API** — List, detail (with markers), update (metadata + performers/tags), play tracking, and audio streaming with Range request support for seeking.
- **Audio track markers** — CRUD for temporal cue points on audio tracks, following the same pattern as scene markers.
- **Audio streaming** — `GET /audio-stream/:id` serves audio files with proper MIME types and HTTP Range support for all supported formats.

## [0.4.2] - 2026-04-09

### Added

- **Audio scan processor** — Discovers audio files in library roots, creates folder-based audio libraries with parent-child hierarchy, upserts tracks, and enqueues downstream probe/fingerprint jobs. Cleans up stale libraries and tracks on rescan.
- **Audio probe processor** — Extracts technical metadata and embedded ID3/Vorbis tags from audio files using ffprobe. Updates title from embedded tags when current title is just the filename. Enqueues waveform generation as downstream job.
- **Audio fingerprint processor** — Computes MD5 and OSHash fingerprints for audio tracks.
- **Audio waveform processor** — Generates JSON peaks data using BBC audiowaveform binary for playback visualization.
- **Library scan audio trigger** — Library scan now triggers audio scan after gallery scan when `scanAudio` is enabled on the root.

## [0.4.1] - 2026-04-09

### Added

- **Audio file discovery** — `discoverAudioFilesAndDirs()` walks directory trees finding `.mp3`, `.flac`, `.wav`, `.ogg`, `.aac`, `.m4a`, `.wma`, `.opus`, `.aiff`, `.alac`, and other audio formats.
- **Audio probing** — `probeAudioFile()` extracts duration, bitrate, sample rate, channels, codec, container, and embedded ID3/Vorbis tags (artist, album, title, track number) via ffprobe.
- **Waveform generation** — `generateAudioWaveform()` uses BBC audiowaveform binary to produce JSON peaks data for playback visualization. Pipes through ffmpeg for formats audiowaveform doesn't natively support.
- **Audio cache directories** — `getGeneratedAudioLibraryDir()` and `getGeneratedAudioTrackDir()` for audio asset storage.

## [0.4.0] - 2026-04-09

### Added

- **Audio libraries schema** — New `audio_libraries` table for folder-based audio groupings with hierarchy (parentId), cover image, icon, and denormalized track count.
- **Audio tracks schema** — New `audio_tracks` table for individual audio files with duration, bitrate, sample rate, channels, codec, embedded ID3 tags, waveform path, and playback tracking.
- **Audio track markers** — New `audio_track_markers` table for temporal cue points on audio tracks.
- **Audio join tables** — `audio_library_performers`, `audio_library_tags`, `audio_track_performers`, `audio_track_tags` for many-to-many relationships.
- **Audio contracts** — DTOs (`AudioLibraryListItemDto`, `AudioLibraryDetailDto`, `AudioTrackListItemDto`, `AudioTrackDetailDto`), route constants, query types, and queue definitions for audio-scan, audio-probe, audio-fingerprint, and audio-waveform.
- **Library root `scanAudio`** — New boolean flag on library roots to control audio file discovery.

## [0.3.3] - 2026-04-09

### Changed

- **Shared component extraction** — Extracted ChipInput, StarRatingPicker, MetadataRow, TimeMarkerForm, HierarchyBrowser, and MetadataPanel into `components/shared/` for reuse across scenes, galleries, and upcoming audio feature.
- **Generic tree utility** — Extracted `buildHierarchyTree` into `@obscura/ui/lib/tree` for any entity with parent-child hierarchy (galleries, audio libraries).
- **Scrub interaction hook** — Extracted `useScrubInteraction` into `@obscura/ui/lib/scrub` for reuse by video film strip and upcoming audio waveform player.
- **Refactored consumers** — `scene-edit.tsx`, `scene-marker-editor.tsx`, `scene-metadata-panel.tsx`, `gallery-browser.tsx`, and `gallery-tree.ts` now use shared components.

## [0.3.2] - 2026-04-09

### Fixed

- **SFW empty states** — Galleries (grid/list and browser) and Settings → Library now use neutral “empty” copy in SFW mode instead of text that implied NSFW content or libraries were present but hidden.

## [0.3.1] - 2026-04-09

### Fixed

- **Changelog API routing** — `/api/changelog` was routed by nginx to Fastify but implemented as a Next.js route, so it always returned 404 in Docker. Moved the endpoint to Fastify (`GET /changelog`), deleted the dead Next.js route, and cleaned up the now-unnecessary `outputFileTracingIncludes` and `outputFileTracingRoot` config from `next.config.mjs`.

## [0.3.0] - 2026-04-09

### Changed

- **Bulk scrape component decomposition** -- Split the 1884-line `bulk-scrape.tsx` into a `scrape/` directory with focused files: `types.ts` (shared types, constants, utilities), `shared-components.tsx` (StatusDot, ToggleableField), `scrape-scenes-tab.tsx`, `scrape-performers-tab.tsx`, `scrape-studios-tab.tsx`, `scrape-tags-tab.tsx` (per-tab seek logic, row rendering, accept/reject), and a slim orchestrator `bulk-scrape.tsx` (~300 lines) that owns shared state, tab switching, controls, and stats. Pure refactor with no visual or behavioral changes.

- **Scene detail component decomposition** — Split the 995-line `scene-detail.tsx` into a focused orchestrator (~280 lines) and three tab sub-components: `scene-metadata-panel.tsx` (Details tab with performers, tags, file info sidebar), `scene-marker-editor.tsx` (Markers tab with add/edit/delete and tag autocomplete), and `scene-file-info.tsx` (Files tab with paths, codecs, streams). Pure refactor with no visual or behavioral changes.

- **Deduplicate web utility code** — Extracted shared `buildQueryString` into `apps/web/src/lib/query-string.ts` (was duplicated in `api/core.ts` and `server-api/core.ts`). Created a generic `createListPrefs` factory in `apps/web/src/lib/list-prefs.ts` that encapsulates the repeated cookie read/write/clear, JSON parse/serialize, and default-comparison boilerplate. Refactored all 6 entity list-prefs files (scenes, galleries, performers, images, studios, tags) to use the factory. No behavioral changes; all existing export names preserved.

- **Worker modularization** — Decomposed the monolithic 1934-line `apps/worker/src/index.ts` into focused modules: 8 processor files under `processors/` (one per job type), 6 shared utility files under `lib/` (db, queues, job-tracking, nsfw, enqueue, scheduler/helpers), and a slim ~100-line orchestration `index.ts`. Pure refactor with no logic changes.

- **Job control: queue layout** — Queue cards use a fixed order grouped by role: library and gallery scans first, then scene media pipeline (probe, fingerprint, preview), metadata import, and gallery image pipeline. Cards no longer reorder by backlog or failures.

- **Route refactor: thin route wrappers** — Rewrote all API route files (`scenes`, `galleries`, `images`, `performers`) to be thin wrappers that parse request params and delegate to the service layer. Extracted studio routes into `routes/studios.ts` and tag routes into `routes/tags.ts` (previously embedded in the 1641-line `scenes.ts`). Registered the global error handler plugin so `AppError` exceptions propagate automatically. Scene routes dropped from ~1641 lines to ~100 lines.

### Added

- **Error handler plugin** — Global Fastify error handler plugin (`AppError` class) for consistent JSON error responses using the `ErrorResponse` contract type. Handles application errors, validation errors, and unknown errors.

- **Image service layer** — Extracted image business logic (`listImages`, `getImageById`, `updateImage`, `bulkUpdateImages`) from route handlers into `apps/api/src/services/image.service.ts`. Uses shared query helpers and throws `AppError` for 404/400 cases.

- **Gallery service layer** — Extracted gallery business logic (`listGalleries`, `getGalleryById`, `updateGallery`, `getGalleryStats`, `setCoverImage`, chapter CRUD) from route handlers into `apps/api/src/services/gallery.service.ts`.

- **Scene service layer** — Extracted scene business logic (`listScenes`, `getSceneById`, `getSceneStats`, `updateScene`, `deleteScene`, marker CRUD, play/orgasm recording, thumbnail management) from route handlers into `apps/api/src/services/scene.service.ts`. Uses `AppError` for HTTP error responses.

- **Performer service layer** — Extracted performer business logic (`listPerformers`, `getPerformerById`, `createPerformer`, `updatePerformer`, `deletePerformer`, favorite/rating setters, image upload/from-url/delete) from route handlers into `apps/api/src/services/performer.service.ts`. Uses `AppError` for HTTP error responses.

- **Studio service layer** — Extracted studio business logic (`listStudios`, `getStudioById`, `createStudio`, `updateStudio`, `findOrCreateStudio`, `deleteStudio`, favorite/rating setters, image upload/from-url/delete) from route handlers into `apps/api/src/services/studio.service.ts`. Includes recursive parent resolution with loop prevention for find-or-create.

- **Tag service layer** — Extracted tag business logic (`listTags`, `getTagById`, `createTag`, `updateTag`, `deleteTag`, favorite/rating setters, image upload/from-url/delete) from route handlers into `apps/api/src/services/tag.service.ts`. SFW-aware scene and image count aggregation.

- **Filter presets** — Save and load named filter presets from a dropdown in the scene filter toolbar. Presets store active filters, sort field, and sort direction in localStorage. Supports overwrite, delete, and save-as-new workflows. Active preset persists across page refresh via the existing scenes list cookie.

- **Shared query/response types** — Added `PaginatedResponse<T>`, `ErrorResponse`, `ListQuery`, and entity-specific query types (`SceneListQuery`, `GalleryListQuery`, etc.) to `@obscura/contracts`. Added subpath exports for `@obscura/contracts/queries` and `@obscura/contracts/media`.

- **API query helpers** — Shared helpers in `apps/api/src/lib/query-helpers.ts` for sorting (`buildOrderBy`), relation filtering (`resolveTagIds`, `resolvePerformerIds`), rating/date/boolean/resolution conditions, and pagination parsing. Eliminates 3x duplicated patterns across route handlers.

- **Next.js error/loading boundaries** — Added global `error.tsx` (with retry) and `loading.tsx` (spinner) under the app route group, styled to the Dark Control Room design system.

- **Testing infrastructure** — Set up vitest at root with 42 initial tests covering pure functions in `@obscura/contracts` (formatDuration, formatFileSize, getResolutionLabel, video format detection) and `@obscura/media-core` (isVideoFile, isImageFile, fileNameToTitle, normalizeNfoRating, getSidecarPaths, isAnimatedFormat).

- **Type safety** — Replaced `Record<string, any>` with `Record<string, unknown>` in scraper routes.

- **Multi-select filters** — Resolution, codec, and studio filters now support selecting multiple values simultaneously (e.g. filter by both H.264 and HEVC, or 1080p and 4K). API updated to accept arrays for these fields.

- **Shared alphabetical filter section** — Tags, performers, and studios all use a unified `AlphabeticalFilterSection` component with search input, count display, and sticky letter-grouped layout for large lists. Extracted from the tags gold-standard pattern into `components/filters/`.

- **Rich list filters (API + web)** — Scene list queries support rating range, video date range, duration buckets, organized/interactive flags, file on disk, played vs unplayed, and codec. Gallery and image list endpoints support rating, date range, organized, and minimum image count (galleries); images also support resolution height bands and respect NSFW mode like scenes. Performer list API supports rating range, has/no profile image, and minimum scene count (SFW-aware for scene totals). The scenes filter bar adds these controls plus a searchable performer picker (saved in the existing scenes list cookie). Galleries gain rating, date, image-count, organized, and studio filters in the panel. Images gain a dedicated `obscura-images-list` cookie for sort, search, and filters (tags, performers, studio, rating, date, resolution, organized). Performers, tags, and studios list pages add metadata filters (rating, usage/scene thresholds, favorites, photo presence) persisted in their existing cookies.

- **Create pages for studios, performers, and tags** — New `/studios/new`, `/performers/new`, and `/tags/new` routes with full form UI for manually creating entities. Form fields are extracted into shared components (`StudioForm`, `PerformerForm`, `TagForm`) used by both the create and edit views, reducing duplication. Each list page toolbar includes a **+ New** button linking to the create page.

### Fixed

- **StashBox IDs in SFW mode** — StashBox ID chips and their section headings are hidden when NSFW content mode is **Off** (SFW) on performer, scene (video), studio, and tag detail and edit views. `StashIdChips` skips stash-ID and endpoint fetches in that mode.

- **Identify / scrape UI in SFW edit mode** — Studio, tag, and performer edit views hide “Identify via StashBox” / “Scrape Metadata” panels and identify/scrape result previews under SFW. Scene metadata edit hides the scraper bar (Scrape / Seek) and does not highlight relation chips as “new from scrape” while mode is Off.

- **Images grid infinite scroll** — Grid view on `/images` used a manual “Load more” button while feed view auto-loaded with an intersection sentinel. Grid now uses the same observer-based loading as the feed (and other library grids).

- **Gallery cards in SFW mode** — `NsfwBlur` only wrapped the thumbnail, so titles, counts, and empty image stubs still appeared for NSFW-marked galleries. Grid, list, and compact gallery cards now wrap the full card (same pattern as scene grid cards). Grid and list index views omit NSFW rows while content mode is Off so animation wrappers do not leave blank cells; timeline groups and sub-gallery sections use the same visibility rules; browser tree rows for NSFW galleries are omitted in SFW.

- **Mobile More menu and SFW** — The bottom-bar **More** sheet now uses the same nav sections as the desktop sidebar and omits **Identify** when NSFW content mode is **Off** (SFW). It previously listed **Scrape** (`/scrape`), which showed the same bulk UI without the SFW redirect used by `/identify`.

### Added

- **`Checkbox` primitive (`@obscura/ui`)** — Dark Room–styled control: sharp corners, surface border, brass fill and glow when checked, Lucide checkmark, focus ring, and optional `indeterminate`. Replaces native `accent-*` inputs across list bulk-select headers, entity list cards, settings library-root options, performer filters, and scrape/bulk UIs.

- **Galleries list: saved filters and sort** — The galleries index persists view mode, sort, sort direction, search, and tag/type filters in the `obscura-galleries-list` cookie (1 year, SameSite=Lax). The server reads the cookie on load so the first paint matches saved prefs. A **Clear** control resets to defaults and removes the cookie when the list is back to defaults.

- **Scenes, performers, studios, tags: saved list prefs** — Same cookie pattern as galleries: **Scenes** (`obscura-scenes-list`: view, sort, search, resolution/tag/studio/performer filters), **Performers** (`obscura-performers-list`: view, sort, search, gender, favorites), **Studios** (`obscura-studios-list`: search, name sort direction, grid/list), **Tags** (`obscura-tags-list`: search, sort, list/cloud). Server-side fetches for scenes and performers use the cookie on first load; studios and tags hydrate display prefs from the cookie. Each list exposes **Clear** when not at defaults; the cookie is dropped when prefs match defaults.

- **Background worker concurrency setting** — Library settings include `backgroundWorkerConcurrency` (default 1, range 1–32). The BullMQ worker applies it per queue (parallel jobs per queue), re-reads the value about every 15 seconds so changes take effect without restarting the worker, and the jobs dashboard shows the effective throttle. Schema: `library_settings.background_worker_concurrency`.

- **Film strip wheel scrub (desktop only)** — The trickplay film strip scrubs the video when using the mouse wheel or trackpad scroll over the strip. The `wheel` listener is registered only when `(pointer: fine) and (hover: hover)` matches so phones and other touch-primary layouts stay unchanged. Scroll direction matches natural timeline expectation (wheel down / typical horizontal scroll moves playback forward).
- **Film strip hides player chrome while scrubbing** — Pointer drag on the strip (including touch) and desktop wheel scrub report interaction to the video player so the control overlay fades out like during playback; releasing the pointer or ~320ms after the last wheel event restores controls (`surfaceControls` / auto-hide when playing).

- **NSFW flame badge in Show mode** — New `NsfwShowModeChip` renders a compact Lucide `Flame` icon with red/error styling on library cards when an entity is marked NSFW and global content mode is **Show** (full visibility). Hidden in **Blur** (existing blur/overlay already signals NSFW) and **Off** (SFW). Placed at the bottom-right of media/thumbnail areas (or right-aligned with counts on tag rows). Scene grid uses `MediaCard` `thumbnailOverlay`. Used on scene grid/list, performer grid/list, studio grid/list, tag list/cloud, gallery grid/list, and image grid/feed cards.
- **MediaCard scrub bar** — Removed the static "SCRUB" text chip from the bottom-right of the thumbnail to prevent it from overlapping the duration. The scrub progress bar is now a full-width line anchored to the very bottom edge (`bottom-0`), allowing the NSFW flame badge to sit flush in the bottom-right corner.

### Changed

- **Settings watched libraries (SFW)** — With content visibility Off, NSFW-marked library roots are hidden from the Watched Libraries list (same rule as other library views). If every configured root is NSFW, a short message explains that those entries are hidden and how to switch mode to manage them.

- **Accent metadata pills (`pill-accent`)** — Replaced diagonal gradient, inner highlight, and outer glow with a flat `accent-950` fill and a single `1px` brass-tinted border so resolution and similar chips read as one clean edge (e.g. scene detail, media cards, filter chips).

- **Video player direct mode chips** — When streaming the direct file with quality mode **Direct**, the top overlay no longer shows a duplicate neutral “Direct” chip next to the brass mode chip; **Loading…** and **Adaptive HLS** stream-type chips are unchanged.

- **Video player skip icons** — Replaced the generic `SkipBack` and `SkipForward` icons with `RotateCcw` and `RotateCw` icons containing a "10" to clearly indicate the 10-second skip behavior.

- **Tag Entity Card Checkbox** — Replaced the native checkbox on the Tags page with a custom styled component that matches the "Dark Room" aesthetic. The checkbox is now hidden by default and only appears on hover or when selected, keeping the list clean.
- **Settings Page Components** — Redesigned `ToggleCard` to look like a physical switch with a sliding thumb and accent glow. Replaced native number inputs with a custom `NumberStepper` component for better touch targets and an industrial feel. Upgraded `QualitySlider` to look like a hardware fader with a gradient track. Restyled the "Power-user tip" box to look more like a manual excerpt with better typography and inset shadows.
- **NSFW Content Mode Switcher** — Replaced the generic `<select>` dropdown in Settings with a modern, icon-based segmented control. Provides clearer visual feedback and descriptions for each mode (Off, Blur, Show) using `Shield`, `Droplet`, and `Flame` icons, adapting to the "Dark Room" industrial visual language with inset shadows and accent glows.
- **Canvas header search bar** — Replaced the generic button with a sleek, inset search input style. Removed rounded corners to adhere to the sharp corners rule. Added appropriate hover and focus states with accent borders and shadows. Enhanced responsive design (icon-only on mobile, full input on larger screens).

### Added

- **Mobile Safari / PWA shell** — `font-size: max(16px, 1em)` on `input`, `textarea`, and `select` in global base styles to avoid iOS Safari’s focus zoom when controls would compute below 16px. Web app manifest (`/site.webmanifest`), PNG icons rasterized from the logo (**180** apple-touch, **192** / **512** for manifest), `theme-color` / `viewport` (`viewport-fit=cover`), and `appleWebApp` metadata (`standalone`, `black-translucent` status bar) so Add to Home Screen and mobile browser chrome pick up name, colors, and icons.

- **SFW / full NSFW quick toggle (desktop)** — **Ctrl+Shift+Z** (Windows/Linux) or **⌘⇧Z** (Mac) toggles between **Off** (SFW) and **Show** (full NSFW) only; **Blur** is unchanged by the shortcut (first press from blur switches to Show). Uses the same window capture pattern as global search. No header button; Settings → Content Visibility documents the combo as a power-user tip alongside **⌘K** / **Ctrl+K** for search.

- **Mobile NSFW quick toggle** — On the bottom navigation bar, press and hold **More** for five seconds to run the same full SFW ↔ full NSFW toggle (pointer capture, movement past ~14px cancels; synthetic click after a successful hold is suppressed so the more sheet does not open). Optional `navigator.vibrate` when available.

- **NSFW tag labels in blur mode** — New `NsfwTagLabel` shows garbled block glyphs plus a light blur for tags marked `isNsfw` when global mode is **Blur**; hover reveals the real name (same **Show** / **Off** rules as `NsfwBlur`). Embedded tags on scenes, images, galleries, and performer detail now include `isNsfw` via `TagEmbedDto` in `@obscura/contracts` and API list/detail payloads. `MediaCard` accepts an optional `tagsSlot` so scene grid cards can render obscured tags. Helper `tagsVisibleInNsfwMode` omits NSFW tags from chip rows, filters, and tag browse in **SFW (off)** so safe tags show real names without empty pills; **Show** lists everything with plain text for non-NSFW tags; only `isNsfw === true` is treated as NSFW. Tag detail uses a non-leaking title when the tag is hidden in SFW mode.

- **Gallery NSFW propagation (API)** — `PATCH /galleries/:id` applies `isNsfw` to all descendant sub-galleries and images in the same transaction (recursive CTE). The JSON body may include `affectedGalleryIds` so clients can invalidate caches. Propagation runs only when the flag value changes.

### Changed

- **Global search palette** — Header Search control and **⌘K** / **Ctrl+K** shortcut restored (capture phase on `window`, `KeyK` matching). NSFW mode is still passed through to search when the palette opens.

- **NSFW blur overlay** — The centered badge uses theme `error` / `error-text` / `error-muted` tokens (the previous `status-error` utilities are not defined in `@theme`, so the label did not pick up red). `NsfwChip` and `NsfwEditToggle` use the same tokens for consistency.

- **Gallery detail freshness** — Server-side gallery detail fetch uses `revalidate: 0` so a full page reload reflects edits immediately. After saving gallery metadata, the web app revalidates `galleries` and per-gallery cache tags and syncs NSFW state into sub-gallery and image list client state.

- **Video player metrics** — The top-right **ABR** (bandwidth) chip is hidden in **Direct** playback mode; it only appears for adaptive HLS. Buffer and drop stats stay visible.

### Fixed

- **SFW mode for actors, studios, tags, and search** — With `nsfw=off`, `GET /performers`, `/studios`, and `/tags` omit NSFW entities and return scene/image counts that only include viewable (non-NSFW) media; performer list sorting by video count uses those counts. Tag and studio search providers apply the same filter. Scene grid/list cards drop NSFW actor thumbnails and names in SFW mode; video edit relation autocompletes and scene detail marker tag data use SFW-filtered fetches. Direct API access to an NSFW performer or studio in SFW mode returns 404. Clients refetch lists when the global NSFW mode changes.

- **Image lightbox fit** — Full-size images and videos in the lightbox again scale with `object-contain` inside the viewport. The media area uses `min-h-0`/`min-w-0` in the column flex layout, and the `NsfwBlur` stack fills that area so `max-h-full`/`max-w-full` resolve against a definite box instead of collapsing to intrinsic media size.

- **Video player quality switching locked to Direct** — Switching to Auto or a specific resolution was silently reverted immediately. The source `useEffect` reset `qualityMode`/`streamMode` on every run, including when `streamMode` changed as a result of the user's selection, creating a feedback loop. Fix: quality state is now only reset when the video source (`src`/`directSrc`) changes; mode switches by the user are preserved and HLS initialises correctly.
- **HLS stall on play after mode switch** — After switching from Direct to a HLS mode, `video.play()` was called while the video element had no source (it was cleared during teardown) and before HLS had loaded the manifest. The call was silently ignored or permanently stalled. Fix: playback position and play-state are now captured before teardown (`pendingSeekTimeRef`/`pendingAutoPlayRef`) and restored in `MANIFEST_PARSED`, so the video resumes at the same position automatically. During HLS initialisation the play button shows a spinner and is disabled; the top-left chip reads "Loading…". Quality presets (1080p → 720p → 480p → 360p) now appear in the dropdown once the manifest is parsed.
- **New video always starts in Direct regardless of previous mode** — Navigating to a new scene while HLS was active caused the source effect to briefly try to initialise HLS for the new video before resetting. Fix: a computed `effectiveMode` always defaults to Direct (or Auto when no directSrc) for a new video, overriding any leftover `streamMode` from the previous scene.
- **Scene counter labels vs NSFW content mode** — When NSFW content mode is not **Show** (`off` or `blur`), the scene detail increment control and scene edit metadata use neutral **Like** copy and a heart icon (`title` / field labels say “Like” instead of “Orgasm”); **Show** mode keeps droplets and orgasm wording. The underlying `orgasmCount` field and API are unchanged.
- **Force rebuild previews** — Settings “Force rebuild all previews”, Job Control bulk rebuild, and per-video “rebuild preview” now re-run `ffprobe` and refresh stored video metadata (resolution, duration, codecs, file size) before regenerating thumbnails, preview clips, and trickplay. This fixes stale DB dimensions after swapping in a higher-resolution source file.
- **Entity labels** — User-facing copy now consistently uses “Video(s)” and “Actor(s)” instead of “Scene(s)” and “Performer(s)” across the web app, shared navigation (`@obscura/ui`), API error messages, search provider section labels, and related UI. Routes, types, and database tables remain `scene` / `performer` for compatibility.
- **Canvas header breadcrumbs** — Top bar trail maps `/scenes` and `/performers` to Videos and Actors so it matches the rest of the UI.

### Fixed
- Job Control: Backlog stat now sums per-queue Redis counts instead of capping at 24 (the `activeJobs` list limit)
- **SFW-aware job queueing** — When NSFW mode is Off, manual job triggers from the UI send `nsfw: "off"` so the API and worker skip work for content already marked `isNsfw`: library scans still upsert DB rows but omit probe/fingerprint/preview jobs for NSFW scenes and omit image thumbnail/fingerprint jobs for NSFW galleries/images; “Run queue” for media-probe, fingerprint, preview, and metadata-import only enqueues SFW scenes; bulk preview rebuild clears and re-queues previews only for SFW scenes; per-scene preview rebuild returns 409 for NSFW scenes in SFW mode. Scheduled/auto scans are unchanged and still process the full library.
- **SFW library stats** — With NSFW mode Off, dashboard and scenes info cards (totals, duration, storage, this week) and the scenes list count now match visible SFW-only content: `GET /scenes` and `GET /scenes/stats` accept `nsfw=off` to exclude `isNsfw` scenes from aggregates (same contract as search). SSR reads the mode cookie; the dashboard and scenes pages refetch stats when the mode changes.
- **Command palette search** — The quick-search palette (⌘K / Ctrl+K) passes the current NSFW mode to the search API, matching the full search page (SFW mode excludes NSFW entities from preview results).

### Added

- **List view with bulk actions** — all four root entity pages (Scenes, Performers, Studios, Tags) now support a list view mode with checkbox multiselect. A floating bulk action toolbar appears when items are selected, offering "Mark NSFW", "Unmark NSFW", and "Delete" operations. Delete shows a confirmation dialog with entity-specific warnings; scenes offer both "Delete from library" (removes DB record + generated files) and "Delete from disk" (also removes the source video file). Performers and Studios pages gain a new grid/list view toggle. Tags page adds checkboxes to its existing list view.
- **Scene delete API** — `DELETE /scenes/:id` endpoint removes the scene record (cascading to join tables), cleans up generated files (thumbnails, sprites, HLS cache), and optionally removes the source video file when `?deleteFile=true` is passed.
- **NSFW/SFW mode system** — per-device content visibility control with three levels: Off (SFW, default), Blur (obscure thumbnails/images until hover), and Show (full display). Mode is stored in a cookie (`obscura-nsfw-mode`) and persists per device.
- **LAN auto-enable** — optional setting to automatically switch to Show mode when accessing from a local network (RFC1918 address detection via `/api/client-info`).
- **isNsfw flag on all entities** — scenes, performers, studios, tags, galleries, images, and library roots all carry an `isNsfw` boolean. Library roots can be flagged as NSFW; content in NSFW roots inherits the flag at scan time. Tags, performers, and studios also propagate their NSFW status to scenes during scans.
- **Identify/scrape defaults** — all entities created through the identify and scrape workflows default to `isNsfw = true`.
- **NsfwBlur / NsfwGate / NsfwText components** — reusable NSFW-aware wrapper components: `NsfwBlur` hides or blurs content based on mode, `NsfwGate` renders children only in non-SFW mode, `NsfwText` applies blur/redaction to inline text.
- **SFW terminology** — superseded by global Video/Actor labels everywhere (see Changed above); SFW mode still hides Identify and applies content filters as before.
- **Identify page redirect** — the /identify page redirects to home when accessed in SFW mode.
- **Content Visibility settings section** — settings page now includes NSFW mode selector and LAN auto-enable toggle; library root cards include a per-root NSFW toggle; the library add form includes an NSFW checkbox.
- **Blur treatment on detail pages** — video player, performer hero image, scene performer chips, and image lightbox all apply blur when viewing NSFW content in blur mode.

### Added

- **NSFW toggle in all edit forms** — scenes, performers, studios, tags, galleries, and images now expose an NSFW toggle in their edit views. The toggle is wrapped in `NsfwGate` so it only appears in blur/show mode, preventing the confusing situation of marking content NSFW and having it immediately vanish in SFW mode. A hint line appears when the toggle is active.
- **NSFW chip in metadata display** — a compact red "NSFW" chip renders inline in the metadata area of every entity detail page (scene header, performer stats row, studio title row, tag title row, gallery panel title, image lightbox). The chip appears only when `isNsfw=true` and requires no mode gating — it is informational metadata, not content.

### Fixed

- **Dashboard NSFW blank spaces** — NSFW items in the Recent Additions carousel are filtered out entirely in SFW mode, eliminating empty placeholder slots where cards would have been.
- **Dashboard SFW terminology** — Quick Nav and Recent Additions use shared entity terms (Videos/Actors) for all modes.
- **Search NSFW filtering** — search results now respect the NSFW mode: in SFW mode, scenes, performers, galleries, and images with `isNsfw=true` are excluded from results at the database level. Kind toggle chips and section headers use Video/Actor labels.
- **Untracked library pruning** — library roots with only video or only image scanning enabled no longer incorrectly claim media of the disabled type, allowing other roots to properly track those files.
- **Settings library toggle** — enable/disable and media-type toggles now use optimistic UI updates and bypass stale server-side cache, so changes reflect immediately and survive page refresh.
- **Changelog dialog visibility** — the changelog panel no longer renders as an always-visible blank shell on page load; it now stays hidden until explicitly opened and can be dismissed normally.
- **Release metadata alignment** — versioned release history now starts at `0.2.0`, the sidebar version reads the current app release, and Docker builds validate the changelog structure before compiling.
- **Changelog rendering** — the in-app changelog dialog now preserves version/category boundaries instead of collapsing the markdown into one large list.
- **Docker changelog bundling** — standalone Next builds now trace `CHANGELOG.md`, and the API route resolves both monorepo and container layouts so deployed images can always load the changelog.

## [0.2.0] - 2026-04-06

### Changed

- **Design language overhaul** — replaced the "Dark Control Room" bevel/machined aesthetic with the "Dark Room" system. Sharp corners (`border-radius: 0` everywhere), material base layers + glass overlay surfaces, brass accent expressed with gradient fills and glow `box-shadow`, mobile-first layout priority, and glow/animation as the primary state language. Updated `docs/design-language.md`, `CLAUDE.md`, and UI color/animation token files.

### Added

- **Jobs maintenance controls** — Job Control now exposes a dedicated red maintenance section with a manual "Force rebuild previews" action, so full preview regeneration can be queued directly from Operations instead of only from Settings diagnostics.
- **Forced rebuild job marking** — preview rebuild actions now queue as an explicit force-rebuild job type. Operations cards and history rows show these maintenance runs with red warning treatment so they stand out from normal background generation.
- **Global search** — full-featured search across scenes, performers, studios, tags, galleries, and images. CMD+K (Ctrl+K on Windows/Linux) opens a command palette overlay with as-you-type results grouped by entity type. Smart ranking weights exact title matches above alias/tag matches. Dedicated /search page with entity type toggles, rating/date filters, show-more pagination, and deep-linkable URLs. Recent searches stored in localStorage. Modular backend provider registry makes adding new searchable entities straightforward.
- **Parent studio support** — studios can now have a parent studio, forming a hierarchy. Studio detail page shows a "Sub-studio of" breadcrumb linking to the parent, and a grid of child studio cards. Edit form includes a searchable parent studio picker. When identifying a studio via StashBox, the parent studio field is now selectable — applying it will find or create the parent studio with loop-prevention for circular references. New `POST /studios/find-or-create` API endpoint handles recursive parent resolution safely.
- **Jobs: per-queue cancel** — Stop button appears next to Run on each queue card when jobs are active or waiting. Cancels all running and pending jobs in that queue.
- **Diagnostics: rebuild previews** — new Diagnostics section in Settings with a "Rebuild all previews" button that clears all generated asset paths and re-queues every scene for preview regeneration. Useful for fixing corrupt trickplay sprites or applying quality changes.
- **Jobs: acknowledge errors** — Operations page adds "Acknowledge errors" (all queues) and per-queue "Clear" when BullMQ has failed jobs. Clears failed jobs from Redis so queue status returns to idle, and marks matching `job_runs` as dismissed so recent history no longer reads as active failures.
- **StashBox ID tracking** — new `stash_ids` table tracks remote entity IDs across StashBox endpoints (StashDB, ThePornDB, FansDB, etc.). Reusable StashIdChips component displays "EndpointName | hash" chips with inline add/remove on all entity detail pages. After successful identification, stash IDs are auto-saved for faster re-identification.
- **Studio identification** — studios can now be identified via StashBox endpoints. New StudioEdit component with form fields (name, url, image), StashBox identify panel, and scrape result preview. Studio detail page gains Edit button and StashIdChips. Bulk identify page adds a Studios tab for batch identification.
- **Tag identification** — tags can now be identified via StashBox endpoints. New TagEdit component with form fields (name, description, aliases), StashBox identify panel, and scrape result preview. Tag detail page gains Edit button and StashIdChips. Bulk identify page adds a Tags tab for batch identification.
- **Studio & tag CRUD** — new PATCH /studios/:id and GET+PATCH /tags/:id API endpoints for updating studio and tag metadata.
- **Reusable image picker modal** — extracted from performer edit into a shared component with full-screen preview, keyboard navigation (arrows, escape), and responsive thumbnail grid with no image cap.
- **StashBox providers in performer edit** — the performer edit scraper dropdown now shows StashBox endpoints alongside community scrapers in grouped optgroups. Seek tries StashBox first for higher confidence matches.
- **Bulk identify improvements** — performer image picker in bulk identify now shows "Browse all (N)" button opening a full lightbox instead of tiny capped thumbnails. All four entity tabs (Scenes, Performers, Studios, Tags) in the bulk identify page.

### Fixed

- **Nested anchors in gallery views** — gallery grid, list, detail (sub-galleries), and timeline views no longer wrap cards in a redundant `<Link>`, fixing invalid nested `<a>` HTML and the resulting hydration errors.
- **Untracked library residue** — library scans now purge images and galleries whose backing folders or zip archives no longer belong to any enabled library root, preventing removed libraries from reappearing in future scans.
- **Slow hover scrub on scene cards** — trickplay sprites now use tighter hover-sized frame caps, lower sprite JPEG quality, and immutable cache headers behind versioned URLs so thumbnail scrub no longer drags in oversized sprite payloads or revalidates them unnecessarily.
- **Stuck queued jobs** — active-task rows can now cancel an individual queued or running job directly, making it possible to clear a single wedged task without stopping the whole queue.
- **Preview sprite pixel overflow** — long or high-resolution videos now downscale and, when necessary, widen trickplay frame spacing before sprite assembly so Sharp no longer fails with `Input image exceeds pixel limit`.
- **Jobs queue amplification** — recurring scans, manual queue runs, and worker fan-out now dedupe against pending work instead of continuously stacking duplicate jobs for the same library root, scene, or image.
- **Preview rebuild storm on scan** — library scans no longer requeue preview generation for every scene on each pass just because it uses generated thumbnails; preview jobs now enqueue only when derived assets are actually missing.
- **Queue cancellation accounting** — canceling a queue now removes waiting and delayed jobs correctly and updates persisted run state from the real BullMQ statuses (`waiting`, `active`, `delayed`) instead of the stale `queued` label.
- **Film strip playhead drift** — film strip now uses frame-based positioning (matching VTT time ranges) instead of linear interpolation over video duration, fixing the playhead being ahead of the actual frame in view.
- **Blank trickplay frames on concatenated videos** — replaced the single-pass ffmpeg `tile` filter with individual frame extraction + sharp stitching. Each frame is extracted independently, making trickplay robust against mid-stream format/colorspace changes common in compilations and re-encoded content.
- **Global search ⌘K / Ctrl+K** — shortcut is registered on `window` in capture phase with `stopPropagation`, uses `KeyboardEvent.code` (`KeyK`) so layout/locale does not break matching, and Escape closes the palette without stale state. Video player no longer treats modifier+K as play/pause, so the shortcut works on scene pages.
- **Gallery card thumbnails** — gallery card images now fit within the frame (`object-contain`) instead of cropping (`object-cover`), matching the fix applied to studio and tag banners.
- **Studio card thumbnails** — studio list card images now use `object-contain` so logos and icons display fully instead of being cropped.
- **Bulk identify parent studio** — parent studio field in bulk identify is now selectable and functional. Accepting a studio with parent checked will find or create the parent studio. Parent is unchecked by default since data quality varies across endpoints (e.g. ThePornDB).
- **StashBox compatibility** — `testConnection()` now uses the spec-compliant `{ __typename }` introspection query instead of the StashDB-specific `version` query, fixing connectivity with ThePornDB, FansDB, and other non-StashDB endpoints.
- **Settings auto-save** — library pipeline toggles (auto-scan, metadata, fingerprints, previews, trickplay) now save immediately on click instead of requiring a separate Save button. Brief "Setting saved" feedback auto-dismisses after 2 seconds.
- **StashBox enable/disable feedback** — toggling a StashBox endpoint's enabled state now shows a success message so the user knows it persisted.
- **Gallery lightbox editing** — edits made in the image lightbox info panel (rating, tags, organized) now properly update the parent UI state. Previously the API call succeeded but changes weren't reflected until page reload.
- **Interactive star ratings** — image feed cards now have clickable star ratings that persist immediately, matching the behavior on scene detail, performer detail, and gallery metadata panels.
- **Studio image download during bulk identify** — bulk studio accept now downloads images from StashBox URLs and stores them locally, instead of just saving the URL string.
- **Wide banner images for studios and tags** — studio and tag cards show 16:7 banner images on top; detail pages use full-width 21:7 hero banners with gradient overlays and overlaid titles. Tag list items show small wide thumbnails when images are available.
- **StashBox ID chips on all entity pages** — scene detail (in file info sidebar), performer detail (after biography), studio detail, and tag detail pages all display StashBox ID chips with add/remove support.
- **Strict tag matching** — tag identification now requires exact name or alias match from StashBox, eliminating false positives from fuzzy search in both bulk and individual identify.

### Changed

- **Jobs bulk controls** — the Live Work section now has a `Kill all` action for all queued/running tasks, and the Failures section now has its own `Clear all` action so both lists can be managed directly where they are shown.
- **Per-job operations** — the jobs API now exposes a single-run cancel action, and the Operations page uses it from each live task card instead of forcing queue-wide stops for isolated stuck work.
- **Jobs page operations view** — replaced the mixed recent-runs table with separate queue, live-work, failures, and retained-completions sections. Active cards now show trigger/context clearly, failures expose full error output inline, and manual queue actions report when work was skipped because it was already pending.
- **Job runtime policy** — queue workers now run with conservative per-queue concurrency, short Redis retention for completed jobs, and periodic pruning of terminal `job_runs` history so active work and uncleared failures stay visible without unbounded buildup.
- **Jobs API shape** — queue summaries now expose backlog and concurrency, and job payloads now carry trigger metadata so the UI can explain what caused a task to start.
- **Images sidebar** — removed Grid/Feed sub-navigation under Images; the images page toolbar remains the control for grid vs feed (URL `?view=` unchanged).
- **Full-featured studios** — studios now support description, aliases, local image storage (upload/delete), 5-star ratings, favorites, and scene count. Full CRUD (create/delete), image upload endpoints, and asset serving. Detail page matches performer pattern with image hover upload, rating stars, favorite toggle, and delete button.
- **Full-featured tags** — tags now support local image storage (upload/delete), 5-star ratings. Full CRUD (create/delete), image upload endpoints, and asset serving. Detail page matches performer pattern with image hover upload, rating stars, favorite toggle, and delete button.
- **Expanded StudioItem/TagItem types** — GET /studios and GET /tags now return all metadata fields.
- **Image feed view** — new Reddit/Twitter-style vertical scroll feed for images, available alongside the existing masonry grid. Feed cards display full-width media with title, date, file size, dimensions, rating, and tags. Includes infinite scroll via IntersectionObserver sentinel. Grid/feed toggle in the images page toolbar and gallery detail images section. URL param `?view=feed|grid` persists the view choice.
- **Virtualized feed with single-active video** — feed cards use two-tier IntersectionObserver virtualization. Off-screen cards collapse to height-preserving placeholders (`contain: strict`). Video cards start with `preview.mp4` and upgrade to full-quality original when scrolled into the activation zone (50% visible). Only one video plays at a time across the entire feed; all others pause. Leaving the render zone unmounts the video entirely.
- **Stash-Box integration** — connect to StashDB, FansDB, PMVStash, ThePornDB, and other stash-box instances for fingerprint-based scene identification.
  - **Stash-Box endpoint management** — new "Metadata Providers" section in Settings with CRUD for stash-box endpoints. Add/edit form with preset buttons for known instances, API key input, and "Test Connection" button with inline success/error feedback.
  - **Fingerprint-first scene identification** — new `POST /stashbox-endpoints/:id/identify` route looks up scenes by oshash/MD5/phash fingerprints first (high-confidence), then falls back to title search. Results stored in `scrape_results` with `matchType` tracking.
  - **Standalone lookups** — query studios, tags, and performers directly against any stash-box endpoint via dedicated lookup routes.
  - **Unified metadata providers** — `GET /metadata-providers` returns combined list of community scrapers and stash-box endpoints. Both types appear in the same selection UI.
  - **StashBox GraphQL client** — new `packages/stash-import/src/stashbox/` with typed client, rate limiting (240 req/min), fingerprint batching (40/request), and normalizer that converts stash-box results to existing accept-flow shapes.
- **Studio enrichment on scrape accept** — when accepting scrape results, studios are now created with URL, image, and parent hierarchy from the raw scraper output. Existing studios are backfilled with missing fields. Previously only the studio name was stored.

### Changed

- **Gallery video performance** — video tiles in the image grid and gallery cards no longer auto-load the full original file. Tiles show `thumb.jpg` by default and only swap to the lightweight `preview.mp4` when in-view and hovered. Adds `isVideo` and `previewPath` fields to `ImageListItemDto`, a dedicated `GET /galleries/:id/images` paginated endpoint, a 50 MB size cutoff for inline previews, and `preload="none"` on all preview videos.
- **Sidebar Images sub-nav** — when the Images route is active, the sidebar expands to show Grid and Feed sub-links for quick view switching.
- **Scrapers → Metadata Providers rename** — nav "Scrape" renamed to "Identify" at `/identify`, scrapers page header changed to "Community Scrapers", bulk scrape renamed to "Identify", button labels updated. Settings now groups stash-box endpoints and community scrapers under a unified "Metadata Providers" section.

### Previously added

- **Gallery support** — major new feature: browse image galleries alongside scenes. Galleries are discovered from library folders, zip/cbz/cbr archives, or created manually.
  - **Three gallery types**: folder-based (directory on disk becomes a gallery with sub-directory hierarchy), zip-based (.zip/.cbz/.cbr archives), and virtual (manual user-created collections).
  - **Library root media type** — each library root now has `scanVideos` and `scanImages` checkboxes, allowing fine-grained control over what media types are discovered per root.
  - **Image scanning pipeline** — new `gallery-scan`, `image-thumbnail`, and `image-fingerprint` BullMQ workers. Gallery scan discovers image-containing directories and zip archives, creates gallery/image entities, and enqueues thumbnail and fingerprint jobs. Thumbnails generated via ffmpeg at 640px width. Supports JPEG, PNG, WebP, GIF, AVIF, HEIC, BMP, TIFF.
  - **Gallery list page** — four view modes: card grid (with hover preview cycling), compact list, folder tree browser, and chronological timeline. Full filter/sort bar with search, type, tag, studio, and performer filters.
  - **Gallery detail page** — two-column layout with masonry image grid (CSS columns), load-more pagination, and sticky metadata panel. Metadata panel supports inline editing of title, details, date, photographer, rating, and organized flag. Displays studio, performers, tags, and chapter bookmarks.
  - **Image lightbox** — full-screen portal overlay with CSS-transform pan/zoom (scroll wheel, double-click, drag), arrow key + button navigation, thumbnail filmstrip with auto-scroll, slide-in info panel (dimensions, size, format, rating, tags), slideshow mode with play/pause (Space key), chapter jump menu, and fullscreen toggle. Preloads adjacent images for instant navigation.
  - **All Images page** — browse all images across all galleries with search, filter, and lightbox integration.
  - **Gallery metadata** — galleries and images are first-class entities with own rating (0-100), tags, performers, studios, and chapters (named bookmarks at image indices).
  - **Sub-galleries** — folders within gallery folders become child galleries with their own metadata, forming a navigable tree.
  - **Navigation** — "Images" added to sidebar and mobile navigation. "Galleries" promoted to mobile primary tabs.
  - **HEIC support** — `libheif` added to Docker image for Apple HEIC photo format support.
  - **Zip image serving** — full-size images from zip/cbz/cbr archives are extracted on demand and served without persistent extraction, keeping storage efficient.
- **Thumbnail & trickplay quality settings** — new `thumbnailQuality` and `trickplayQuality` slider controls in Settings (ffmpeg `-q:v` scale, 1 = best, 31 = worst, default 2). Quality now controls both JPEG compression **and** resolution: quality 1 ("Native") uses full video resolution with near-lossless JPEG; quality 31 ("Minimum") downscales to 320px/160px. Each slider scales independently.
- **App version in sidebar** — the sidebar footer now shows the semver version (from root `package.json`) instead of "Workers idle". Clicking the version opens a changelog dialog.
- **Changelog dialog** — lazy-loads `CHANGELOG.md` into a centered modal with parsed markdown headings, lists, and inline code. Available in Docker builds via a new `/api/changelog` route. Route resolves CHANGELOG.md in both dev (monorepo) and production (standalone) layouts.

### Changed

- **Tags page** — replaced bulky card grid (gradient headers, progress bars) with a dense multi-column list view. Tags are compact rows with inline scene/image counts. Stats strip simplified to a single inline summary. Cloud view retained as alternative.

### Fixed

- **XPath scraper `common` block support** — scraper YAML `common` variables (e.g. `$datablob`, `$videoDetails`) are now string-replaced into selectors before XPath evaluation, matching Stash behavior. This was the root cause of PornHub and many other XPath scrapers returning empty results.
- **XPath scraper cookie support** — scrapers that define `driver.cookies` in their YAML (e.g. PornHub's age-gate cookie) now send those cookies in the fetch request, fixing scraping failures on sites that require cookie-based auth.
- **NFO HTML entity decoding** — titles imported from NFO sidecar files now decode standard XML entities (`&apos;`, `&amp;`, `&quot;`, numeric refs) so titles display correctly instead of showing raw markup.
- **NFO rating normalization** — ratings read from NFO files are now normalized to the 0-100 scale (auto-detecting 0-5, 0-10, and 0-100 ranges); values above 100 (vote counts) are discarded instead of stored as raw numbers.
- **Star rating optimistic UI** — clicking stars to rate or un-rate a scene or performer now updates the display immediately instead of waiting for the server response; reverts on failure.
- **Thumbnail/trickplay regeneration** — preview scans now always regenerate thumbnails, sprites, and trickplay for scenes without a user-set custom thumbnail, so quality setting changes take effect on the next scan.
- **Thumbnail resolution scaling** — thumbnail and trickplay resolution now scales with the quality slider from native video resolution (quality 1) down to 320px/160px (quality 31), replacing the previous fixed sizes.
- Scene video player: fullscreen control now falls back to video-element and WebKit native fullscreen so it works on mobile browsers (notably iOS) where `requestFullscreen` on the player wrapper is unsupported or unreliable.
- Mobile navigation: "More" tab now opens a slide-up sheet with all navigation sections (Dashboard, Galleries, Studios, Collections, Scrape, Settings) instead of linking directly to Settings, restoring parity with the desktop sidebar.
- Sidebar hydration shift: layout reads the sidebar cookie server-side via `cookies()` and passes the initial collapsed state to `AppShell`, eliminating the post-hydration layout jump.

### Changed

- Scene video player: control chips, dropdowns, and the seek bar no longer use backdrop blur on the video; overlays use solid panels so the picture stays sharp behind the UI.
- Scene video player: removed the `surface-media-well` inset vignette overlay so the frame edges stay clean.

- Web UI package now exposes direct subpath entry points for utilities, primitives, composed components, and app-shell navigation data; the web app now imports those paths directly instead of pulling from the root barrel.
- Scene detail now lazy-loads the player component, and adaptive playback only imports `hls.js` when the user actually enters the HLS path.
- Video player timeline now shows all markers instead of truncating at four, and hover tooltips include the hovered timestamp plus nearby marker titles for faster navigation.

- Web app: all primary routes (dashboard, scenes, performers, tags, studios, settings, scene detail, performer detail, review) now fetch initial data on the server and hydrate client views from seeded props instead of bootstrapping the first render through `useEffect`.
- Fetch layer split into `server-api.ts` (server-only, with `next.revalidate` and `next.tags` caching semantics) and `api.ts` (client mutations and re-fetches). Server pages import from the server layer; client components keep using the client layer.

- Tags page: full visual redesign — 4-column stats strip, sort/search toolbar matching scene gallery, grid view with gradient-backed tag cards, cloud view toggle, intensity bars and scene count badges.
- Tag detail page: surface-card-sharp header with inline metadata, stats strip (scenes/duration/tag accent), separator, empty state for tagless results.

- Settings page: full visual redesign to match scene gallery design language — sharp 3px corners, `surface-card-sharp` cards, LED indicators on toggles and library roots, gradient glow on Save button, floating section headers with accent icons.
- Settings page: storage section uses `surface-stat` cards with meter bars and accent Total card instead of flat rows.
- Settings page: scrapers link gets pill-accent count badge and hover glow effect.
- Settings page: toggle cards are full clickable buttons instead of checkbox labels.
- Settings page: Save Changes button only activates (accent gradient + glow) when settings are dirty; stays dimmed when no changes pending.
- Settings page: file browser simplified — navigating auto-selects the current folder, removing the extra "Use Current Folder" step. Added cancel button and scrollable directory listing.
- Scrapers page: installed scrapers section is now collapsible with chevron toggle; capability filter merged into the collapsible header bar.
- Scrapers page: scraper cards and community index entries use `surface-card-sharp` for better visibility against the dark background.
- Jobs page: full visual redesign — stats strip (Active/Completed/Failed/Last Scan), queues in responsive grid with LED indicators and dark stat cells, scrollable Recent Runs table with error row tinting, section separators with accent icons.
- Bulk scrape page: unified Scenes + Performers tabs in one view, seek mode cycles all capable scrapers per item (5s timeout), auto-accept option, stats strip with progress meter, shows matched scraper name, sharp card design language.
- Bulk scrape: each scraped field is toggleable via checkbox (defaults all enabled), allowing users to exclude specific fields before accepting. Disabled fields shown struck-through.
- Bulk scrape: scraper selector dropdown to choose a specific scraper or "Seek all" mode.
- Bulk scrape: "Show all" toggle to include organized scenes and complete performers.
- Bulk scrape: expand all / collapse all for reviewing results in bulk.
- Bulk scrape: performer detail shows portrait images with selection thumbnails when multiple images returned.
- Bulk scrape: performer scraper results now require exact name match to reduce false positives from partial/first-name matches.
- Scene scrape accept now downloads thumbnail from scraped imageUrl when the "image" field is selected.
- Scene expanded detail redesigned: large thumbnail on left with toggle, fields on right in 2-column grid, performers as accent tag-chips and tags as default tag-chips, each individually removable with X buttons.
- API accept endpoint supports `excludePerformers` and `excludeTags` arrays to skip specific items during import.

### Fixed

- Scene gallery scroll rendering no longer stalls behind expensive per-card blur effects. Media cards now use cheaper static overlay chips, isolate card paint work, and lazy-load below-the-fold thumbnails so new cards can paint during active scrolling instead of snapping in after scroll end.
- Scene gallery thumbnails no longer aggressively cached — changing a scene thumbnail now shows the updated image on next visit instead of staying stale for 24 hours.
- Scene gallery scroll performance improved — thumbnails now preload 300px before entering the viewport using IntersectionObserver, eliminating the "snap in" effect when scrolling stops.
- Scrape accept saved thumbnail with wrong asset URL (`/thumbnail` instead of `/thumb-custom`), causing the custom image to not display on scene cards or the scrape page.
- Custom thumbnails (from scrape, upload, URL, or frame pick) now clear `cardThumbnailPath` so the gallery card shows the custom image instead of the stale auto-generated card thumbnail. Resetting the thumbnail restores both paths.
- Bulk scrape scene matching now ignores URL-scoped scraper variants when the scene URL does not match, preventing unrelated community scrapers from claiming scenes and leaking malformed metadata.
- Scraped scene dates now reject structured payloads and other unparseable values instead of storing raw JSON-LD blobs in the `date` field.
- XPath scraper evaluation errors are now reported as per-scraper failures during bulk scrape instead of bubbling up as API 500 responses.
- Library scan now skips preview/sample files (`-preview.mp4`, `_preview.mp4`, `-sample.mp4`, `-thumb.mp4`, `-sprite.mp4`) preventing duplicate scene entries. Previously imported preview files are cleaned up on next scan.
- HTML entities (`&amp;`, `&quot;`, etc.) in filenames and scraper results are now decoded correctly in titles and metadata fields.

### Added

- Rating badge on scene cards in both grid and list views — shows filled star with rating (1–5) when a scene has been rated.
- Full performer CRUD API: `POST /performers`, `PATCH /performers/:id`, `DELETE /performers/:id`, favorite/rating quick toggles.
- Performer image pipeline: upload, download from URL (including base64 data URLs), and asset serving at `/assets/performers/:id/image`.
- Performer scraping API: `POST /scrapers/:id/scrape-performer` with action cascade (performerByURL, performerByName, performerByFragment).
- `POST /performers/:id/apply-scrape` for applying scrape results with selective field application.
- Enhanced scene scrape acceptance: when accepting a scene scrape, performer metadata (gender, birthdate, country, image, etc.) is now applied from raw scraper data instead of discarding everything except names.
- `performerTags` join table for tagging performers independently of scenes.
- `imagePath` column on performers for locally-stored portrait images.
- Database indexes on performers: name, gender, favorite, rating, created_at.
- Performer normalizer (`normalizePerformerResult`) in stash-import package.
- Performer list page with portrait grid cards (3:4 aspect), server-side filtering (gender, favorites), sorting (name, scenes, rating, recent), pagination, and debounced search.
- Performer detail page with sidebar portrait layout, interactive favorite/rating, metadata grid with age calculation, tags, biography, and scene filmography.
- Performer edit component with full form fields, scraper integration panel with result preview and selective field application, image upload/delete, and tag management.
- Bulk performer scrape page at `/performers/scrape` with sequential scraping, auto-accept option, and per-row accept/reject.
- Performer route constants and DTOs (`PerformerListItemDto`, `PerformerDetailDto`, `PerformerUpdateDto`, `NormalizedPerformerResult`) in contracts.
- Frontend API client functions for all performer CRUD, image, and scraping operations.
- Scrapers page: stats strip (installed/scene/performer counts), capability filter toolbar, human-readable capability labels with categorized accent styling, performer capabilities highlighted with brass chips.
- Community index: checkbox selection with select-all toggle and bulk install action bar for installing multiple scrapers at once. Browse button uses Globe icon, switches to RefreshCw after index loads.
- Settings page: scrapers section replaced with link card to dedicated `/scrapers` page, tightened design language with proper kicker labels and accent styling.
- Seek button on scene and performer scraper panels: automatically cycles through all installed scrapers until one returns results. Pressing again continues from the next scraper in the list. Uses SkipForward (media player) icon, enforces 5-second timeout per scraper.
- Image picker in performer scrape results: when scrapers return multiple images, user can click to select which portrait to use.
- Performer portrait thumbnails now displayed across all scene views: scene detail chips (36x48px portraits), scene edit tag chips (inline 16x12px), scene grid list mode, MediaCard grid cards, and dashboard recent additions.

- Dashboard added to sidebar nav as first item under a new "Overview" section; logo/logomark now link to `/` so clicking the logo always navigates home.
- Dashboard page now displays live library stats (scene count, total duration, storage, weekly additions) and job activity feed from the API, replacing hardcoded zeroes.
- Performers listing page wired to `GET /performers` with client-side search/sort, performer card grid, and links to detail pages.
- Performers detail page using `GET /performers/:id` (new endpoint) — shows bio, career metadata, and a full scene grid filtered by performer.
- Studios listing page wired to `GET /studios` with search/sort and cards linked to detail pages.
- Studios detail page using `GET /studios/:id` (new endpoint) — shows studio info and filtered scene grid.
- Tags listing page wired to `GET /tags` — live tag cloud (top 40 sorted by scene count) with navigation links, plus a searchable tag list.
- Tags detail page using `fetchScenes({ tag: [name] })` — real scene grid for each tag.
- `GET /performers/:id` API endpoint returning full performer metadata (bio, aliases, gender, birthdate, country, career dates, etc.).
- `GET /studios/:id` API endpoint returning studio detail (name, URL, image).
- `fetchPerformerDetail` and `fetchStudioDetail` helper functions added to `api.ts`.
- Galleries and Collections pages upgraded to properly styled Dark Control Room empty states with contextual links.
- `GET /galleries` API returning an empty typed list until gallery persistence exists; `GalleryListItemDto` and `apiRoutes.galleries` in contracts; `fetchGalleries` on the web client.

### Fixed

- MediaCard touch scrub on mobile: horizontal swipe now locks into scrub mode via direction detection (8 px threshold) instead of being cancelled by vertical scroll.

### Changed

- Dashboard hero logo and title enlarged to proper hero size (48 px mark, `text-2xl` title); removed redundant “Home” subtitle.
- Dashboard: removed redundant “System channels” row; added “Recent additions” ingest strip (motion vs stills labels, merged sort by `createdAt`, horizontal snap scroll, optional dashed “stills slot” when no galleries); hero and “Library” labels tightened.
- Dashboard hero clock defers live updates until after mount so SSR and hydration match; recent scene tiles use the same `MediaCard` stack as the scenes gallery (shared `SCENE_TAG_COLORS` map).
- Dashboard copy trimmed: hero uses app `Logo` plus short subtitle; section headings and empty states shortened; stats row has no kicker label.
- Dashboard UI aligned with the scene gallery and player: glass hero with brass glow, sharp `surface-card-sharp` panels, gradient meter strips on stats, per-queue telemetry rack, and browse tiles with glass icon wells and gradient accents; logic split into `components/dashboard/*` modules.
- Unified Docker deployment into a single all-in-one image (`ghcr.io/pauljoda/obscura`) with PostgreSQL, Redis, nginx, and all application services bundled together.
- Simplified docker-compose.yml to a single service with two volume mounts (`/data` and `/media`).
- Only port 8008 is exposed — nginx reverse proxy routes API requests internally.
- Updated CI/CD workflow to build and publish the unified image.
- Replaced private license with Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
- Rewrote README with simplified quick start, `docker run` one-liner, and zero-configuration deployment.

### Added

- Low-resolution card thumbnails (160px, quality-optimized) generated during preview pipeline for fast gallery loading.
- `loading="lazy"` and `decoding="async"` on all scene gallery thumbnail images.
- Sprite sheet preloading on hover for snappier trickplay scrub activation.
- Memoized sprite dimension calculations in MediaCard to reduce re-render cost during scrubbing.
- 24-hour immutable cache headers on all generated scene assets (thumbnails, sprites, previews, trickplay).
- Bootstrapped monorepo with pnpm workspaces and turborepo (web, api, worker, packages).
- Dark Control Room design language with burnished brass accent palette, five-level surface hierarchy, and three-voice typography (Geist, Inter, JetBrains Mono).
- Scene browsing grid with interactive filter bar, sorting, and responsive card layout.
- Scene detail view with metadata display, performer tags, and studio attribution.
- Video player with HLS adaptive streaming, poster frames, and keyboard controls.
- Film-strip trickplay scrubber with hover preview and sprite sheet support.
- HLS transcoding pipeline with ffmpeg — on-demand cache renditions per scene.
- Fastify API with typed route contracts for scenes, assets, streaming, and settings.
- PostgreSQL schema via Drizzle ORM — scenes, performers, studios, tags, fingerprints, and library roots.
- BullMQ worker for library scan, media probe, thumbnail generation, sprite sheet extraction, and HLS cache jobs.
- Settings page with library root configuration and scan controls.
- Stash import adapter for migrating scenes, performers, studios, and tags from Stash databases.
- Scraper system with community scraper support, XPath/JSON selectors, and tagger UI.
- Resolve workflow for matching and merging scraped metadata into the library.
- Shared typed contracts package (`@obscura/contracts`) for DTOs, route constants, and job identifiers.
- Media-core package with file discovery, fingerprint hashing, and scan primitives.
- UI package with design tokens, composed media cards, and shared primitives.
- Docker Compose development stack with PostgreSQL, Redis, and all three services.
- Architecture and design language documentation.
- Aperture-style SVG logo in burnished brass.

### Fixed

- CORS preflight handling for settings and API routes.
- Content-type header omission for empty request bodies.
- Shared cache root resolution between API and worker services.
- Thumbnail population during library scan and pruning of missing scenes.
