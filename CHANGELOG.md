# Changelog

Important user-facing changes are documented here. This changelog is intentionally curated and high level; use the git history for commit-by-commit detail.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]
### What's New
- Obscura v2 rebuilt the app around a .NET API, EF Core persistence, PostgreSQL, and a .NET worker, replacing the legacy server/runtime path with one backend-owned architecture.
- The media library now uses a shared entity graph for videos, series, seasons, images, galleries, books, audio, people, studios, tags, and collections, giving every browse and detail page a common model.
- Entity pages now load and display child and related items through a lighter relationship model, making large series, galleries, and collections faster to browse.
- Playback now follows Jellyfin-compatible video routes for playback negotiation, direct streaming, adaptive HLS, trickplay image playlists, playback sessions, and watched-state updates.
- The Svelte frontend now renders the v2 browse, dashboard, detail, identify, plugins, settings, and playback surfaces through shared Dark Room components instead of the older v1 UI patterns.
- V2 migration and scanning preserve core metadata where possible, rebuild generated cache assets, and make breaking schema resets explicit while the project remains pre-1.0.
- Identify review now separates structural children from related people and studios, so series cascades can carry seasons, episodes, credits, and artwork together.

### Added
- High-level v2 implementation summary for the rebuilt Obscura architecture, media model, playback pipeline, and UI surfaces.

### Changed
- The v2 development data model was simplified around generic entity children, relationships, and thumbnail projections; rescanning/importing v1 data is required.
- Changelog entries are now curated release notes for important user-visible changes instead of an exhaustive development log.

### Fixed
- Series, season, video, gallery, collection, and audio detail pages now show their migrated child items and relationships again.
- Identify cascade review now applies nested season and episode selections while preserving credit and studio pictures from related entity proposals.
- Local v2 reset now keeps required entity-kind metadata so legacy migration tests can run cleanly.

### Removed
- Historical v1-era release note detail was pruned from the changelog; git history remains the complete record.

### Docs
- Repository instructions now keep changelog updates short, user-focused, and release-note-worthy.

## [0.22.0] - 2026-05-09
### What's New
- Historical release notes before the v2 changelog reset were intentionally pruned to keep future release notes focused and readable.

### Added

### Changed

### Fixed

### Removed

### Docs
