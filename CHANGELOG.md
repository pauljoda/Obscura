# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

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
