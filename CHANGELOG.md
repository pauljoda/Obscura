# Changelog

Important user-facing changes are documented here. This changelog is intentionally curated and high level; use the git history for commit-by-commit detail.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]
### What's New
- Obscura v2 rebuilt the app around a .NET API, EF Core persistence, PostgreSQL, and a .NET worker, replacing the legacy server/runtime path with one backend-owned architecture.
- The media library now uses EF-backed entity records with explicit child and relationship links for videos, series, seasons, images, galleries, books, audio, people, studios, tags, and collections, giving browse and detail pages a common model without a global graph abstraction.
- Entity pages now load and display child and related items through a lighter relationship model, making large series, galleries, and collections faster to browse.
- Playback now follows Jellyfin-compatible video routes for playback negotiation, direct streaming, adaptive HLS, trickplay image playlists, playback sessions, and watched-state updates.
- The Svelte frontend now renders the v2 browse, dashboard, detail, identify, plugins, settings, and playback surfaces through shared Dark Room components instead of the older v1 UI patterns.
- The temporary v2 migration, fresh-start, backup, and legacy-import tools were removed now that current builds run directly on the EF-backed entity model.
- Identify review now separates structural children from related people and studios, so series cascades can carry seasons, episodes, credits, and artwork together.
- Identify now applies full credit lists even when the same person has multiple roles on a title, preserving the combined credit metadata without crashing.
- Identify review now recognizes existing tags and credits in the v2 relationship model and lets review thumbnails be selected without navigating away.
- The C# domain model was intentionally reset around abstract entities and mutable typed capabilities, creating a breaking foundation for the next EF/API integration pass.
- Domain persistence now starts from an application-level `EntityRepository`, keeping entities persistence-ignorant while EF hydrates short-lived domain slices.
- Entity API contracts now model child and relationship groups as labeled arrays of entity thumbnails instead of domain/entity-reference records.
- Browse, detail, thumbnail, rating, flag, playback, and marker routes are back on the .NET API and now read through EF projections while writes save domain entity state.
- Plugin identify requests now use `structuralContext` instead of the old `graph` field, so community v2 plugins must update to the new structural-context protocol.
- Reads and writes now flow through one faithful domain entity and a single projection, so detail pages, ratings, flags, playback, markers, and all other capabilities stay consistent across the app.
- The legacy "counters" concept was removed: scraped numeric metadata (runtime, vote counts, and similar) now lives in entity stats, and structural counts are derived from child items instead of being stored. Community identify plugins must send `stats` instead of `counters`, and you should rescan your library roots.
- Entity hierarchy storage now uses each entity's parent pointer directly instead of a separate child-link table, reducing duplicated structure and preserving existing structural links during migration.
- Video subtitles and thumbnail previews now recover from stale generated media cache entries, so rescans can rebuild missing subtitle files and browse thumbnails can use trickplay hover previews again.

### Added
- High-level v2 implementation summary for the rebuilt Obscura architecture, media model, playback pipeline, and UI surfaces.
- EF-projected browse/detail APIs for videos, series, seasons, images, galleries, books, audio libraries/tracks, people, studios, tags, collections, and generic entity lists.

### Changed
- The v2 development data model was simplified around generic entity children, relationships, and thumbnail projections; rescanning/importing v1 data is required.
- Changelog entries are now curated release notes for important user-visible changes instead of an exhaustive development log.
- Domain entities now use a breaking object-oriented model with enum entity kinds and attached mutable capabilities instead of registry/string capability lookups.
- Entity children and relationships now group by `EntityKind`, and video credits now live in a mutable typed credits capability.
- Child and relationship API payloads now share one grouped entity shape with `kind`, `label`, and `entities` fields.
- Plugin identify protocol context was renamed from `graph` / `IdentifyGraphContext` to `structuralContext` / `IdentifyStructuralContext`.
- The `Counters` capability, `entity_counters` table, and the plugin metadata-patch `counters` field were removed; numeric scraped metadata now uses `stats`. Rescanning v1 data is required.
- The rating capability payload was flattened (`value` is now the rating number directly instead of a nested object), and the unused domain image capability and `entity_aliases` table were removed.
- Entity hierarchy persistence now treats `parent_entity_id` and `sort_order` on `entities` as the source of truth; domain hydration still builds child arrays for application code.

### Fixed
- Series and season browse and detail pages now load correctly; an entity-kind code mismatch previously made `/api/series` and season routes return empty lists and 404s.
- Backend startup no longer reports pending EF model changes from entity-kind seed metadata drift.
- Series, season, video, gallery, collection, and audio detail pages now show their migrated child items and relationships again.
- Identify cascade review now applies nested season and episode selections while preserving credit and studio pictures from related entity proposals.
- Identify apply no longer fails on titles whose full credits include the same person in multiple roles, such as cast plus writer or creator.
- Identify review no longer marks existing relationship tags as new or navigates away when clicking selectable cast thumbnails.
- Local v2 reset now keeps required entity-kind metadata so legacy migration tests can run cleanly.
- Entity rating, flags, playback resume/completion, and timeline marker writes now persist through domain behavior and EF repository saves.
- Video browse thumbnails now advertise generated trickplay playlists to the frontend, restoring hover preview scrubbing on grid cards.
- Missing generated subtitle files now cause videos to be queued for subtitle extraction again, and re-extraction refreshes the existing subtitle track instead of adding a duplicate stale entry.

### Removed
- Historical v1-era release note detail was pruned from the changelog; git history remains the complete record.
- The stale API projection service layer was removed from Application/Infrastructure while the new domain-first persistence slice is established.
- Temporary v2 upgrade-gate, fresh-start, backup, and legacy import endpoints/jobs/UI were removed from the app.
- The empty `image_details`, `book_volume_details`, `book_page_details`, and `audio_library_details` placeholder tables were dropped now that no entity carries kind-specific columns for those storage shapes.
- The duplicated `entity_child_links` table and empty `studio_details` table were dropped; structural children are derived from entity parent fields and studios use the shared entity row only.

### Docs
- Backend architecture guidance now documents the Clean Architecture, DDD-lite, CQRS-lite, EF Core, DTO, and generated-client contract for future Obscura work.
- Repository instructions now keep changelog updates short, user-focused, and release-note-worthy.
- User docs no longer reference the removed breaking-upgrade gate, and historical project plans were removed from the repo docs.

## [0.22.0] - 2026-05-09
### What's New
- Historical release notes before the v2 changelog reset were intentionally pruned to keep future release notes focused and readable.

### Added

### Changed

### Fixed

### Removed

### Docs
