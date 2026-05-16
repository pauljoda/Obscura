# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]
### What's New
- The Plugins page now manages v2 community plugins directly, including local discovery, install/remove, and editable API-key credentials for TMDB.
- Saved TMDB API keys from the previous `TMDB_API_KEY` credential shape are now reused by the v2 `apiKey` plugin field.
- Video and series detail pages now expose the v2 identify review drawer directly from the entity header.
- The Identify page now has a v2 review workflow for movies and series, including provider selection, candidate switching, field toggles, artwork picks, and transient bulk sessions.
- V2 community plugins can now be discovered from local development folders, installed, configured with credentials, and used by the new identify API without persisting review results.
- V2 metadata identify can now apply selected provider results into entity metadata, including provider IDs, taxonomy, dates, stats, classifications, and selected artwork files.
- V1-to-v2 migration now preserves TV series artwork and season metadata, including series posters, backdrops, logos, season posters, air dates, descriptions, and external IDs.
- V1-to-v2 migration now keeps and rebuilds legacy series artwork files, so migrated posters, banners, logos, and season covers load after a fresh-start reset.
- Series and video detail pages now share the same Cast and Crew thumbnail section, with studios shown alongside credited people and character names preserved as subtitles.
- Scanned and migrated TV-style series now keep their season hierarchy, so shows with `Season 1` folders open as series → season → episode instead of flat episode lists while preserving imported metadata.
- Series detail pages now show the series metadata, a horizontal season poster row, and ordered episode grids. Season pages now load their own structured detail with episodes from the backend hierarchy instead of relying on a placeholder.
- Video timeline hover previews now show the active marker chapter name while hovering inside a marked section, and omit the chapter label when no markers define chapters.
- The desktop sidebar now remembers whether it was collapsed before a reload, so the app shell opens at the saved width without flashing expanded first.
- Video player timelines now use real VidStack chapter sections for markers, with physical section breaks and no separate marker tick overlay.
- Video player marker chips now seek to their marker time when clicked, matching the filmstrip marker labels.
- Video marker tabs can now create, edit, delete, and seek timeline markers again on the v2 video detail page.
- Detail pages can now define tabs from reusable shared sections plus route-specific sections, with optional tab icons, making rich video panels easier to keep consistent across the app.
- Video detail pages now bring back richer tabbed panels for metadata, markers, transcripts, and files, using shared detail-page tab chrome.
- Credit thumbnails now fit more names without immediate clipping by using wider person cards and compact title text that can scale down before ticker scrolling starts.
- Video Cast and Crew thumbnails are now smaller and use centered titles with role subtitles, so credits feel secondary to the main video while staying scannable.
- Entity thumbnail titles are now smaller by default and can be aligned per card, helping longer media names fit naturally in dense grids.
- Mobile breadcrumbs now collapse the previous page behind the `...` menu and ticker long current titles on hover, preventing header controls from overlapping video titles.
- Video detail pages now show Cast and Crew as horizontally scrollable thumbnail rows, with studios separated from cast and character labels shown under credited people when available.
- Video detail pages now use the app-shell breadcrumb instead of a page-local Videos back link, keeping navigation compact at the top of the screen.
- Video detail pages now use a plain no-image detail header below the player, keeping the video player itself as the visual preview instead of repeating the thumbnail.
- Video player captions are now controlled from the settings menu, while the row button uses a side-panel icon to show or hide the transcript sidecar without changing caption playback.
- Adaptive HLS now advertises Jellyfin-style bitrate quality levels and shows the active Auto/manual bitrate beside the player's Adaptive HLS chip, with current/native stream dimensions as a secondary detail instead of height-based menu labels.
- Adaptive HLS playback now uses Jellyfin's `/Videos/{id}/master.m3u8` playlist shape, with variant playlists advertised as `hls/{quality}/stream.m3u8`, so the player and future Jellyfin-style clients follow the same master-playlist path.
- Adaptive HLS auto selection now starts with hls.js' normal bandwidth logic and no longer caps choices to the rendered player size, allowing capable clients to climb beyond 720p.
- Playback settings now expose the HLS transcoder profile and ffmpeg path controls, so advanced installs can switch encoder backends without editing environment variables.
- Adaptive HLS can now try native ffmpeg encoder profiles such as Apple VideoToolbox and Linux VA-API from Settings, with software x264 kept as the reliable default and fallback.
- Video playback now exposes the first Jellyfin-compatible endpoints for PlaybackInfo negotiation, root-level video streaming, master HLS playlists, HLS segments, session progress, played-state updates, and image-playlist trickplay. This is the first breaking-media-pipeline slice and prepares clients to move away from Obscura-specific playback routes.
- Video probes now populate a Jellyfin-shaped media source and stream model in the .NET database. Existing generated playback assets should be regenerated by rescanning so playback negotiation can use the richer source metadata.
- Trickplay generation now writes Jellyfin-style tiled JPEG sheets and playlist metadata instead of producing Obscura-specific sprite VTT files. A rescan regenerates the new trickplay assets for existing videos.
- The Svelte video player now negotiates playback through Jellyfin-compatible PlaybackInfo, reports progress through Jellyfin session endpoints, and reads `#EXT-X-IMAGES-ONLY` trickplay playlists for scrubbing.
- The unified production image now runs the .NET API and .NET worker directly instead of the legacy Node worker/SvelteKit server path.
- V2 video playback now falls back to direct streaming when adaptive HLS is not ready, and subtitle transcripts load from v2 subtitle assets instead of the removed v1 API routes.
- V2 video pages no longer break the .NET debug session when the browser cancels duplicate stream probes during playback startup.
- V2 video playback now starts an adaptive HLS package when a non-browser-native source, such as MKV, has no cached manifest yet.
- V2 adaptive video streams now expose a full VOD timeline immediately, so playback can keep buffering and users can scrub before the entire source has been transcoded.
- V2 subtitle playback now reads tracks through video subtitle API routes, so migrated subtitle files with absolute cache paths can still render in the player and transcript.
- Local v2 development now serves the live Svelte app through Vite again, so player fixes and route changes appear immediately instead of using a stale production build.
- V2 upgrade consent now persists in the database, so restarting the dev backend no longer re-opens the upgrade prompt or re-runs the destructive fresh-start reset.
- V2 fresh-start migration now records completion, treats repeat prepare requests as already handled, and re-arms the dev gate without immediately wiping v2 tables.
- Local dev refreshes now keep lowercase app pages such as `/videos` on the Svelte router while preserving uppercase Jellyfin-compatible playback routes such as `/Videos/{id}/stream`.
- Video thumbnails now use Jellyfin image-playlist trickplay maps for hover previews after scans generate tiled JPEG sheets.
- V2 rescans now repair missing Jellyfin media-source and trickplay records, so migrated videos can populate playback metadata and hover previews after the media-pipeline replacement.
- V2 adaptive HLS playlists now point at the public Jellyfin-compatible `/Videos/{id}/hls/...` route, fixing variant playlist 404s during playback.
- V2 adaptive playback now advertises generated Jellyfin trickplay image playlists from the HLS master manifest and stops guessing a fixed trickplay width in the player, preventing scrubber 404s when generated assets use a different size.
- V2 adaptive playback now lets the browser buffer as much of a video as it can, and thumbnail hover previews show the first trickplay frame as soon as the pointer enters a card.
- Direct video playback now answers browser media probes and automatically falls back to adaptive HLS when the direct stream cannot reach playback readiness.
- Adaptive HLS playback now uses larger practical buffer limits without disabling browser quota recovery, reducing repeated player error logs during playback.
- Local trickplay generation now writes real Jellyfin tile sheets in the shared dev cache, so rescans can advertise thumbnail hover previews instead of leaving empty `Trickplay/320` folders behind.
- Library scans now enqueue trickplay generation whenever trickplay is enabled, even if thumbnail preview generation is disabled.
- Video player controls now give visible hover/click feedback, caption enablement opens the transcript sidecar, settings use a stable mobile sheet and desktop in-video drawer, and Cast preloads the Google sender framework before opening the device picker.
- Video seekbar hover previews now show the matching trickplay thumbnail frame, so scrubbing from the main controls is easier without opening the full filmstrip.
- Video markers now seek reliably from both the main timeline and filmstrip, and fullscreen playback uses the full screen with controls overlayed on top of the video.
- Concurrent video playback requests no longer crash the backend when they refresh the same virtual HLS cache at the same time.
- Virtual adaptive HLS now generates each rendition as one continuous ffmpeg HLS stream, preventing periodic audio crackles from independently encoded AAC segments.
- Adaptive HLS playback now honors the source file's default audio track and exposes alternate audio tracks in the player menu, preventing multi-language videos from starting on the wrong language.
- Playback settings now include preferred audio languages, so multi-audio videos can start in the user's chosen language when a matching stream is available.
- Legacy v1 server code has been removed: Obscura now treats the .NET API, EF Core persistence, and .NET worker as the only server/runtime path. Any remaining frontend imports of v1 helpers now surface as build failures so they can be migrated deliberately.
- Video detail pages now load again after the v1 server removal, with root layout helpers, search, and playlist UI moved onto non-v1 frontend helpers backed by the .NET API.
- Browse pages and the plugins page now avoid deleted v1 frontend imports during route analysis, so navigation no longer trips Vite overlays from removed pagination or scraper helper files.
- Clicking the video player no longer leaves a blue browser focus outline around the playback surface.
- Virtual HLS now publishes generated segments atomically and refreshes older segment caches, preventing content-length crashes when users scrub past buffered playback.
- Scrubbing beyond the current buffer now starts virtual HLS generation at the requested segment and continues forward, restoring responsive long-distance seeks without waiting for earlier segments.
- Scrubbing far ahead while a video is still generating now starts a seek-local HLS transcode instead of waiting for the initial playback transcode to catch up.
- Scrubbing around partially generated adaptive video now cancels stale same-rendition transcodes and restarts work near the requested segment, and HD sources now advertise 1080p, 720p, and 480p adaptive levels.
- Adaptive playback now starts cold streams at the lowest rendition and cancels stale cross-quality transcodes when users jump outside the buffer, preventing multiple ffmpeg workers from piling up during scrubbing.
- Entity list API requests with an unknown `kind` now return a normal bad-request response instead of tripping the dev debugger during route binding.
- Video scrubber interactions no longer make the play button show a pause state unless playback actually starts.
- Subtitle style controls now use consistent sharp menu rows and squared sliders in both the player and Settings page, with compact language-code text that no longer overpowers subtitle settings.
- Local dev navigation now ignores browser-aborted backend requests, preventing canceled list loads during refresh/navigation from breaking the .NET debug session.
- Video detail pages now use the shared page padding without adding a second inset around the player, giving playback more room while matching browse-page spacing.
- Scheduled v2 library scans now target the intended watched folder instead of falling back to all eligible roots, and configured static web builds are served directly even in development/test hosts.
- Entity detail descriptions now render markdown through a sanitized v2 helper, preserving formatting while stripping unsafe HTML and script URLs.
- Videos now track playback state on the v2 backend — play count, accumulated watch time, and resume position are persisted per entity. Navigating back to a video resumes from where you left off, and the position is updated every 10 seconds during playback.
- Every entity type now has a dedicated detail page using the v2 entity API — videos, series, galleries, images, books, audio libraries, performers, studios, tags, and collections all render through the shared `EntityDetail` component with kind-specific sections (credits, reading progress, track lists, bio details) composed via snippet slots. The temporary `/v2/` route prefix has been removed; all detail pages now live at their canonical paths (e.g. `/videos/{id}`, `/performers/{id}`).
- All browse pages and the dashboard link directly to detail pages via a centralized entity route registry that mirrors the backend hierarchy definitions.
- All browse pages (Images, Galleries, Books, Audio, Series, Actors, Studios, Tags, Collections) now use the shared `EntityGrid` component backed by the v2 .NET entity API, replacing the legacy `MediaSurface` v1 pattern with consistent search, sort, filter, and grid/list controls across every media type.
- The Dashboard now loads from the v2 entity API and displays horizontal scroll rows for each content type that has items, replacing the broken v1 server-side rendering that showed a black screen.
- The v1-to-v2 upgrade now preserves all existing metadata instead of forcing a full rescan. Technical metadata, fingerprints, playback history, subtitles, markers, and all taxonomy relationships are migrated automatically. Generated cache assets (thumbnails, previews, trickplay sprites) are purged and regenerated by the first library rescan.
- Library scanning is now 7% faster end-to-end than v1 (104s vs 112s wall time on an 11-file test library). Individual job types are dramatically faster: probes 11×, fingerprints 3.9×, subtitles 3.1×, preview+trickplay 1.2×. Total CPU work dropped 51% (385s vs 793s sequential sum).

### Added
- V2 plugin credentials now resolve legacy provider key aliases such as `TMDB_API_KEY`, preserving saved API keys while still allowing users to edit the new v2 credential fields.
- The Plugins page now lists v2 dotnet-process community plugins from local discovery and supports install, remove, and credential configuration through the new .NET plugin endpoints.
- Video and series detail headers now include a v2 Identify action that opens provider selection, review field toggles, candidate switching, artwork selection, and selected-field apply without using the removed v1 plugin stack.
- V2 identify frontend API helpers and review UI now call the .NET plugin endpoints for provider discovery, single identify, bulk identify sessions, candidate re-runs, selected-field apply, and selected artwork apply.
- V2 plugin management and identify endpoints now support local dotnet-process plugin discovery, v2 manifest compatibility gating, provider install/remove, credential storage, single-entity identify, apply, and transient bulk identify sessions.
- V2 metadata apply service now writes selected identify proposal fields into entity capability rows, including provider IDs, taxonomy links, dates, counters, stats, classifications, and selected artwork assets.
- V2 plugin protocol contracts and ID-first provider match-hint resolution, preparing metadata identify to prefer stored provider IDs before URL or title search fallbacks.
- Season detail API responses now include ordered episode cards from the series → season → episode hierarchy, giving the Svelte season page real structured data.
- V2 entity marker write endpoints now support creating, updating, and deleting timeline markers while returning the refreshed entity projection.
- `EntityDetail` tabs now support optional Lucide icons and section mappings, so pages can place core sections and custom snippets on any tab without owning the tab chrome.
- `EntityDetail` now supports route-provided detail tabs with custom Svelte snippet content, while preserving the built-in details body for shared entity pages.
- `EntityThumbnail` now accepts a named subtitle snippet so each entity surface can render custom secondary content, such as video detail chips or person role labels, without forking the card.
- `OverflowTicker` provides a reusable measured text label for constrained UI areas that need ellipsis by default and a hover/focus ticker for long values.
- Credits API responses now include role and character metadata alongside the existing compatibility people list, allowing actor cards to show character-specific subtitles.
- VS Code Run and Debug now includes `Obscura: Kill Orphans`, a launch entry that runs `pnpm dev:kill` from the workspace.
- Playback Settings now include HLS transcoder controls for software, auto, VideoToolbox, VA-API, NVENC, and QSV profiles, plus ffmpeg executable and VA-API device overrides.
- Adaptive HLS transcoder settings: `OBSCURA_HLS_TRANSCODER`, `OBSCURA_FFMPEG_PATH`, and `OBSCURA_VAAPI_DEVICE` let advanced installs opt into software, auto, VideoToolbox, VA-API, NVENC, or QSV ffmpeg encoder profiles.
- `media_sources`, `media_streams`, and `trickplay_infos` v2 tables for Jellyfin-style media source negotiation, stream metadata, and image-playlist trickplay persistence.
- Jellyfin-shaped playback contracts and .NET service seams for media sources, media streams, playback sessions, active transcode cancellation, and HLS image-playlist trickplay.
- Public Jellyfin-compatible routes: `GET/POST /Items/{itemId}/PlaybackInfo`, `GET /Videos/{itemId}/stream`, `GET /Videos/{itemId}/master.m3u8`, `GET /Videos/{itemId}/hls/{playlistId}/{segmentId}.{container}`, `DELETE /Videos/ActiveEncodings`, `GET /Videos/{itemId}/Trickplay/{width}/tiles.m3u8`, `GET /Videos/{itemId}/Trickplay/{width}/{index}.jpg`, `POST /Sessions/Playing`, `POST /Sessions/Playing/Progress`, `POST /Sessions/Playing/Ping`, `POST /Sessions/Playing/Stopped`, and `POST/DELETE /UserPlayedItems/{itemId}`.
- `PATCH /api/entities/{id}/playback` endpoint — updates resume position, accumulated play duration, and completion state for any media entity. Follows the same pattern as rating and flags mutations.
- `PlaybackCapability` contract and JSON discriminator (`"playback"`) — the playback capability is now serialized to API responses so clients can read resume position, play count, and completion status from the entity card.
- `HEAD /api/videos/{id}/stream` — returns Content-Type, Content-Length, and Accept-Ranges headers without opening a file stream, fixing the 500 error that occurred when players probed the stream endpoint.
- `v2AssetUrl` helper in `orval-fetch.ts` for resolving `/assets/...` paths served by the .NET backend.
- `video-capabilities.ts` — maps v2 entity capabilities to flat VideoPlayer props (HLS, direct stream, trickplay, subtitles, markers, duration) and extracts playback state for resume-from-position.
- V2 video detail page now uses the full production VideoPlayer with subtitles, trickplay, transcript dock, library settings, and playback tracking — replacing the v1 `recordVideoPlay` call with native v2 playback state.
- Entity route registry (`entity-routes.ts`) — centralized mapping from entity kind + ID to URL path, mirroring the backend hierarchy. `resolveEntityHref()` replaces hardcoded route strings across all browse pages, the dashboard, and detail pages.
- Detail pages for all entity types now live at their canonical routes (`/videos/[id]`, `/galleries/[id]`, `/images/[id]`, `/books/[id]`, `/audio/[id]`, `/performers/[id]`, `/studios/[id]`, `/tags/[id]`, `/collections/[id]`). Each uses the shared `EntityDetail` component with kind-specific snippets for credits, reading progress, track grids, bio details, and related content.
- API fetch wrappers for all entity detail types (`fetchV2Image`, `fetchV2Gallery`, `fetchV2Book`, `fetchV2AudioLibrary`, `fetchV2AudioTrack`, `fetchV2Person`, `fetchV2Studio`, `fetchV2Tag`, `fetchV2Collection`) and taxonomy list endpoints (`fetchV2People`, `fetchV2Studios`, `fetchV2Tags`, `fetchV2Collections`).
- Series detail page (`/series/[id]`) now uses the shared `EntityDetail` component with hero imagery, rating, flags, description, tags, cast credits, and external links, plus `EntityGrid` sections for seasons, sub-series, and loose episodes.
- Season detail page (`/series/[id]/seasons/[seasonId]`) — shows season metadata via `EntityDetail` with parent series breadcrumb, season number badge, and date information. Episode grid is wired but pending a dedicated backend endpoint.
- `withFlagCapability` helper in `capabilities.ts` for optimistic flag toggle updates (favorite, organized, NSFW) on entity detail pages.
- `EntityDetail` component — capability-driven detail view that renders hero/poster images, markdown descriptions, interactive star rating, flag badges, tags, links, and files as universal sections shared by every entity kind. Kind-specific content (studio, credits, stats, technical, markers, etc.) is injected via Svelte 5 snippet slots, letting each entity page customize the detail surface without modifying the base component.
- Entity Detail Lab now renders the `EntityDetail` component with rich fixture data across 8 entity kinds (video, series, gallery, person, book, audio, studio, collection), each exercising different capability combinations.
- `marked` library for rendering markdown in entity descriptions — plain text passes through unchanged, but descriptions can now include bold, italic, lists, blockquotes, links, and code formatting.
- Detail Lab "Base" tab — shows all shared capability sections with interactive controls for hero image toggle, poster size selector (none/small/medium/large), and per-section visibility chips for rapid iteration on the core detail surface layout.

### Changed
- Series detail headers now spell out the aired date, season count, and total episode count instead of showing a generic item count.
- EntityDetail now treats migrated `backdrop` artwork as the hero/header image while keeping `poster` artwork in the poster slot.
- Series detail headers now show date and item count only; studios live in the Cast and Crew section and rendering-mode badges are no longer shown.
- Season detail pages now put links and files in a metadata tab, matching the series detail layout.
- Series detail routes now render season posters as a horizontal row and use the shared entity grid's new position sort for episode ordering.
- Video player hover previews now derive chapter labels from marker chapter ranges instead of only showing labels near marker points.
- Video timeline markers now feed VidStack chapter tracks, including marker end times when present, so the scrub bar can render sectioned marker ranges natively.
- The video detail Markers tab now uses the shared marker editor against v2 entity marker APIs, restoring marker creation and inline editing without the removed v1 video routes.
- Video detail tabs now declare reusable detail sections for description, credits, metadata, markers, transcripts, links, and files instead of rendering entire custom tab panels in the route.
- Video detail pages now define Details, Metadata, Markers, Transcript, and Files panels through the shared `EntityDetail` tab API.
- `OverflowTicker` now supports shrink-to-fit behavior before scrolling, and entity thumbnail imagery now defaults to cover fitting so artwork fills its card without black bars.
- Centered overflow tickers now keep overflowing text readable from the leading edge instead of clipping from a centered oversized line.
- Person thumbnails now use a wider 4:5 portrait frame by default, giving names more room while keeping people cards distinct from video posters.
- Video Cast and Crew rows now use compact centered thumbnail cards with route-provided role subtitle content.
- Entity thumbnail titles now use a smaller default type size and expose left, center, or right alignment for callers that need card-specific title placement.
- Entity thumbnail titles now use the shared overflow ticker instead of their older custom ticker, so narrow poster cards scroll long names with the same behavior as other shell labels.
- Canvas header breadcrumbs now use the shared overflow ticker and collapse to a single current label on mobile, with previous linked crumbs available from the `...` menu.
- Shared `EntityThumbnail` cards now resolve their own default entity links and support subtitles, so referenced entities can navigate consistently from any page.
- App-shell breadcrumbs now support configurable inline limits, so longer trails collapse earlier behind the clickable overflow menu while short trails stay readable.
- Video Cast and Crew sections now use shared `EntityThumbnail` cards in mobile-safe horizontal rows instead of compact text chips.
- Video detail pages now opt into the shared `EntityDetail` no-poster mode instead of showing a thumbnail inside the detail hero.
- The transcript panel now shows its line count as small helper text under the header instead of squeezing it into the title row.
- Adaptive HLS master playlists and player quality menus now use Jellyfin's bitrate-oriented quality ladder, preserving native output when appropriate while showing current/native dimensions only in the playback status chip.
- The video player now leaves HLS startup quality and viewport-size capping to hls.js instead of forcing the lowest rendition on auto playback.
- The workspace now depends on the .NET backend for server, database, and worker behavior; Svelte is a frontend-only app served by the .NET host.
- `EntityDetail` hero actions now render below the title, metadata, and rating controls, keeping the title stack visually grounded on detail pages.
- Production Docker startup now serves the built Svelte app through the .NET API host and starts `Obscura.Worker.dll` for background jobs.
- The video detail page now opens root-level Jellyfin-compatible `/Videos` and `/Sessions` routes for playback instead of the old Obscura-specific `/api/videos/{id}/hls/master.m3u8` and `PATCH /api/entities/{id}/playback` flow.
- The .NET preview worker now stores trickplay assets under the Jellyfin-style tile directory and records `trickplay_infos` metadata for image-only HLS playlists.
- Adaptive HLS master manifests now include Jellyfin-style `#EXT-X-IMAGE-STREAM-INF` entries for generated trickplay resolutions.
- The development SPA proxy now treats Jellyfin-compatible root routes as backend API traffic, so `/Items`, `/Videos`, `/Sessions`, and `/UserPlayedItems` are not forwarded to Vite.
- Shared v2 entity UI now centralizes entity kind, capability, file-role, label, and route codes in typed frontend registries instead of spreading raw string checks through `EntityThumbnail`, `EntityGrid`, and `EntityDetail`.
- All entity detail pages consolidated from temporary `/v2/` staging routes to canonical paths (`/videos/[id]`, `/series/[id]`, `/galleries/[id]`, etc.) — the entity route registry now resolves directly to standard routes, fixing back-navigation that previously landed on the old v2 test page.
- Sidebar footer link now points to the dev tools hub (`/dev/v2-migration`) with migration controls, gate management, and quick links to design system, thumbnail lab, and detail lab.
- Thumbnail Lab and Detail Lab moved from `/v2/` staging routes to `/dev/thumbnail-lab` and `/dev/detail-lab` alongside the other dev tools.
- Dev stack unified to a single port (8008) — the .NET API now serves everything on 8008 in both dev and production. In development, a SPA proxy middleware forwards page and asset requests to the Vite dev server on 5173 for HMR, while API and cache-asset routes are handled directly by .NET. No more hardcoded port hacks in the client, no more Vite-to-.NET proxy hops for API calls. VS Code "Full Stack" launch starts Postgres, Vite (background HMR), .NET API, and Worker in one action.
- `EntityDetail` hero now uses a two-zone layout: the sharp banner at the top fades into a vertically-flipped reflection that serves as the content zone background. The reflection uses direct `filter: blur()` on a scaled-up image for smooth color extraction without pixelation, a top-edge mask gradient for seamless blending into the banner, SVG feTurbulence noise grain to break color banding, and a tinted scrim for readability. Poster-blur mode (no banner) fits tightly to content with a smooth 64px blur across the full backdrop. Gradient mode collapses to a compact layout with no reserved image space.
- Detail Lab fixture data now uses real Pete the Cat images (poster + banner) to demonstrate the hero blur effect with vivid colors. "Hero Source" control lets you toggle between banner, poster-blur, and gradient modes.
- .NET API `launchSettings.json` now defaults to port 8010 instead of 8008 — prevents the .NET web host from shadowing the Vite dev server when both run in local dev mode.
- `EntityDetail` hero area now shows an inline metadata row (studio · date · count) and rating stars directly in the hero overlay, matching the established series detail layout.
- Credits section now renders as a horizontal scroll row of `EntityThumbnail` cards instead of a flat text grid, making referenced entities (performers, studios) visually consistent with the rest of the app.
- `EntityDetailCredit` model now includes a `thumbnail` field for displaying entity images in credit cards.
- Dev hub (`/dev/v2-migration`) now links to Thumbnail Lab and the new Detail Lab for quick access to all v2 testing surfaces.
- Entity Detail Lab page (`/v2/detail-lab`) — shell testing surface for the upcoming `EntityDetail` component.
- `pnpm dev:kill` script and VS Code task ("Obscura: Kill Orphans") to kill orphaned dev processes (.NET API/Worker, Vite, Docusaurus) and free dev ports (8008, 8010, 3010, 5173).
- Job processing pipeline now includes per-phase timing instrumentation (`JobPhaseTimer`) — every scan, probe, fingerprint, and preview job logs structured `[METRICS]` lines with per-phase durations for performance analysis.
- Library scan now uses batch entity upserts and batch downstream-needs checks, reducing per-file database round-trips from ~12 to ~2. Downstream jobs are enqueued in batch with a single database write per chunk.
- Trickplay extraction now uses per-frame keyframe seeking (`-skip_frame nokey` + input-seek) with 8-way concurrency and fixed 320×180 output, matching v1's proven approach. The previous fps-filter and segment-based approaches decoded the entire video; keyframe seeking decodes only one frame per extraction — orders of magnitude faster for 4K HEVC content.
- Job queue now supports batch enqueue (`EnqueueBatchAsync`) with built-in deduplication against pending jobs in a single query.
- Downstream jobs now use priority-based claiming: probes run first (priority 30), then fingerprints/subtitles (20), then preview generation (10), ensuring probes complete before preview jobs that depend on their technical metadata.
- Entity files now track a `source` column (`scan` or `custom`) so scan jobs never overwrite user-uploaded custom assets. The v1 `-custom` filename convention is detected during legacy migration and recorded in the database.
- Videos page now sends the client NSFW visibility mode to the backend, so switching between Off / Blur / Show re-fetches the list with server-side filtering instead of relying on client-only blur.
- All v2 EntityGrid browse pages now participate in SvelteKit's snapshot system — search query, active filters, sort order, view mode, and selection are preserved on back/forward navigation.

### Changed
- Design-language page no longer renders the legacy `MediaCard` component — the old v1 card section has been removed since all browse surfaces now use `EntityThumbnail`.
- Trickplay frames now render at fixed small dimensions (320×180 max, scaling down with quality setting) instead of using source resolution. The previous ScaleWidth formula with quality=1 produced full 3840×1920 frames for 4K content — 144× more pixels than needed for scrubber previews.
- The v2 upgrade gate dev-mode re-arm now performs a full v2 data reset — truncates all v2 tables and purges cache directories — so the next migration test starts from a completely clean slate with no stale entities, files, or generated assets.
- The v2 upgrade gate now warns that generated cache assets will be deleted and recommends backing up the data directory before proceeding. Stale v1 cache directories are purged during migration to free disk space.
- The v2 upgrade gate now runs legacy video and media imports as part of the fresh-start preparation, so all v1 data flows into v2 tables during the upgrade instead of requiring a full library rescan.
- All browse pages now use the shared `EntityGrid` and `EntityThumbnail` components backed by the v2 .NET entity API, providing built-in search, sort, filter, kind tabs, and grid/list view toggle.
- The Dashboard now fetches recent items from each entity kind via the v2 API and renders horizontal scroll rows with `EntityThumbnail` cards, with NSFW-aware filtering and empty-library state.
- All browse pages and the dashboard now resolve entity links through the centralized route registry instead of hardcoded URL patterns, ensuring thumbnails link to v2 detail pages.
- Video detail page (`/v2/videos/[id]`) rewritten to use `EntityDetail` with video player, hero metadata (studio, dates), cast credits section, and full capability rendering — replacing the earlier prototype.

### Fixed
- The Plugins page now loads v2 community providers even when removed v1 scraper routes are unavailable, so TMDB appears in the Obscura Community tab instead of showing a raw `not_found` error.
- Season detail pages no longer promote poster artwork into the full-width header when no explicit header/backdrop image exists.
- Migrated series and season artwork now survives fresh-start cache cleanup, and missing artwork files are restored from source-folder images such as `poster.jpg`, `banner.jpg`, `clearlogo.png`, and `season01-poster.jpg`.
- Legacy TV seasons now migrate from the `video_seasons` table before falling back to episode-derived season folders, and custom legacy artwork is no longer purged during fresh-start cleanup.
- Series detail pages now render cast through the shared `EntityThumbnail` surface and move links/files into a metadata tab so the main details tab stays focused on user-facing information.
- Series and season detail pages now let the shared app layout own outer spacing, removing the doubled padding around the main content area.
- Video detail cast thumbnails now show the stored character/role text directly instead of adding a redundant "Character" prefix.
- The desktop sidebar now stays above page-level media controls when it expands on hover, preventing video scrub bars from drawing across the navigation drawer.
- Entity detail tag chips now link to their actual tag detail pages using tag entity IDs from the shared tag capability.
- TV-style series scans and v1 video imports now create `video-season` entities plus series → season and season → episode links, while reusing migrated series IDs and metadata instead of duplicating or flattening the graph.
- The desktop sidebar collapsed state now hydrates from the existing browser cookie before the root layout renders.
- Video player posters no longer stack under the active video after the chapter timeline mounts inside VidStack.
- Video player marker chips now opt back into pointer events inside the controls overlay, so clicking a chip seeks to that marker instead of doing nothing.
- Video player markers now remain clickable instead of being swallowed by scrub gestures, filmstrip marker labels seek directly, and fullscreen playback no longer keeps the normal-view control spacing around the video.
- Adaptive HLS no longer reuses an early active rendition generation for far-ahead segment requests unless that exact segment has already been produced.
- Adaptive HLS now stops obsolete same-rendition ffmpeg processes when a far seek starts a replacement generation, preventing old buffer work from starving the requested seek.
- Adaptive HLS now stops obsolete same-video/audio ffmpeg work across all renditions when a far seek starts a replacement generation, preventing 1080p, 720p, and 480p transcodes from competing after ABR switches or scrubs.
- Stopping playback sessions and deleting active encodings now cancels active virtual HLS generation work instead of only clearing the session registry.
- Adaptive HLS master playlists are now emitted lowest-to-highest quality and hls.js starts cold playback at the lowest level, reducing initial CPU pressure before ABR has enough buffer to climb.
- Entity list kind validation now happens inside the endpoint, so invalid values such as `videos` produce an `invalid_entity_kind` API problem without throwing a minimal-API binder exception.
- Adaptive HLS master playlists now include multiple renditions for HD sources so Auto quality and manual quality selection have real levels to choose from.
- Scrubbing the video progress bar no longer routes `seeked` events through the playback-start handler, keeping the play button state accurate.
- Search and Identify routes no longer import removed v1 frontend modules, avoiding Vite overlays when navigating through the v2 shell.
- Video player focus styling no longer shows the native browser outline on the media surface after mouse/touch interaction.
- Browse route preloads no longer open Vite overlays from deleted v1 infinite-load, pagination, and scraper helper imports.
- Video detail routes no longer return dev-server import errors from global Svelte imports of deleted v1 cache, playlist, command palette, and search-result helpers.
- V2 adaptive playback no longer caps the hls.js forward/back buffer at two minutes or 60 MB, allowing long videos to continue prebuffering when the browser has capacity.
- Video seekbar hover popups now render the trickplay frame for the hovered timestamp when a video has generated trickplay assets.
- Virtual HLS cache refreshes are now serialized per video, preventing simultaneous playback requests from racing during stale cache directory deletion.
- Virtual HLS segment playlists now use exact target durations and six-decimal `EXTINF` values, and generated segments come from a single continuous HLS muxer instead of per-segment AAC encodes.
- Virtual HLS segments are no longer served while ffmpeg is still writing them, avoiding `Content-Length` mismatch crashes during aggressive scrubbing.
- Virtual HLS far-ahead segment requests now generate from the requested segment and return a clean miss instead of crashing if ffmpeg completes without the requested segment.
- Adaptive HLS audio selection now maps ffmpeg by the source stream index and keeps separate virtual caches per selected audio track, so alternate-language tracks can be selected without leaking the wrong audio into another session.
- Adaptive HLS now uses the preferred audio language before falling back to the source default, including best-guess matching from stream titles when a track has no language code.
- Far-ahead HLS seeks now preroll generation by one segment, preventing playback from freezing when ffmpeg starts emitting segments just after the requested seek segment.
- Direct playback no longer stalls the player when Vidstack/browser probes fail before `can-play`. The Jellyfin-compatible stream route now supports `HEAD`, and the player switches to adaptive HLS instead of leaving playback paused.
- HLS playback no longer spams repeated Vidstack errors after startup. The player keeps extended forward buffering, HLS asset routes now answer media `HEAD` probes, and hls.js can reduce its buffer target when the browser hits its media quota.
- The playlist session compatibility endpoint now returns JSON `null` when no session is stored, preventing the Svelte shell from logging an empty-response parse error.
- Thumbnail trickplay hover previews now activate on pointer entry and keyboard focus, so generated Jellyfin image playlists produce visible card previews without requiring an extra mouse move.
- Local .NET API and worker launches now resolve the same `apps/backend/data` cache root, trickplay tile composition now feeds ffmpeg absolute frame paths so tile sheets are actually written after frame extraction, and failed trickplay composition now fails the preview job instead of appearing complete.
- The V2 player now uses advertised trickplay asset paths and leaves the filmstrip disabled until trickplay exists, avoiding hardcoded `/Trickplay/320` requests.
- Jellyfin-compatible trickplay playlist and tile routes now fall back to the nearest generated width when a client asks for a width that was not produced by the current quality setting.
- V2 video pages no longer block forever on a missing HLS status route. The player now only uses the legacy readiness probe for legacy `hls2` URLs, attaches v2 manifests directly, and falls back to direct streaming when adaptive playback fails.
- V2 video stream probes now tolerate browser-canceled HEAD requests, avoiding debugger-breaking cancellation exceptions during player initialization.
- V2 video pages no longer try direct playback for Matroska sources, preventing the player from choosing a stream the backend correctly rejects with 415.
- V2 HLS playback no longer serves an unfinished ffmpeg playlist as the primary manifest. The API now returns VOD playlists with `#EXT-X-ENDLIST` and generates requested segments on demand, restoring seekable playback.
- V2 subtitle tracks no longer expose raw filesystem paths to the browser; the player now requests normalized WebVTT and preserved ASS/SSA sources through the .NET video API.
- The video Cast button now loads the Google Cast sender framework before requesting Cast and reports when the browser still cannot provide it.
- Subtitle style controls in the player and Settings page now use consistent menu rows and sharp square sliders instead of browser-default rounded sliders.
- Preferred subtitle language examples and inputs now use compact utility text so language codes like `en`, `eng`, and `en-US` do not overpower the Settings page.
- Turning captions on now opens the transcript sidecar automatically, restoring the docked transcript view without requiring a separate dock toggle first.
- Video captions, fullscreen, and Cast controls now rely on button feedback for successful clicks and only use the player notice chip for errors.
- The video player settings menu now renders above playback controls on mobile and as a semitransparent in-video drawer on desktop, with long caption labels wrapping instead of clipping.
- The captions control now uses the same square dimensions as the other video control buttons.
- Local .NET development no longer serves the stale `apps/web-svelte/build` bundle by default; page requests proxy to the running Vite dev server unless a static web root is explicitly configured.
- V2 subtitle display and transcript panels now read cue text from the normalized `/assets/...` WebVTT files exposed by the v2 subtitle capability, including ASS/SSA tracks that only have a generated VTT fallback.
- V2 data now persists across backend container/app restarts in dev Docker. The upgrade gate no longer depends only on `/data/upgrade-markers`, which was not mounted by the dev compose backend and could disappear while Postgres data remained.
- Video detail pages no longer add their own outer padding or centered width cap around the player surface.
- Re-running the v2 fresh-start prepare endpoint no longer backs up, truncates, and re-imports v2 data after a successful migration. The dev gate re-arm now only clears the consent/prepared markers; the destructive reset happens only when the migration prepare step is accepted.
- Refreshing `/videos` in local dev no longer returns the .NET JSON 404 caused by case-insensitive Jellyfin route matching.
- Trickplay hover previews now read `#EXT-X-IMAGES-ONLY` playlists from the v2 trickplay asset instead of only looking for legacy sprite VTT files.
- Browser-canceled v2 entity list requests no longer surface as unhandled `OperationCanceledException` failures while using the dev proxy.
- V2 scans now re-run probes when a legacy technical row exists without a Jellyfin media source, and re-run preview generation when thumbnails exist without trickplay tile metadata.
- V2 HLS master playlists now advertise `/hls/{playlistId}/stream.m3u8` variant URLs instead of private cache-relative paths that had no public route.
- V2 video playback no longer 404s when HLS clients resolve master-playlist variant URLs as `/Videos/{id}/v/{quality}/index.m3u8`, and trickplay-only scans now build tiled preview playlists without forcing thumbnail preview generation.
- The .NET API now handles the Svelte shell's playlist-session and update-check calls, removing 404 noise from video pages after the API host migration.
- Scheduled v2 scan jobs now share a typed scan-root payload with scan handlers, including compatibility for already queued `libraryRootId` payloads, so per-root auto scans no longer expand into all-root scans.
- Static SPA fallback now serves a configured web root without the development Vite proxy intercepting static assets or client-side routes.
- Entity detail markdown now removes unsafe HTML blocks, event handlers, and `javascript:`/`data:` URLs before Svelte renders the generated HTML.
- Video stream HEAD requests no longer return 500. The .NET backend now has an explicit HEAD handler that returns Content-Type, Content-Length, and Accept-Ranges headers without opening a file stream — fixing direct playback probe failures.
- Entity thumbnails in browse grids now navigate to detail pages when clicked. Previously, `selectable` mode caused cards to render as non-clickable `<article>` elements instead of `<a>` links — clicking did nothing. Cards now always render as links when an href is set; the selection checkbox remains independent via event propagation isolation.
- `EntityDetail` no longer causes horizontal page scroll on mobile — grid children now constrain their width to the viewport instead of blowing out the layout.

### Changed
- Detail Lab "Base" tab now shows only the 7 universal capabilities shared by every entity kind (images, description, rating, flags, tags, links, files), providing a clean foundation for the shared detail surface. Kind-specific sections (studio, credits, stats, technical, markers, subtitles, etc.) are exercised only in the "Examples" tab.
- `EntityDetail` now accepts Svelte 5 snippet slots (`heroMeta`, `heroBadges`, `extraFlags`, `afterBody`, `extraSections`) instead of rendering kind-specific sections internally. The base component handles only universal capabilities; calling pages compose additional content through snippets.
- `EntityDetailCard` type split into a universal base (`EntityDetailCard` with 7 shared fields) and an extended `EntityDetailCardFull` that adds kind-specific fields (studio, credits, stats, dates, technical, markers, subtitles, progress, positions, classification, sources, counters).
- Entity detail hero now shows actionable icon badges instead of a kind label chip — favorite (heart toggle with pop animation), NSFW (red flame, display-only), and organized (checkmark toggle with pop animation). Rating stars are interactive: tap to set, tap the current rating again to clear. All actions are wired to optimistic local state in the Detail Lab; real entity pages will call the backend PATCH endpoints.
- Video thumbnails and trickplay scrub previews now work correctly on fresh v2 installs. The .NET backend's `thumb.jpg` URL format is now recognized by the SvelteKit asset resolver, the .NET cache directory is searched alongside legacy paths, and trickplay hover uses the composite sprite sheet + VTT instead of fabricating individual frame URLs that never existed on disk. Existing videos need a preview re-run to generate the sprite sheet.
- Eliminated 404 spam for thumbnail and trickplay assets after v2 migration by adding a multi-layer safety net: the migration now purges any non-source entity_files after legacy import (catching stale compiled SQL), the backend omits the images capability entirely when no image assets exist, and the frontend only uses explicit cover/poster/thumbnail paths instead of falling back to arbitrary first items.
- Legacy import no longer creates entity_file rows for cache-generated assets (thumbnails, previews, sprites, trickplay, waveforms, posters, backdrops, logos). These files don't exist on disk after migration and caused 404 spam across all grid pages. A library rescan regenerates them correctly under the new entity IDs.
- Thumbnail hover preview now activates only when trickplay frames exist — entities without trickplay no longer attempt a broken hover swap on pointer move. When trickplay frame images fail to load (e.g. stale migration data), hover is disabled for that card instead of flickering between broken frames and the cover.
- SPA client-side navigation now works correctly — the `afterNavigate` callback in the root layout no longer crashes on the initial `'enter'` navigation when `from.url` is null, which was silently preventing the SvelteKit router from registering its click handler.
- NSFW visibility mode now persists across page loads — the cookie is read on app init instead of always defaulting to "off".
- The v2 upgrade gate consent overlay now appears on first boot when the gate is armed — previously the SPA layout never fetched gate status from the .NET backend, so the overlay never rendered.
- Legacy media import no longer fails on the `rule_tree` column type mismatch or on book read progress referencing chapter entities that haven't been imported yet.
- Video entity list no longer crashes on subtitle source codes `upload` and `sidecar` that were valid in v1 but missing from the v2 codec.
- Video resolution chips now display standardized labels like "1080p" and "4K" instead of raw "WidthxHeight" dimensions.
- Legacy v1 asset paths are now normalized to v2 standard format during migration — extensionless URLs like `/assets/videos/{id}/card` become `/assets/videos/{id}/thumb.jpg`, and the corresponding files on disk are renamed to match, so thumbnails, previews, and trickplay sprites serve correctly without middleware workarounds.
- The favicon now uses the full Obscura aperture logo instead of a plain circle-on-square. Added apple-touch-icon, 192px and 512px PNG icons, a web app manifest, and Safari/mobile home screen support with the correct Dark Room theme color.
- The Dashboard loading state now uses the brass ripple-ring route loader with the LogoMark instead of a plain CSS spinner, matching the Dark Room design language.
- The empty library state on the Dashboard now displays the full Obscura aperture logo instead of a generic film icon, since the library covers all media types.
- The design-language showcase page now covers the full token set — surface hierarchy, glass layers, accent scale, text colors, status colors, glow effects, loading animations, borders, and design principles — alongside all existing component demos. Linked from the Dev Tools page for easy access.
- Entity thumbnails now show a gradient placeholder with the entity-type icon when the cover image is missing or fails to load, instead of displaying broken image alt text.
- Generated thumbnails, previews, waveforms, and subtitles are now served via the `/assets/` HTTP route and stored as API-relative URLs — previously stored as disk paths that browsers could not resolve.
- Trickplay hover preview now expands VTT manifest paths into individual frame URLs based on video duration, so the scrub-preview image strip renders correctly on hover.
- Jobs dashboard now shows accurate queue backlog counts via server-side aggregate queries — previously capped at 200 due to the item list limit.
- Navigation between pages no longer causes a full-page reload flash. Removed legacy v1 server load files (`+page.server.ts`) that prevented SvelteKit's client-side router from intercepting link clicks.
- Library scan now propagates the NSFW flag from the library root to all child entities — images, audio libraries, audio tracks, book chapters, and book pages were previously missing the flag even when their parent library root was marked NSFW.

### Removed
- Removed the legacy SvelteKit `/api` route tree, `$lib/v1` server/client helpers, TypeScript worker app, Drizzle database package, and shared `@obscura/app-core` server package.
- Removed the obsolete `/api/videos/{id}/stream`, `/api/videos/{id}/hls/master.m3u8`, and `/api/videos/{id}/hls/{asset}` playback routes; Jellyfin-compatible `/Videos/...` routes now own playback.
- Removed the legacy Node worker service from the development Docker Compose stack.
- `/v2/` route tree — all 15 temporary staging pages (detail-lab, thumbnail-lab, entity detail pages, series browse) deleted after consolidation into canonical routes.
- `/dev/v2-migration` dev tools page — no longer needed now that all v2 surfaces are promoted to standard routes.

### Changed
- VS Code "Full Stack" launch now explicitly builds the .NET backend solution before launching, so the running processes always use freshly compiled code instead of relying on the dotnet launcher's implicit build. Build and test tasks now reference the correct `.slnx` solution format. The API launch config and `launchSettings.json` now both use port 8008 to match the SPA's expected backend address.
- VS Code launch and task configs now target the .NET backend — API, Worker, and compound "Full Stack" configs replace the old Node.js-era entries.
- Updated Claude Code preview launch config to use the .NET backend (`pnpm dev:app`) instead of the deprecated Vite dev server.

- The v2 library maintenance job now validates that expected cache assets exist on disk and removes orphaned cache directories for deleted entities, replacing the placeholder with real asset hygiene.
- The v2 dynamic collection refresh job now evaluates stored rule trees against the unified entity model, replacing dynamic membership atomically while preserving manual items — a full port of the Node.js collection rule engine to the .NET backend.
- The v2 .NET backend now has real implementations for all library scan, probe, fingerprint, preview, and subtitle extraction job handlers — replacing stubs with working processors that discover media files, create entities, compute hashes, generate thumbnails and previews, extract subtitles, and chain downstream jobs exactly like the Node.js predecessor.
- The v2 .NET job queue now supports all 20 media processing job types with concurrent worker processing, automatic scan scheduling, deduplication, progress reporting, job chaining, and history pruning — establishing the full infrastructure for migrating scan, probe, fingerprint, preview, and metadata processors.
- Obscura now has the first .NET backend foundation for the v2 migration, including a runnable health endpoint, shared entity contracts, and development wiring that can run beside the current app while the migration is built out.
- The v2 .NET backend now exposes the first stable API contract routes for entities, videos, jobs, and settings, giving the Svelte UI a typed surface to migrate toward.
- The v2 .NET backend now includes the first global entity database model, with shared rating, flag, tag-link, and video-detail tables isolated in a new `v2` schema.
- The Svelte app now has an initial typed v2 API client for the new .NET entity, video, job, and settings routes, preparing UI pages to migrate incrementally.
- The v2 .NET backend now exposes a file-marker upgrade consent gate for the global entity migration, so future migration execution can require explicit user approval first.
- The v2 schema now has fresh-start preservation tables for library settings, library roots, and database backup records, letting the migration reset media data while keeping scan configuration.
- The v2 .NET backend can now prepare a fresh-start migration by requiring upgrade consent, creating a pg_dump backup, resetting v2 media tables, and preserving the existing library settings and scan roots.
- The v2 .NET backend can now serve a configured static Svelte build with SPA fallback, preparing production to run without a Node server once UI routes are migrated.
- The v2 schema now includes a native Postgres job-run table for the future Obscura queue, with retry/progress/locking fields for worker coordination.
- The .NET backend now has a separate worker host that can run beside the API and is ready for v2 queue handlers as scan, probe, thumbnail, and HLS jobs move over.
- The v2 queue now has tested Postgres claim and retry SQL, including `FOR UPDATE SKIP LOCKED` coordination for multiple worker processes.
- The v2 jobs API now uses the native .NET queue service for listing and creating job runs instead of returning placeholder route-local responses.
- The v2 settings API now reads and updates the preserved .NET settings row, including an explicit hide-NSFW preference instead of placeholder defaults.
- The Svelte app can now generate its v2 API client from the .NET OpenAPI contract, reducing duplicate DTO definitions as the migration continues.
- The v2 .NET entity and video APIs now read projected data from the global entity schema, including shared ratings, tags, flags, and video-specific detail fields.
- The v2 .NET backend can now stream browser-playable video source files with HTTP range support from the new shared file capability table.
- The v2 .NET backend can now serve cached HLS manifests, variant playlists, and segments from the configured cache directory.
- The .NET worker now actively claims v2 queue jobs, dispatches registered handlers, and records completion or retryable failures.
- The Svelte app now includes a static v2 video browser that loads from the .NET entity API with skeleton, empty, error, cursor-prefetch, detail, playback, and rating states.
- The v2 .NET backend now has shared media-process helpers for detecting ffmpeg and ffprobe before probe, thumbnail, sprite, and HLS worker ports land.
- The v2 video browser now works during local Svelte development by calling the .NET backend directly and the .NET backend now applies EF migrations automatically on startup.
- The v2 .NET backend and Svelte UI now include side-by-side video-series routes, so `/v2/series` can be tested against the new global entity projection alongside `/v2/videos`.
- The v2 migration can now preview-import existing video and series metadata into the global entity tables, including tags, studios, ratings, source files, and series-to-episode links for side-by-side testing.
- The v2 video and series cards now receive imported thumbnail URLs through the shared file capability projection.
- The v2 video detail page now sends playback requests to the .NET backend during local Svelte development instead of falling back to the legacy SvelteKit API path.
- The v2 global entity model now imports and projects shared people and studio credit capabilities for videos and series.
- The v2 .NET backend now exposes first-class people, studio, and tag list/detail API routes backed by the global entity projection.
- The v2 .NET backend now exposes first-class image, gallery, book, audio-library, and audio-track media routes backed by the global entity projection.
- The v2 migration can now preview-import existing image, gallery, book, audio-library, and audio-track metadata into the global entity tables for backend comparison.
- The .NET worker can now run queued legacy video and media preview imports, so migration backfills can execute through the v2 job system as well as direct API calls.
- The v2 global entity model now preserves source URLs and external provider IDs across media types, so future detail pages can show provider links from one shared capability shape.
- The v2 .NET backend now exposes collection list/detail routes and imports legacy collection membership into shared entity links for backend comparison.
- The v2 video detail API now includes imported subtitle tracks and media markers, preparing the .NET backend for playback-detail parity with the current app.
- The v2 media detail APIs now return child entities for galleries and audio libraries, so imported gallery images and album tracks are visible through the shared projection.
- The v2 .NET contracts now use clean API model names without `Dto` suffixes, and the generated Svelte client follows those names directly.
- The v2 entity model now exposes shared capabilities as modular, typed capability items, making ratings, tags, artwork, links, flags, and files easier to extend across entity kinds.
- The v2 domain model now keeps typed media and taxonomy models as shared `Entity` extensions with self-declared capabilities and direct type-specific fields, so common surfaces such as thumbnails can accept one entity shape while detail screens can read fields without nested detail wrappers.
- The v2 entity projection now preserves richer shared capability data, including tag IDs, credit roles and characters, attached files, and playback state.
- The v2 .NET projection now hydrates typed image, gallery, book, audio, taxonomy, and collection aggregates from their detail tables, giving model work a tested persistence path before API migration.
- The v2 .NET model now carries richer video, series, season, volume, chapter, and page details as typed domain aggregates, closing the remaining structural hierarchy detail gaps.
- Migrated the video player to VidStack, using this as the core engine improves playback across browsers, also fixed some backend issues with hls and improper direct streaming, should have much more stable streaming behavior
- Create "Books" entry type, and moved comics/manga to that library type. To use, enable a library with books in the settings
- Uses SvelteKit snapshots on previously viewed pages for the grids, should allow you to pop into a entry, such as a video, then navigate back and preserve position in the scroll
- Mangadex added as a plugin in the community plugins
- Added update checker in app, so you can see when a new version is released
- Upgrades from older dev builds now complete even when duplicate legacy comic gallery rows point at the same ZIP or CBZ archive, preserving one migrated book and chapter while retiring the duplicate gallery records.
- Book and chapter detail pages now show saved comic reading progress as the current chapter plus page progress, making resume state easier to understand at a glance.
- Identify queues now focus on unorganized media by default, and accepted metadata results mark the item organized so future review sessions stay focused on unfinished entries.
- Comic archive folders that only wrap a same-named ZIP or CBZ now scan as loose comic chapters instead of creating an unexpected volume.
- Manga volume folders now stay named `Volume 01`, `Volume 02`, and so on even when provider metadata calls them `Volume 1`; the next book scan also repairs existing duplicated folders like `Volume 01 - Volume 1`.
- Comic reading now marks the current chapter complete when the end action appears, and the final chapter shows a clear no-next-chapter close action.
- Book scans now only create comic volumes from explicit volume subfolders, keeping loose chapter archives and chapter wrapper folders under the book itself.
- Completed comic chapters now show as Read instead of lingering as 100% progress, with Mark read and Re-read actions available from book, chapter, and volume views.
- Book and gallery scans now recover from stale image thumbnail and fingerprint jobs left behind by older gallery-to-Books migrations, so deleted legacy page rows no longer keep failing in the worker.
- Identify result messages are now easier to read and dismiss, with solid alert styling, a close button, and automatic timeout behavior.
- Media surfaces with filters now include Is NSFW and Not NSFW library-flag filters while still respecting the global hide-NSFW mode.
- The Job Control page is now denser and easier to scan: active jobs are grouped by queue type with a compact row layout, errors show individually with a Suppress button to hide repeated noise, completed jobs include their duration, and the overview replaces "Retained Done" with a Last Scan timestamp.
- Book thumbnails now keep user-selected cover art as the default and first preview image, falling back to the first page in volume or chapter order only when no custom cover exists.
- Book series pages now expose root cover upload/clear controls and rating controls again, so series artwork and ratings can be managed from the book itself.
- Book progress cards now resume the current chapter directly, and rated media thumbnails now show a star chip across rated entity types.
- Video series pages now have their full edit panel again, including metadata, rating, organized/NSFW state, cover art, and backdrop controls.
- Tags and Studios now browse through the shared library surface, so search, filters, sorting, thumbnail sizing, and bulk actions behave like the rest of the media library and scale better on larger collections.
- The v2 .NET backend now models seasons, book volumes, chapters, and pages as first-class hierarchy entities, giving future series and reader screens one shared way to load ordered child structure.
- The v2 .NET backend now preserves named video counters such as the legacy orgasm counter through the shared entity capability model.
- The v2 .NET backend now exposes shared descriptions, richer image asset metadata, and preserved video hashes so migrated entities keep more of their source metadata.
- The v2 .NET backend now declares a capability-first entity shape for the breaking migration, so shared metadata can move out of duplicated per-kind detail fields after users accept the v2 reset gate.
- The v2 .NET backend now hydrates typed entity details from shared capabilities first, reducing duplicated summary, date, source, count, progress, marker, subtitle, and technical fields across media types.
- The v2 .NET API contract now exposes the expanded capability union so generated clients can read markers, subtitles, stats, dates, source data, technical metadata, progress, positions, and classifications from one shared shape.
- The v2 .NET schema now has typed capability-first tables for stats, dates, technical metadata, source provenance, progress, positions, and classifications.
- The v2 .NET media and taxonomy detail APIs now return object-specific detail contracts, so generated clients receive gallery, book, audio, person, studio, and tag shapes without unrelated optional fields.
- The v2 .NET video and series detail APIs now keep shared metadata inside capabilities instead of duplicating description, technical, marker, and subtitle fields at the top level.
- The generated Svelte v2 API client now matches the capability-first .NET OpenAPI surface, and the v2 video and series detail pages read shared metadata through capability helpers.
- The generated Svelte v2 API client now reflects canonical hyphenated .NET entity kind codes in media endpoint summaries.
- The Svelte app now includes a v2 thumbnail lab that exercises one shared entity-card thumbnail path across every current entity kind before the main UI is rewired.
- The v2 thumbnail lab now shows denser rows, adjustable thumbnail scale, cleaner shared chips, and fit-within image rendering so card sizing can be tuned before the main UI migration.
- The v2 thumbnail lab now uses a media-first card layout with artwork on top and quieter attached details below, matching the intended thumbnail hierarchy before the broader UI migration.
- The v2 thumbnail lab now uses more realistic per-entity labels, including poster-shaped seasons and quieter page cards without redundant page metadata.
- The v2 thumbnail lab now keeps card heights consistent by reserving fixed title and metadata slots instead of letting wrapped titles stretch individual cards.
- The v2 thumbnail lab now shrinks long card titles within a readable range before truncating, keeping row heights even without oversized title slots.
- The v2 thumbnail lab now supports multi-select cards with a top-left checkbox that appears on hover, focus, or selected state.
- The v2 thumbnail lab now animates overflowing card titles on hover so users can read the full title without expanding the card.
- Overflowing v2 thumbnail titles now show a clearer brass ticker indicator and reliably measure the full title before starting the hover animation.
- V2 thumbnail title hover now uses a subtler overflow edge and keeps scrub handling inside the image area so title ticker hover is not intercepted.
- V2 thumbnail title hover no longer shows the browser tooltip, and compressed titles now move visibly when the ticker starts.
- V2 entity cards now use a canonical title plus capability-driven metadata instead of an unused global subtitle, keeping thumbnails aligned with the new backend data shape.
- V2 thumbnail chips now reserve the top-right and bottom-right corners for compact rating and icon-only NSFW badges, while page thumbnails render as image-only cards.
- The shared entity thumbnail is now the canonical thumbnail component, while legacy thumbnail components live under an explicit v1 namespace for migration review.
- Legacy Svelte API client helpers now live under an explicit v1 namespace so the canonical API folder is reserved for the .NET/Orval-backed v2 surface.
- Legacy Svelte server helpers now live under an explicit v1 namespace, making the old Drizzle-backed route support code easier to separate from v2 backend integration.
- Legacy Svelte media browsing surfaces now live under an explicit v1 namespace, making the remaining contract-backed grids, filters, tabs, and pagination easier to review during the v2 UI migration.
- Legacy identify and scrape review flows now live under an explicit v1 namespace, making old provider-result workflows distinct from the new capability-first UI work.
- The v2 thumbnail lab now uses the first shared Entity Grid surface, including the ported media-surface toolbar, capability filter drawer, presets, kind tabs, selection, scaling, NSFW visibility, and loading/empty/hydrated states.
- The v2 entity grid toolbar now uses a polished custom sort dropdown and single-row layout matching the v1 media surface, and the multi-select bulk bar now includes a Select All action. In stacked layout (laptop and below), sort controls anchor to the left while view, filter, and preset controls anchor to the right.
- List-view entity cards now keep consistent row height regardless of image aspect ratio — portrait, landscape, and square thumbnails all render at the same size without clipping the title or metadata chips.
- V2 entity lists now enforce the server-side hide-NSFW setting before entity rows are projected, so hidden content is not sent to the browser.
- V2 video and season thumbnails now reserve the bottom-left overlay for entity-specific labels such as season and episode numbers.
- Local development now has database backup and restore scripts for repeatedly testing v2 migration mappings against the same data set.
- Local development now has a sidebar-linked v2 migration control page for prompting the upgrade gate, creating backups, restoring a dump, and clearing v2 data before another import pass.
- The upgrade gate now reflects the v2 global entity migration, including backup and fresh-start preparation, instead of the older scenes-to-videos transition.
- Job Control now reads from and controls the v2 .NET job queue, giving the migration a real worker dashboard before media routes move over.
- Settings now read and save through the v2 .NET backend, including watched folders, generation preferences, playback defaults, subtitle preferences, and root-level scan flags.
- Obscura can now serve the Svelte app shell from the .NET backend on one local origin, making it clear that migrated routes are talking to Kestrel instead of the old Node server.
- The Settings diagnostics section now uses the v2 .NET backend for rebuild-previews and backfill-fingerprints instead of v1 proxy routes that stopped working in static builds.
- The Jobs dashboard now shows real auto-scan schedule info from the settings API instead of a hardcoded placeholder.
- The Dev Tools sidebar link is now always visible instead of only showing during SvelteKit dev-mode, so admin tools remain accessible when the app is served from the .NET backend.

### Docs

- Added a ready-for-review dev-stack rule to `AGENTS.md`, clarifying when Vite HMR is enough during iteration and requiring `pnpm dev:kill` plus the canonical full-stack launch before handoff.
- Added an `AGENTS.md` rule requiring layout and UI changes to start from shared base components, and to expose route-specific needs through reusable component customization points when possible.
- Added a local dev-stack restart rule to `AGENTS.md`: announce the reboot, run `pnpm dev:kill`, then relaunch the canonical VS Code `Obscura: Full Stack` compound instead of starting duplicate servers on alternate ports.
- Documented `@obscura/contracts` as a legacy migration bridge so old TypeScript DTOs are removed only after matching surfaces move to the .NET OpenAPI/Orval contract.
- Added the codebase rule for rich public documentation comments and documented the v2 .NET Domain, Application, and contract types so the new backend model is easier to read in C# tooling.
- Documented the intended .NET Domain/Application/Contracts boundary for the v2 backend so the C# model can grow as first-class application code instead of API DTO plumbing.
- Rewrote README and documentation site to reflect Obscura's broader media-home identity — books, comics, audio, video, and galleries are now all highlighted equally, the "Stash replacement" framing is dropped, and the doc-site homepage now serves as a product page non-technical visitors can understand.

### Added

- Added v2 .NET bulk job endpoints for rebuild-previews and backfill-fingerprints, queuing per-entity preview or fingerprint jobs in a single API call.

### Changed

- Organized the v2 .NET domain and contract entity-kind, codec, and capability files into relation-based folders so backend model types are easier to find without changing their public namespaces.
- Added typed v2 .NET domain models for people, studios, tags, galleries, images, audio libraries, and audio tracks so domain-specific state and mutators live beside each entity type instead of in generic services.
- Expanded the v2 .NET data model with typed domain-specific tables for taxonomy details, media details, playback/progress, provider identity, UI preferences, and richer book metadata while keeping shared capabilities on the global entity root.
- Replaced fixed-choice v2 .NET type, mode, role, source, and status strings with enums while preserving stable database/API text codes for OpenAPI and Orval clients.
- Split v2 .NET closed-set code handling into discoverable codec classes so new enum-backed codes can be added without editing one central switch file.
- Replaced raw v2 .NET entity-kind strings in application and infrastructure code with typed entity-kind and relationship registries, keeping string codes only at API, SQL, and database boundaries.
- Consolidated duplicate v2 .NET media grouping records into one generic entity-library aggregate so simple entity-plus-children shapes no longer pretend to be specialized domain types.
- Renamed the v2 .NET taxonomy kind and API route from performer to person/people so the backend stays generic while UI surfaces choose context-specific labels.
- Added scoped v2 .NET application services for entity, video/series, and collection use cases so API endpoints depend on application orchestration instead of projection interfaces directly.
- Moved v2 migration gate, fresh-start, and legacy import orchestration behind the .NET Application layer so API routes and worker handlers no longer depend on infrastructure migration ports directly.
- Moved v2 direct video streaming and cached HLS lookup ports into the .NET Application layer so API routes depend on playback use-case boundaries instead of infrastructure services.
- Moved the v2 queue worker dispatch loop and registered job handlers into the .NET Application layer so the worker executable now only composes application services and infrastructure adapters.
- Changed the v2 queue application boundary to use typed job snapshots and typed job creation values, keeping public job-code strings at the API serialization edge.
- Migrated the Job Control page to the v2 .NET jobs API for dashboard loading, job creation, cancellation, and failure clearing.
- Migrated the Settings page off SvelteKit server loaders so the route fetches the v2 .NET API directly from the UI during the backend handoff.
- Changed the web shell to build as a static SvelteKit app that the .NET API can serve with SPA fallback during the v2 route migration.
- Added a `dev:app` command that builds the static shell and runs the .NET-hosted app on port 8008 for local migration testing.
- Changed v2 entity kind filters and endpoint group helpers to carry typed entity kinds instead of parallel kind-code strings at API and Application boundaries.
- Removed one-to-one infrastructure service interfaces around media tool checks, process execution, process running, and database backups so concrete services carry behavior directly unless a real polymorphic contract exists.
- Split the v2 EF base entity table mapping out of the main DbContext so infrastructure persistence configuration is easier to review in focused files.
- Split the v2 EF entity graph mapping for hierarchy, studio, credits, URLs, and external IDs into a focused persistence configuration file.
- Split the v2 EF marker, subtitle, file, and video source detail mapping into a focused attachment persistence configuration file.
- Restructured the v2 .NET backend core so infrastructure now projects PostgreSQL rows into first-class Domain entities, capabilities, and media aggregates before API endpoints map them back to OpenAPI/Orval contracts.
- The v2 .NET backend now has an `Obscura.Application` boundary for API-facing service interfaces, starting with a cleaner `IEntityCatalog` abstraction over the entity projection implementation.
- Renamed the v2 .NET API contract records and generated Orval models to remove `Dto` suffixes, keeping request/response names only where they describe API direction.
- Added a code-defined v2 .NET hierarchy registry, semantic structural relationship codes, tree projection support, and canonical structural-link indexing so parentage lives in shared hierarchy links instead of bespoke traversal logic.
- Refactored v2 .NET entity kinds and relationships into Codec-style interfaces with one concrete implementation per kind or relationship, dedicated interface files, and separate registries for lookup/discovery behavior instead of central enum-style kind and relationship models.
- Changed the v2 API capability payload from a fixed grouped object to a discriminated capability list so clients can consume capability kinds independently.
- Refactored v2 .NET registries for codecs, entity kinds, relationships, and capabilities onto shared discovery infrastructure, with capabilities now owning their kind metadata directly instead of separate kind stub classes.
- Collapsed the v2 .NET registry base classes into one `AbstractRegistry` so each domain registry declares its own lookup key, ordering, and missing-key behavior in one place.
- Moved v2 .NET hierarchy layer declarations into the individual relationship classes so each relationship file shows its allowed root, parent, and child entity kinds directly.
- Merged v2 .NET gallery and audio-library hierarchy variants into one aggregate relationship code each, so nested children and direct media children are reviewed from the same relationship class.
- Updated the v2 .NET hierarchy-link uniqueness filter in the database migration model to match the merged aggregate relationship codes.
- Corrected v2 .NET media, taxonomy, collection, and structural hierarchy models to inherit from the shared `Entity` root, added playback as an explicit reusable capability, and removed the stale Domain-to-Contracts project reference.
- Flattened v2 .NET typed aggregates around explicit capability construction, keeping only kind-specific fields direct while shared metadata is exposed through the inherited `Entity` root.
- Expanded v2 .NET tag and credit capabilities to keep entity references and role metadata, and hydrated file/playback capabilities from their EF rows instead of returning empty placeholders.
- Simplified the v2 .NET rating model so `Rating` owns the integer value, clamps it to the shared zero-through-five scale, and replaces the extra `RatingValue` wrapper.
- Added typed v2 .NET EF hydrators for media, taxonomy, collection, and hierarchy entities so each root entity loads its kind-specific fields directly without changing the public API yet.
- Added typed v2 .NET EF hydrators for direct video technical fields plus direct video-series, video-season, book-volume, book-chapter, and book-page fields.
- Added a shared v2 .NET counter capability and `entity_counters` table so named per-entity counts can move across the API without becoming video-only fields.
- Added shared v2 .NET description and fingerprint capabilities, plus per-entity-kind image asset shapes for typed generated artwork such as posters, logos, previews, sprites, and trickplay.
- Changed v2 .NET entity kinds to declare their supported capability shape directly, allowing projection and contracts to include only capabilities that each kind intentionally supports.
- Added typed v2 .NET EF rows, mappings, and projection hydration for the expanded capability-first tables.
- Updated the v2 fresh-start reset to clear the expanded capability-first tables before preserving settings and library roots.
- Changed the app-level breaking upgrade gate to read and accept the .NET v2 global entity gate, then run fresh-start preparation before entering the app.
- Changed v2 entity detail hydration to read shared descriptions, dates, sources, stats, technical metadata, progress, positions, markers, subtitles, and classifications from capability tables instead of duplicated per-kind detail fields.
- Slimmed the v2 detail tables to keep only kind-specific fields, with shared metadata now stored in capability tables and old book read progress replaced by the shared progress capability.
- Removed obsolete v2 projection helpers that previously rebuilt shared capabilities from per-kind detail rows.
- Renamed v2 video and series detail API text fields from summary to description so generated clients match the capability-first domain language.
- Split v2 .NET media and taxonomy contracts plus API mappers by entity type, replacing generic catch-all detail records with modular object-specific detail records.
- Split the v2 .NET entity projection infrastructure into focused partial modules for entry-point projection, typed detail hydration, hierarchy loading, capability assembly, and capability-family table readers.
- Split expanded v2 EF model configuration by data family so capability, media, taxonomy, collection, and system table mappings live in focused infrastructure modules.
- Split the legacy non-video media import SQL into collection, gallery, image, book, and audio fragments, and documented the public import/reset SQL holders.
- Moved v2 API contract mapping and media/taxonomy use-case orchestration into the Application layer so API endpoints stay focused on HTTP routing and infrastructure stays below the application boundary.
- Moved the v2 job queue port and job creation use case into the Application layer so API routes and workers depend on application queue behavior while Infrastructure only persists job rows.
- Moved the v2 settings service contract into the Application layer so API routes depend on application settings behavior while Infrastructure only implements EF-backed persistence.
- Updated v2 legacy import SQL to populate shared capability tables for descriptions, dates, technical metadata, sources, stats, progress, positions, classifications, fingerprints, playback, and minimal media detail rows.
- Changed v2 media, taxonomy, and collection detail APIs to use typed aggregate hydrators so flat kind-specific fields are available alongside shared capabilities.
- Refined the v2 thumbnail lab by removing non-user-facing kind and hover labels, adding outer card borders, expanding each entity row to five samples, and adding a scale slider.
- Refined the v2 thumbnail card hierarchy so the image area, title, and metadata chips read in descending visual priority.
- Updated v2 thumbnail lab fixtures so row samples better match actual entity cards instead of internal entity-type descriptions.
- Standardized v2 thumbnail body sizing so rows stay aligned while long titles and metadata clamp within fixed slots.
- Removed the unused v2 entity-card subtitle field from the .NET domain model, API contract, generated Svelte model, and thumbnail lab fixtures.
- Tuned shared v2 thumbnail capability chips so ratings show as a single star value, NSFW state uses an icon-only red fire chip, and book-page entities omit the detail footer.
- Moved legacy thumbnail components and adapters into `src/lib/v1/components/thumbnails` with `V1` file names, leaving the new shared entity thumbnail at the canonical component path.
- Moved legacy Svelte API helpers into `src/lib/v1/api` with `-v1` file names, while keeping generated v2 API helpers in `src/lib/api`.
- Updated legacy v1 thumbnails to read asset URLs through the v1 API helper namespace instead of the canonical v2 API folder.
- Moved legacy Svelte server helpers into `src/lib/v1/server` with `-v1` file names and updated route imports to use the v1 server namespace.
- Moved the legacy Svelte media-surface implementation into `src/lib/v1/media-surface` with `V1`/`-v1` file names and updated existing routes to import the v1 browsing surface explicitly.
- Moved legacy identify runners, scrape runners, review drawers, and scrape review components into `src/lib/v1` namespaces with `V1`/`-v1` file names.
- Added a canonical `EntityGrid` component family for v2 entity-card thumbnails, with shared toolbar controls, saved presets, kind tabs, a pop-out capability filter drawer, request-state serialization, and loading/empty rendering.
- Refined the v2 Entity Grid toolbar so search has its own row, NSFW is selected through capability filters, list view is functional, and empty states use generic user-facing copy.
- Replaced the two-line thumbnail title slot with measured one-line title fitting, so long names scale down slightly before ellipsis.
- Added selectable thumbnail state to the shared v2 card component and wired the lab page to track multiple selected entities.
- Added measured title ticker behavior to the shared v2 thumbnail so overflowing names scroll in place on hover.
- Fixed v2 thumbnail title overflow detection by measuring the intrinsic title text width and showing a visible ticker affordance when text compresses.
- Scoped thumbnail scrub pointer handling to the media area and simplified the title overflow affordance to a subtle brass edge.
- Removed the native title tooltip from v2 thumbnail titles and prevented CSS ellipsis from blocking the custom ticker track.
- Job Control active jobs are now grouped by queue type and rendered as compact rows instead of large cards, making it easy to see what kind of work is running and how many jobs each queue has.
- Job Control failures can now be individually suppressed by error type — clicking Suppress on any failed job hides all jobs sharing the same error fingerprint until you click Show all or clear all failures.
- Job Control completed jobs now show a duration column so you can see how long each run took, plus a retry indicator when a job needed more than one attempt.
- Job Control overview replaced the confusing "Retained Done" count with a Last Scan timestamp that shows when the most recent library scan finished and whether auto-scan is enabled.
- Job Control failures are now loaded up to 50 at a time (was 24), and the header shows the true total count from queue stats alongside the number displayed.
- Comics now live under a top-level Books section instead of being mixed into Galleries. Existing archive comic galleries are migrated into book/chapter/page records, old gallery detail links redirect to the new book detail page, and users should enable Books scanning on the relevant library roots to keep discovering ZIP/CBZ comics.
- Books now use the same library browsing tools as the rest of Obscura, including saved search/filter presets, responsive thumbnail sizing, shared thumbnails in dashboard/search/collections, chapter previews, upload/delete actions, and merging standalone comics into one chaptered book.
- Comic reading now flows from one chapter into the next inside the same lightbox, with a Next Chapter action at the end of webtoon and paged reading.
- Book detail pages now have the same shared metadata editor pattern as other detail views, including title, studio, date, details, artists, tags, organized, and NSFW fields.
- Actor, tag, and studio detail pages now include Books tabs, and book thumbnails remain clickable while scrubbing previews.
- Book cards and book detail pages now rely on the existing red NSFW marker instead of also showing a redundant yellow NSFW badge.
- Book editing now includes chapter cover controls so each chapter can use an uploaded image, the first page, any selected page, or the default first-page behavior.
- Books now participate in plugin-based identification, including bulk review, language-aware candidate picking, book/chapter cover selection, and NSFW-aware MangaDex-style metadata results.
- Obscura now checks GitHub for newer releases and highlights the app version when an update is available, with a direct release link in the changelog dialog.
- Book scans now carry NSFW root and adult ComicInfo metadata through to linked artists, tags, and studios.
- NSFW collections now stay hidden in SFW mode from the first browser render, and direct links to hidden detail pages now return to the dashboard instead of showing an error page.
- Metadata discovered inside NSFW library roots now inherits the NSFW flag, so comic artists, tags, and studios stay hidden with the media that introduced them.
- Gallery detail pages now let you resize the sub-gallery cards instead of locking chapter and nested-gallery lists at their largest size.
- Comic reader page turns now preload nearby pages, so paged reading feels instant instead of flashing while the next image loads.
- Long breadcrumb trails now collapse behind a tappable overflow menu on mobile, and browser back now restores warm library pages with their loaded items and scroll position.
- Filtered library views now re-check their saved filters when reopened, so comics that become Read disappear from Unread lists without manually toggling the filter.
- Image and gallery browsing now feels more consistent after filters and on touch devices: filtered image results open in the lightbox correctly, Feed view follows the thumbnail-size control, and gallery preview scrubbing works on mobile.
- The top breadcrumb bar now shows media context on detail pages, so episodes link back through their series/season context and image/gallery pages show a clearer path back up.
- Library navigation now reuses recent page data and media thumbnails from the browser cache, making back-and-forth browsing feel snappier while keeping private media out of shared caches.
- Video playback now handles HEVC and adaptive streaming more smoothly: unsupported direct HEVC starts in adaptive mode without getting stuck on loading, and adaptive streams avoid forced top-quality startup churn.
- Adaptive video streams now use continuous HLS packaging with a short startup buffer, reducing audible audio clips at segment boundaries during transcoded playback.
- Adaptive video playback now asks hls.js to buffer the full available stream instead of stopping at the previous short forward-buffer cap.
- Direct playback is now only offered for original files the browser can play directly, so non-native containers stay on adaptive streaming instead of entering a hidden preparation state.
- Adaptive video scrubbing now jumps to the requested time through hls.js instead of snapping to the current buffer edge.
- Video playback now has a Vidstack-powered proof-of-concept player that keeps Obscura's filmstrip scrubber while adding a built-in audio-track selector for multi-audio streams.
- Video playback now keeps Vidstack's stable media engine while restoring Obscura's full Dark Room controls, including brass square transport buttons, custom captions, filmstrip scrubbing, audio tracks, quality, speed, and fullscreen menus.
- Video playback controls now fit more consistently across desktop and mobile, with one active playback-mode status chip and subtitle styling at the top of the captions menu.
- Adaptive video playback now waits for the HLS package to report ready before attaching the stream, and filmstrip drag or wheel scrubbing commits the final target instead of snapping back to the loaded range.
- Video playback now uses one YouTube-style settings menu for quality, speed, audio, captions, and subtitle styling, with animated mobile/desktop menus and a cast button that can be hidden from Settings.
- Mobile transcript docking now shows a compact live transcript directly under the video instead of doing nothing on small screens.
- Entity thumbnails now use one shared visual path across browsing, search, collections, related-media, and review queues, so videos, comics, images, actors, studios, tags, and audio items keep the same presentation wherever they appear.
- Galleries now behave as ordinary image galleries again: comic/read filters, gallery reader actions, and the merge-comic-series affordance have moved out of the Galleries browsing flow.
- Books browsing now uses the shared media surface toolbar, mobile/desktop preferences, grid/list cards, and gallery-style scrub previews instead of a custom one-off grid.
- Detail pages can now provide explicit breadcrumbs to the app header instead of relying only on URL segments.
- Browser caching now uses short private cache windows for page data and mutable artwork, plus private immutable caching for generated media assets.
- The video player now uses Vidstack's tested media engine and HLS provider behind Obscura's custom controls, captions, menus, and filmstrip strip.
- The video player now groups quality, speed, audio, captions, and subtitle styling inside a single responsive settings flyout/sheet, with the scrub bar above desktop buttons and below mobile buttons.
- Transcript dock controls now use sidebar/theatre-style icons to better communicate moving the transcript between docked and normal page layouts.
- Search, collection, detail, and review surfaces now render entity artwork through the central thumbnail entrypoint instead of route-local image markup.
- Book root and chapter pages now describe comic reading progress with chapter names, page labels, and progress meters instead of bare saved page numbers.
- Book chapter detail pages now surface Read, Resume, Re-read, Start over, and Next chapter actions directly in the chapter hero.
- Identify queues now hide organized series, books, galleries, images, albums, tracks, and videos by default while preserving Show all for broader review.
- Tags and Studios now use server-side search, filters, sorting, pagination, and shared bulk actions instead of loading and reshaping the full list in the browser.
- Media list API calls now share one query encoder across client and server fetchers, keeping repeated filters and pagination parameters consistent across library pages.
- Book and gallery scans now reuse the shared metadata relation helpers, preserving NSFW propagation while reducing duplicated studio, actor, and tag lookup logic.
- Video series pagination and bulk-selection logic now lives in focused helpers, keeping the hierarchy page behavior unchanged while making future maintenance safer.
- Extracted shared job handler scaffolding into `EntityFileJobHandler` (entity ID parsing, source file validation) and `ScanJobHandler` (root ID parsing, root iteration with progress) base classes, reducing boilerplate across 11 handlers.
- Collapsed three identical fingerprint handlers (`FingerprintVideoJobHandler`, `FingerprintImageJobHandler`, `FingerprintAudioJobHandler`) into one `FingerprintJobHandler` registered per media type via factory DI.
- Replaced ~60 raw string literals (`"thumbnail"`, `"md5"`, `"video"`, etc.) in Application port interfaces, job handlers, and Infrastructure adapters with typed domain values (`EntityFileRole.Thumbnail`, `FingerprintAlgorithm.Md5`, `EntityKindRegistry.Video.Code`) so string-based typing errors are caught at compile time instead of at runtime.
- Changed `EntityFileFingerprintRow.Algorithm` from an untyped string to a `FingerprintAlgorithm` enum with EF `HasConversion`, matching the codec pattern used by other persisted enums.
- Changed `AddIfSupported` capability filtering from case-insensitive string comparison to `ReferenceEquals` on singleton capability kinds, eliminating allocation during entity projection.
- Organized v2 job handlers into pipeline-stage subfolders (`Scan/`, `Probe/`, `Generate/`, `Identity/`, `Maintenance/`, `Import/`) and moved stray handlers from the Jobs root into the Handlers directory.
- Organized v2 Infrastructure media services into concern-based subfolders (`Adapters/`, `Processing/`, `Persistence/`) so port adapters, media processing services, and persistence implementations are easier to find.

### Removed

- Removed the obsolete TypeScript scenes-to-videos breaking gate from the Drizzle migrator; the current one-time gate is owned by the .NET v2 migration system.
- Removed the legacy v2 gallery photographer metadata field so gallery details no longer preserve Stash-parity-only data.

### Added

- Added `FingerprintAlgorithm` enum with codec for typed fingerprint algorithm references (`md5`, `oshash`, `phash`) instead of bare strings, and typed the domain `EntityFingerprint` record to use it.
- Added `LibraryMaintenanceJobHandler` with real asset validation that checks expected cache files (thumbnails, waveforms) exist for each entity kind and removes orphaned cache directories for deleted entities.
- Added `CollectionRuleEngine` ported from the TypeScript rule engine to evaluate dynamic collection rule trees against the v2 unified entity model using parameterized SQL, supporting all field types (title, rating, date, flags, tags, performers, studios, technical metadata, playback stats, resolution tiers, and hierarchy-based video series filtering).
- Added `CollectionRefreshPersistenceService` for atomic dynamic collection membership replacement — deletes dynamic items, inserts resolved matches after manual items, and updates refresh timestamps within a transaction.
- Added `ICollectionRuleEngine`, `ICollectionRefreshPersistence`, and `IMaintenancePersistence` application port interfaces for the remaining job handler implementations.
- Added `CollectionRuleNode` polymorphic types (`CollectionRuleGroup`, `CollectionRuleCondition`) with `System.Text.Json` discriminator support matching the TypeScript contracts.
- Added `FileDiscoveryService` for recursive directory walking with extension filtering for all media categories (video, image, audio, comic archive).
- Added `MediaProbeService` wrapping ffprobe for video, audio, image, and subtitle stream metadata extraction with structured JSON parsing.
- Added `HashingService` computing MD5 and oshash fingerprints in a single streaming pass, compatible with the Node.js OpenSubtitles hash algorithm.
- Added `ThumbnailService` for ffmpeg-based thumbnail generation, preview clips, trickplay frame extraction, subtitle extraction, and audio waveform PCM decode.
- Added `AssetPathService` for canonical generated-asset paths under the configured data directory.
- Added Application-layer port interfaces (`IFileDiscovery`, `IMediaProbe`, `IMediaHashing`, `IMediaAssetGenerator`, `ILibraryScanPersistence`) with Infrastructure adapters.
- Added `LibraryScanPersistenceService` implementing entity upsert-by-source-path, stale entity cleanup, technical metadata writes, fingerprint writes, and subtitle recording.
- Implemented `ScanLibraryJobHandler` — discovers video files, creates/updates video entities, removes stale entries, chains probe/fingerprint/preview/subtitle jobs.
- Implemented `ScanGalleryJobHandler` — discovers images by directory, creates gallery+image entities, chains thumbnail/fingerprint jobs.
- Implemented `ScanAudioJobHandler` — discovers audio files by directory, creates audio-library+track entities, chains probe/fingerprint jobs.
- Implemented `ScanBookJobHandler` — discovers CBZ/CBR/ZIP archives, creates book/chapter/page entities from zip image members, chains page thumbnail jobs.
- Implemented `ProbeVideoJobHandler` and `ProbeAudioJobHandler` — run ffprobe and store technical metadata, audio handler also chains waveform generation.
- Implemented `FingerprintVideoJobHandler`, `FingerprintImageJobHandler`, `FingerprintAudioJobHandler` — compute MD5+oshash and store as entity file fingerprints.
- Implemented `GeneratePreviewJobHandler` — generates video thumbnails, H.264 preview clips, and trickplay sprite frames with WebVTT.
- Implemented `GenerateImageThumbnailJobHandler` and `GenerateBookPageThumbnailJobHandler` — generate JPEG thumbnails via ffmpeg scaling.
- Implemented `GenerateAudioWaveformJobHandler` — generates waveform peak JSON from PCM-decoded audio.
- Implemented `ExtractSubtitlesJobHandler` — probes subtitle streams, extracts text-based streams to WebVTT, records in entity subtitles table.
- Added the initial .NET 10 backend solution with API, contracts, domain, infrastructure, and test projects for the global entity migration.
- Added initial v2 API route groups and DTOs for global entities, video facades, job operations, and settings.
- Added the first EF Core v2 global entity migration with seeded entity kinds and shared capability tables.
- Added a typed Svelte-side v2 API wrapper for the new .NET backend route contracts.
- Added a v2 global entity upgrade gate service and API endpoint for recording migration consent.
- Added v2 preservation tables for library settings, library roots, and database backup tracking.
- Added a v2 fresh-start preparation endpoint that runs a database backup and copies current settings/library roots into the v2 schema.
- Added the v2 video-series entity kind, .NET series list/detail endpoints, generated TypeScript client coverage, and static Svelte `/v2/series` list/detail pages.
- Added v2 entity hierarchy links and a legacy video import endpoint for populating the new entity schema from current videos, series, tags, and studios during migration verification.
- Added thumbnail file-role projection to v2 entity cards so shared media surfaces can render artwork from the global entity model.
- Added a shared v2 API URL helper for generated fetches and media URLs, keeping typed API calls and stream sources on the same backend.
- Added v2 studio and credit capability tables plus legacy import coverage for people, studios, and video/series cast links.
- Added typed v2 taxonomy DTOs and OpenAPI coverage for `/api/people`, `/api/studios`, and `/api/tags`.
- Added typed v2 media DTOs and OpenAPI coverage for `/api/images`, `/api/galleries`, `/api/books`, `/api/audio-libraries`, and `/api/audio-tracks`.
- Added a legacy media import endpoint and Svelte API wrapper coverage for testing the remaining v2 media facades with real local metadata.
- Added v2 worker handlers for `legacy-video-import` and `legacy-media-import` jobs.
- Added v2 .NET job endpoints for cancelling queued/running jobs and clearing failed jobs from the operations dashboard.
- Added v2 .NET settings and watched-root endpoints for reading, saving, browsing folders, creating roots, updating roots, and deleting roots.
- Added shared v2 URL and external-ID capability tables, projections, generated DTOs, and legacy preview-import coverage across video, book, image, gallery, and audio entities.
- Added a v2 thumbnail lab page with safe dummy entity cards, shared capability chips, aspect-ratio shaping, and hover preview modes for trickplay and image-sequence thumbnails.
- Added v2 collection DTOs, `/api/collections` list/detail endpoints, collection-item projection loading, and legacy collection import counts.
- Added shared v2 marker and subtitle capability tables, video detail DTO projection, EF migration coverage, and legacy import coverage for video subtitles, video markers, and audio-track markers.
- Added the v2 .NET domain capability vocabulary for markers, subtitles, stats, dates, technical metadata, source provenance, reading progress, structural positions, and classifications.
- Added API-facing v2 capability contracts for the expanded capability-first entity model.
- Added EF migration discovery coverage for the expanded v2 capability tables so backend upgrades apply the capability-first schema consistently.
- Added child-entity projection to v2 media details for gallery images and audio-library tracks.
- Added configurable ASP.NET static-file hosting and client-route fallback for the future static Svelte app.
- Added the initial v2 job-run table for the native Postgres-backed worker queue.
- Added the initial .NET worker runtime and development Docker/script wiring.
- Added tested v2 queue SQL for claiming, completing, and retrying native Postgres jobs.
- Added an EF-backed v2 job queue service and wired the jobs API to it.
- Added an EF-backed v2 settings service and explicit `hide_nsfw` setting storage.
- Added Orval generation for the v2 .NET OpenAPI contract and wired the existing Svelte v2 API wrapper to generated DTOs and fetch functions.
- Added a shared .NET entity projection service that powers generic entity lists, video lists, video details, and rating/flag updates from one capability-aware path.
- Added the v2 `entity_files` capability table and a .NET video source service for direct playback source resolution.
- Added a safe HLS asset resolver for the .NET backend with traversal protection, MIME types, and cache headers.
- Added the first .NET worker job-handler contract and a no-op handler for validating queue execution end to end.
- Added `/v2/videos` and `/v2/videos/[id]` Svelte routes as the first client-rendered video UI slice for the .NET backend.
- Added a dev-only `/dev/v2-migration` page and `dev:db:clear-v2` script for repeating the v2 upgrade-gate, restore, and migration reset flow locally.
- Added a reusable .NET process executor and media tool status service for ffmpeg/ffprobe-backed jobs.
- Added development CORS for localhost .NET API comparisons and automatic EF migration startup for the API and worker.
- Added Books as a first-class library category with library-root scan toggles, book/chapter/page tables, Books API routes, search and collection support, a `/books` Comics tab, and series-style book detail pages with chapter reading progress.
- Added book upload, delete, metadata update, and merge-into-book actions so comic archives can be managed from the Books section.
- Added an in-reader Next Chapter action for multi-chapter books, preserving the current paged, webtoon, and spread preferences while continuing into the following chapter.
- Added book detail editing with Obscura's shared form components so comic metadata can be updated directly from the book page.
- Added Books cross-reference tabs to actor, tag, and studio detail pages.
- Added book chapter cover APIs for upload, page selection, reset, and metadata-service cover downloads.
- Added Books to the plugin identification workflow, with normalized book/comic/manga capabilities, review cards, candidate language filters, and accepted metadata writes for book and chapter cover art.
- Added a best-effort in-app release check that compares the installed version to the latest GitHub release once per day and supports manual refresh from the changelog dialog.
- Library settings now include a Show cast controls toggle so users can hide the video player's cast button if they do not want remote playback available.

### Fixed

- Subtitle extraction no longer fails with a duplicate key violation when a video has multiple embedded subtitle streams with the same language — additional streams are now stored with a stream-index suffix (e.g., `eng.3`) to satisfy the unique constraint.
- Entity file existence checks (`HasEntityFileAsync`) no longer fail with an EF Core LINQ translation error when the role code is a string — the method now parses to the enum before querying.
- Accepting the v2 upgrade gate in local development now creates the required database backup through the Docker Postgres service when `pg_dump` is not installed on the host.
- V2 entity lists no longer expose NSFW entities when the server-side hide-NSFW setting is enabled.
- Entity Grid kind tabs now disappear when the visible result set only contains one entity kind, avoiding redundant All/type tabs on single-kind pages.
- Accepted book metadata no longer creates duplicated on-disk volume folder names such as `Volume 01 - Volume 1`, and book scans repair already-created duplicate volume folders while preserving existing chapter/page records.
- Identify provider flyouts now close as soon as a provider is selected, so the disabled Identify button prevents repeat submissions while the lookup is running.
- Accepted plugin metadata results now mark series, books, galleries, images, albums, and tracks as organized, even when the accepted fields only update artwork or linked metadata.
- Book migration now deduplicates legacy archive-gallery book and chapter insert targets before conversion, preventing startup migration failures on databases with duplicate ZIP or CBZ gallery rows.
- Release update checks now fall back to GitHub's public latest-release redirect when the API rate limit is exhausted, keeping update detection useful without requiring authentication.
- Adaptive playback no longer fails on first load when generated asset requests race a newly added library setting before every request has observed the latest migration.
- NSFW collections no longer reappear from the browser's client-side pagination fetch while SFW mode is active.
- NSFW detail pages now redirect back to the dashboard while SFW mode is active, avoiding hidden-content stubs and server errors from saved or typed URLs.
- Gallery and video scans now mark linked tags, artists, and studios as NSFW when those links come from an NSFW library root.
- Sub-gallery cards on gallery detail pages now use a persisted size slider, matching the rest of the library browsing surfaces.
- Comic reader paged mode now preloads the previous and next two pages around the current spread to prevent page-turn flashes.
- Comic reader end actions now persist the last readable page as complete before moving to the next chapter, and final chapters now close from a "No next chapter" action instead of leaving the reader stuck at the end.
- Comic reading completion now refreshes book detail data immediately, so Read badges and read filters update as soon as a chapter is completed or manually marked read.
- Mobile breadcrumbs now collapse parent levels into a stacked overflow menu instead of overlapping the current page title on narrow screens.
- Browser back navigation now restores the previous media surface's loaded items and scroll position through SvelteKit history snapshots.
- Filtered media surfaces now verify hydrated or cached first-page data against active saved filters before trusting it, fixing stale Gallery lists after read-progress changes.
- Filtered Images results now keep the lightbox item list in sync with the cards on screen, so clicking filtered or newly loaded images opens the expected item.
- Images Feed view now responds to the thumbnail-size slider instead of staying at a fixed width.
- Gallery thumbnail preview scrubbing now uses pointer input, making the preview strip work on mobile touch as well as desktop hover.
- HEVC videos now only start in Direct mode when the browser reports HEVC MP4 support, and HEVC MP4 remuxes are tagged as `hvc1` for Safari and Chrome compatibility.
- Adaptive HLS now lets hls.js choose its startup quality, recovers once from transient media or segment loading errors, and warms the next on-demand segment to reduce playback stalls.
- Adaptive HLS now packages segments through one continuous ffmpeg job and waits for three ready segments before playback, preventing per-segment AAC timestamp overlap from causing periodic audio clips.
- Adaptive HLS no longer caps hls.js at a short forward buffer, allowing already-generated segments to continue loading ahead as far as the browser permits.
- Direct video playback no longer tries to remux or transcode non-native containers behind the Direct button; those videos now use adaptive HLS unless the original file itself is browser-playable.
- Adaptive HLS seeks outside the current buffer now restart loading at the requested timestamp while keeping already buffered media available for backward jumps.
- Multi-audio adaptive streams now expose audio-track selection in the video player instead of forcing whichever track the browser or HLS stack selected first.
- Vidstack video playback now presents Obscura's previous squared-off controls and custom subtitle styling instead of the bare default player chrome.
- Video playback no longer renders Vidstack's custom element during server hydration, preventing the player shell from producing hydration mismatch warnings on load.
- Adaptive HLS buffering now uses browser-safe limits, reducing noisy `bufferFullError` console logs while still keeping a large forward buffer.
- Video playback controls now center the play glyph and captions control more precisely inside their square buttons.
- Mobile video playback controls now keep the compact transport buttons clickable and move the scrub bar to the bottom of the overlay.
- Mobile video playback menus now use smaller option text and icons so quality, captions, and fullscreen controls fit in the player overlay.
- Mobile captions controls now have a little extra side padding so the icon and chevron do not clip against the button border.
- Desktop video playback controls now place the scrub bar below the button row, matching the cleaner mobile control order.
- Video playback scrub bars now have a larger click target, and the desktop captions button now matches the padding rhythm of the other dropdown controls.
- Video playback now always exposes the audio-track selector, including single-track videos where it shows the default audio track.
- Mobile video playback now groups the quality selector with fullscreen so the audio selector has room on the left side of the control row.
- Mobile video playback now keeps the audio selector sized to its label instead of stretching across the control row.
- Desktop video playback controls now stay grouped together after the mobile audio-selector layout changes.
- Adaptive video playback now polls HLS readiness before loading the manifest, preventing expected warmup 503 responses from reaching the player.
- Filmstrip drag and wheel scrubbing now preview the target position and commit one seek at the end of the interaction.
- Trickplay preview generation now normalizes sample aspect ratio before padding frames, preventing wide/anamorphic sources from failing with padded-dimension errors.
- Comic gallery search results now carry structured preview and cover-shape metadata, letting search and command palette thumbnails match the main gallery cards.
- Book covers now come from the first page in reading order, and book previews now scrub through chapter covers for multi-chapter books or page spreads for one-shot comics.
- Book cover thumbnails now fall back to the underlying comic page while generated thumbnails are still being built, and book detail pages now label comic creators as Artists.
- Gallery-style book thumbnails now keep click navigation active while preview scrubbing is visible.
- Comic book scans no longer create volumes from same-named wrapper folders or metadata-only volume numbers; volume grouping now requires a real volume subfolder inside a book entry.
- Comic book scans no longer create volumes from non-volume chapter wrapper folders, and rescans now remove empty volume rows left behind by older scan rules.
- Stale image thumbnail, image fingerprint, and book page thumbnail jobs now complete as harmless no-ops when their target row was already removed by a scan or migration.
- Identify no-result messages now use a more legible solid surface, can be dismissed directly, and disappear automatically after a short delay.
- Filtered media surfaces now support explicit NSFW and not-NSFW filtering across videos, images, galleries, books, audio libraries, and actors without bypassing the global NSFW visibility guard.
- Book thumbnails now distinguish custom cover art from generated page-cover fallbacks, so stale page-cover paths no longer override the user-selected cover and fallback covers follow volume/chapter reading order.
- Book edit mode now includes root book cover upload and clear actions, and book ratings now appear on book detail pages and book cards instead of only existing as a hidden sortable field.
- Current book progress cards are now clickable resume targets, and shared thumbnails now carry rating data through search, collections, dashboard rows, and media grids for rated videos, series, galleries, books, images, performers, studios, tags, and audio items.
- Video series detail pages now expose the edit workflow again, restoring metadata fields, rating, organized/NSFW toggles, and cover/backdrop upload and clear actions.

### Docs

- Documented the release update alert implementation plan, including the app-core helper, API route, sidebar badge, changelog link, and verification path.
- Documented the in-app release update alert design, covering daily GitHub release checks, dev-version comparison, sidebar badging, and changelog refresh behavior.
- Documented the CPU-first streaming stability plan, including HEVC direct-play detection, smoother adaptive HLS behavior, and the later Linux Docker GPU support path.

## [0.22.0] - 2026-05-09
### What's New

- Comic and archive galleries now open into a gallery-scoped Images browser instead of a one-off masonry strip. Gallery detail pages get the shared toolbar, sort menu, view-mode toggle, thumbnail sizing, infinite loading, and bulk image actions; comic archives default to filename-number ordering so pages read in the expected order.
- Comic galleries now have a dedicated reader with paged and webtoon modes. Paged mode supports one-page or two-page spreads, plus a First Page is Cover toggle that keeps cover pages alone before pairing the rest.
- On mobile, the comic reader now lets pages use the full screen: controls float over the artwork, fade away after a short delay, return or hide with a center tap, and left/right taps move backward or forward.
- Comic reader controls now recover on desktop after auto-hiding: center-clicking the page or moving the cursor near the top or bottom brings the controls back.
- Comic galleries now remember reading progress per gallery. The gallery page shows current page progress, offers Resume when there is saved progress, and keeps Read available to start from page one.
- Comic archives stored inside a folder now group under that folder as a single series-style gallery, with chapter archive covers used as the parent preview tiles. Flat cbz/zip files at the library root still appear as standalone galleries.
- Selected galleries can now be merged into a comic series from the Galleries list. The merge creates or reuses a real series folder on disk, moves the selected galleries under it, and lets the user label the chapter order before saving.
- Comic series tools are easier to reach and filter. Gallery cards can now be selected from grid-style views for series merging, and the Images and Galleries pages can show only comic items or hide comic items.
- Gallery cards now show cleaner comic covers and metadata: image counts moved below the title, zero-image series stop showing `0 images`, and sub-gallery counts appear alongside image counts.
- Comic galleries now track when reading reaches the final page. Completed comics show a Re-read action, and the Galleries page can filter comic galleries by Read or Unread.
- Comic reader mode is now remembered per gallery, and reopening a comic in webtoon mode resumes by scrolling back to the saved page.
- The Merge into series flow now opens in a drawer-style panel with mobile-friendly chapter fields that match the identify review surfaces more closely.
- Merge into series now understands existing series selections: selecting a series plus a standalone gallery shows the current chapters and adds the new gallery into that series folder instead of nesting or replacing the series.
- Gallery scans no longer turn the library root itself into an empty gallery card, and actor/tag/studio detail pages now show linked galleries and audio libraries even when those items live inside nested folders.
- Single-comic wrapper folders are now flattened during gallery scans. A folder such as `Comic Name/Comic Name.cbz` appears as the comic itself instead of a one-child series, while true multi-archive folders still appear as comic series.
- Merge into series now works with flattened single-comic wrapper folders. Selecting archives exposed from separate same-named folders moves the cbz/zip files into the new series folder and removes the old empty wrappers.
- The Operations dashboard now reflects live worker state for gallery image thumbnail and fingerprint jobs, so jobs that pg-boss has started appear under Running instead of lingering only in the backlog counts.
- Tag, actor, and studio detail pages now load their linked media when switching beyond the initial Videos tab, so non-video sections like Series and Galleries no longer show an empty grid while their tab badge says items exist.
- Detail-page linked media now uses the same content-specific thumbnail cards as Search and the main library views, so Series and Audio Track tabs no longer borrow video or album thumbnail rendering.
- Library view preferences are now saved separately for mobile and desktop layouts. A phone can keep a compact feed/list setup while a desktop keeps a wider grid, without the two devices overwriting each other's view choices.
- The changelog dialog now shows the same app version as the package release cycle, so the sidebar header no longer drifts behind the actual installed version.
- Library grids now include a Randomized sort option that reshuffles results on each reload while keeping infinite scrolling stable during that visit.
- Gallery series merges now keep the visible grid in sync with the active sort and filters after the merge completes, so the controls no longer show one state while the cards use another.
- Settings now opens without waiting for generated-storage totals, removing a slow cache-directory scan from the page load.

### Changed

- The changelog dialog now links directly to the Obscura GitHub repo and subreddit with icon chips, making project updates and community discussion easier to reach from inside the app.
- Library surface view preferences now use form-factor scoped database keys (`mobile` / `desktop`) while saved filter presets remain shared. Existing unscoped preference rows are used as a one-time fallback so current layouts seed the new scoped keys instead of resetting abruptly.
- Gallery bulk actions now remain visible outside list view, and gallery grid cards expose selection controls so actions like Merge into series are discoverable without changing layouts.
- Gallery cards now render image and sub-gallery counts in the subtitle row instead of overlaying the thumbnail.
- Gallery selection controls are more compact and inset into selected cards, reducing how much of the cover artwork they obscure.
- Merge into series now uses a full-height drawer layout with stacked chapter inputs on small screens.
- Merge into series now expands selected series folders into their existing child galleries and keeps the selected series folder as the disk target when adding standalone galleries.
- On mobile gallery detail pages, the info panel now appears above sub-galleries and images so metadata is visible before long gallery lists.

### Added

- Library grid sort menus now include a Randomized option across Videos, Series, Images, Galleries, Collections, Actors, Tags, Studios, Audio Libraries, Audio Tracks, and detail-page related-media tabs.
- Comic archive helpers now understand natural page ordering and ComicInfo metadata, giving the gallery scanner a shared foundation for cbz/zip page order and comic metadata import.
- Comic gallery pages now persist the last-read page in the existing UI preference store and show Resume plus a compact progress meter when reading has started.
- Gallery scans now seed ComicInfo metadata from folder and cbz/zip galleries, attach comic creators as gallery performers, attach comic genres/tags/characters as tags, and index pages in natural numeric filename order.
- Gallery and image reads now expose comic-aware gallery metadata, support a natural page-order sort for gallery images, and fall back to child gallery imagery when a parent gallery needs a cover or preview tile.
- Gallery detail image browsing now uses the shared Images surface, including masonry, grid, and list views; comic galleries default to natural filename ordering and label performer metadata as Authors.
- Nested comic archives now attach to their containing folder gallery during scans, and numbered archive names are shown as ordered chapter labels such as `#01` and `#02`.
- Galleries list bulk actions now include Merge into series, with a review dialog for the series folder name and per-gallery chapter labels.
- Galleries and Images now include a Comic library filter, with Comic and Not comic choices for narrowing archive series and comic pages.
- Galleries now include a Reading filter with Read and Unread options for comic reading completion.
- Added a comic reader overlay for archive galleries with paged spreads, one/two-page controls, first-page-cover handling, keyboard navigation, and a vertical webtoon roll.
- Comic reader mobile controls now auto-hide as floating overlays, with center-tap chrome toggling and left/right tap zones for page navigation.

### Fixed

- Shared library surfaces now refetch active persisted filters and sorts after server-side data is rehydrated, fixing stale default-ordered cards after actions such as merging selected galleries into a series.
- Gallery scans no longer create a folder gallery for the library root when comics or loose images are stored directly under that root.
- Same-named folders containing a single cbz/zip archive are no longer imported as redundant parent galleries, and comic filtering now treats image-empty folders as comics only when all direct child galleries are comic archives.
- Merge into series no longer rejects selected cbz/zip galleries that came from separate same-named wrapper folders, and it now cleans up those old wrapper folders after moving the archives when they are empty.
- Text-entry fields now keep a minimum 16px computed font size globally so focusing forms on iOS Safari no longer zooms the page.
- Comic gallery detail pages now default to Grid view so page ordering is easier to scan, while Masonry and List remain available.
- Comic series and sub-gallery thumbnails now preserve chapter cover artwork instead of cropping it, and parent series covers prefer the largest available child cover candidate.
- Comic gallery cards now size their thumbnail frame from the selected cover dimensions when available, avoiding black letterbox bars from the default square grid frame.
- Comic gallery cards now use a consistent page-sized thumbnail frame and contain cover art inside it, fixing clipped chapter covers caused by raw cover aspect ratios.
- Gallery grid selection controls are now square and no longer collide with media counts.
- Gallery image thumbnail and fingerprint jobs now use live pg-boss state when the dashboard calculates Running, Queued, and Delayed counts, fixing stale waiting rows during active processing.
- Actor, tag, and studio detail tabs now flatten gallery and audio-library hierarchy filters and use each endpoint's native relation filter, so their related-media counts match the items shown in the tab.
- Detail-page media tabs now fetch their first page when they mount without SSR-hydrated items, fixing empty linked-gallery and linked-series grids for tags, actors, and studios.
- Series and Audio Track tabs on tag, actor, and studio pages now render with their own universal thumbnail components instead of the Video or Audio Library card renderers.
- Comic reader controls can be restored on desktop after auto-hide by center-clicking the page or hovering near the control areas.
- Comic reader side-tap and keyboard navigation no longer reopens the floating controls after they have auto-hidden. Only a center tap brings the reader chrome back.
- Webtoon reader mode now restores the saved scroll position when resuming instead of reopening at the top of the comic.
- Library view preferences now initialize from server-loaded mobile/desktop preference snapshots, so saved view mode and thumbnail size are applied before the first client-side preference fetch instead of animating from defaults after mount.
- The changelog dialog no longer displays a stale hardcoded version. It now reads the web package version at build time, keeping the sidebar header aligned with `package.json` and release changelog headings.
- Settings no longer blocks initial rendering on generated-storage statistics, fixing slow settings navigation on large cache directories.

### Docs

- Updated the README and docs site to describe comics as a core Obscura reader and organizer workflow, including cbz/zip archive galleries, series grouping, reading progress, and paged/webtoon reader modes.
- Added the Obscura subreddit link to the README and docs site navigation/footer.
- Documented the planned comic-aware gallery experience, including archive-native cbz/zip reading, ComicInfo metadata mapping, natural page ordering, scoped Images browsing, and the dedicated comic reader.
- Added the implementation plan for comic-aware galleries so the archive metadata, scoped gallery browser, cover behavior, and reader work can land in small reviewable commits.

## [0.21.1] - 2026-05-06
### What's New

- Scheduled library scans no longer flood the job queue with work that's already been done. The previous fix made each processor short-circuit when its outputs were already present, but the queue itself was still being filled with thousands of no-op jobs on every scan — overwhelming the worker dashboard and stalling real work behind the backlog. Scans now check completion *before* enqueueing, so a rescan of a fully-processed library adds zero downstream jobs. Subtitle extraction in particular is now tracked with a dedicated timestamp, so videos with no embedded subtitles (which previously looked identical to "never tried") aren't re-probed every scan. Force-rebuild from the UI is unchanged.
- Scheduled library scans no longer redo work that's already been done. Probe, fingerprint, preview, and trickplay jobs now skip videos whose outputs are already present, so a rescan of a fully-processed library finishes quickly instead of reburning ffmpeg time on every file. Force-rebuild from the UI still regenerates everything as before, and missing on-disk artifacts (e.g. after a `/data` wipe) are detected and regenerated even when the database row still references them.
- The Images Feed view now shows each image at its natural shape instead of cropping everything to a square, so portrait and panoramic images are easier to recognize while scrolling.
- The Sort menu in library toolbars no longer slides off the left edge of the screen on narrow phones. The dropdown now opens to the right of the Sort button on mobile and keeps its existing right-anchored position on wider viewports.
- The image lightbox's bottom thumbnail strip now scrolls the active image into view as you navigate, so the current selection stays visible in long galleries instead of disappearing off the right edge.
- Tapping or clicking an animated image inside the lightbox now toggles play/pause directly, matching the behavior of native video players. Previously you had to use the toolbar Play/Pause button or press Space.
- Animated image previews on touch devices now play while you press-and-hold any thumbnail in a grid. Previously preview playback was triggered by mouse hover, which was unreliable on touch — only the leftmost column of thumbnails would animate when tapped.
- Collections can now be marked NSFW. NSFW collections (and any NSFW items within a collection) are hidden when SFW mode is on, blurred under blur mode, and shown normally under show mode — matching the existing behavior for videos, images, and tags. NSFW results are also filtered out of the dynamic-rule preview while building dynamic collections in SFW mode.
- Slideshow auto-advance now respects animated images. When a collection slideshow reaches a video / animated image, the duration timer is skipped and playback advances at the end of the clip — same as a regular video — instead of cutting to the next item mid-play.

### Fixed

- Library scans no longer enqueue media-probe, fingerprint, preview, or extract-subtitles jobs for videos whose work is already complete. The earlier processor-level skip prevented redundant ffmpeg work but still let the queue balloon — a 5,000-video rescan would still create ~20,000 queued jobs that all had to be marked active and completed. The scan now reads each video's completion-relevant columns alongside the upsert and gates each enqueue on whether the column set is populated. Settings (`generatePhash`, `autoGeneratePreview`, `generateTrickplay`) are still honored when deciding what counts as "complete" for fingerprint and preview.
- Subtitle extraction is no longer re-queued on every library scan for videos that have no embedded subtitle streams. Previously the only completion signal was the presence of a `video_subtitles` row, and a video with zero embedded streams left no row — so the scan re-enqueued extraction every time and the worker re-ran ffprobe on the whole file. A new `subtitles_extracted_at` timestamp on `video_episodes` and `video_movies` (drizzle migration `0027`) is set the first time extraction runs against a video, regardless of how many streams were found, and scans skip when it's set. The migration also backfills the timestamp for videos that already have at least one embedded subtitle row, so existing libraries don't have to re-probe everything once.
- The Images Feed view no longer forces every image into a square thumbnail. Each card now uses the image's own width/height ratio so portrait and landscape images display unclipped (APP-109).
- Library toolbar Sort dropdown no longer opens off the left side of the viewport on mobile. The panel now anchors `left-0` below `sm` breakpoint (opens to the right of the Sort button) and keeps `right-0` on wider screens, where the button has space to its left (APP-110).
- The image lightbox bottom navigation strip now auto-scrolls the active thumbnail into view as you navigate. Without this, the highlighted thumb scrolled out of sight in galleries with more than ~7 images on mobile (APP-108).
- Tapping (touch) or clicking (mouse) an animated image inside the lightbox now toggles its playback. Previously the only way to pause from inside the viewer was the toolbar button or the Space key (APP-107).
- Animated image thumbnails now play preview video on touch press-and-hold, not just mouse hover. The hover-play handlers used `mouseenter`/`mouseleave`, which fire inconsistently across columns on touch devices — switching to `pointerenter`/`pointerleave`/`pointercancel` makes every thumbnail respond uniformly (APP-106).

### Added

- `video_episodes.subtitles_extracted_at` and `video_movies.subtitles_extracted_at` timestamp columns (drizzle migration `0027`). Set by the `extract-subtitles` processor on completion. The migration backfills the timestamp for videos that already have an embedded subtitle row.
- `collections.is_nsfw` column with default `false` (drizzle migration `0026`). `CollectionListItemDto`, `CollectionCreateDto`, and `CollectionPatchDto` carry the new field, and the collection editor UI exposes a toggle. Collection list / detail item / dynamic-rule preview endpoints now accept the standard `?nsfw=on|off` query and apply the same SFW-mode filtering used elsewhere in the app (APP-111).
- Image lightbox `autoAdvanceSeconds` path now branches by media type. Static images keep the existing duration-based timer; animated images / videos disable `loop`, listen for `ended`, and call the advance callback so playlist/slideshow playback honors the clip's natural length (APP-111).

## [0.21.0] - 2026-04-26
### What's New

- Library state changes now feel continuous: the lightbox opens with a shared-element transition that grows the source thumbnail into the full image, modals fade in over a backdrop and dialog bodies fly up gently, the bulk action bar slides in when items are selected, filter chips scale on add and remove, and grid items fade in with a brief stagger and slide into their new positions when filters or sorts change.
- Library infinite scroll no longer loads in a runaway cascade once the bottom of the list is reached. Newly loaded items now also fade in as they're appended, so it's clear something happened without the page jumping.
- Library infinite scroll no longer stalls on tall viewports where the load sentinel never leaves the visible area. The footer continues fetching new pages as long as the cursor is advancing, so users with large monitors or filtered views that don't fully fill the screen now see the rest of the library instead of a stuck "Loading" footer.
- Library and detail pages now share a single browsing surface. Videos, Galleries, Images, Collections, Audio, and Actors all use the same toolbar (search, sort, filters, presets, view mode, thumbnail size) and infinite-scroll body, so behavior is consistent across pages and filter/sort/view choices follow you across devices instead of resetting per browser. Tag, Performer, and Studio detail pages now show their related media as tabs (Videos, Series, Galleries, Images, Audio Libraries, Audio Tracks, Performers) — each tab is its own paginated grid with its own filters and sort, instead of a fixed top-N preview, and the active tab persists in the URL so reload and back-button restore where you were.
- Library navigation and detail tabs now behave more predictably: opening a deeper page starts at the top, detail-page sort/view choices persist after returning, and empty related-media tabs are hidden instead of leading to blank grids.
- Uploads are back on the main media pages. Videos, Series, Images, and Audio now accept drag-and-drop or the Import button, with root views prompting for the destination library or audio library when the current page does not already imply one; gallery and audio detail views still upload into the folder currently being viewed.
- Images now has its own main navigation tab for a flat all-images view. Galleries remains the grouped folder-style browser.
- The flat Images view now includes a vertical Feed mode for mobile browsing, showing one large bounded image after another with infinite scroll.
- The flat Images view can now filter by file type, animated/static media, and image dimensions, making mixed image libraries easier to narrow down.
- The flat Images grid now preserves each image's natural shape in a stable masonry layout, so tall and wide images are easier to recognize while more results load in without reshuffling the existing cards.
- Selecting an image from the flat Images view now opens the in-page lightbox instead of navigating away, and animated image playback controls live in the lightbox top bar with Space and M keyboard shortcuts.
- Thumbnail size controls now keep their toolbar position stable while media grids resize, so changing card scale no longer pulls the filter bar around the page.
- Delete prompts now distinguish between removing items from Obscura and deleting the source files from disk. Library-only deletes blacklist the source path so the next scan does not import the same file again.
- Library browsing now keeps loading more cards as you scroll across Videos, Series, Actors, Galleries, Images, Collections, and Audio Libraries, without page-number footers interrupting the bottom of the list. Upgraded libraries that still point at legacy scene thumbnail or trickplay paths now show those assets again instead of flooding the console with 404s.
- Infinite scrolling now starts fetching farther before the bottom of library pages and stops cleanly if a backend page repeats already-loaded cards, so the list no longer sits forever on a visible Loading footer.
- The Videos page now keeps loading past the first 60 cards on libraries that contain only episodes or only movies. Earlier the list would briefly show the full count and then collapse to 60 when scrolling, because the backend was handing the same first page back for every load-more request.
- Direct Identify on video entries now offers the full provider set: Obscura plugins, Stash-Box endpoints, and community database scrapers. Legacy scraper matches now open in the same flyout review experience as plugin matches, so accepting metadata feels consistent from entry pages and the review queue.
- Animated images now play correctly in Safari (both iOS and macOS). Previously the asset endpoint did not advertise byte-range support, so Safari refused to start playback while Chromium browsers played fine.
- Bulk series Identify review now advances cleanly after choosing from multiple candidate matches. After a candidate refetch, **Apply all & next** shows the next row's review details instead of keeping the previous candidate's panel content.
- The video Identify flyout now feels like the player's subtitle/audio pickers: the panel is fully opaque so providers stay readable over playing video, a search field at the top filters Obscura plugins, Stash-Box endpoints, and community scrapers in one pass, and "no results" feedback shows at the top of the flyout where you'll actually see it instead of buried under a long provider list.
- Stash-Box providers in the Identify flyout now warn with an inline note when the current video has no perceptual hash, so it's clear up front that the lookup will fall back to title search rather than a fingerprint match.
- The scrape review drawer now has a solid backing again. Previously the drawer surface used a glass token that wasn't wired up in the stylesheet, leaving the title visible but the review fields rendered against the underlying video — fields are now legible.
- The scrape review drawer no longer flickers, paints empty, or only partly draws over the video player. The drawer uses `position: fixed` to cover the viewport, but it was being rendered inline inside the player area where an ancestor's CSS transform redefined the containing block, so the drawer was being clipped to the player's bounds and would only repaint into view when the cursor moved. The drawer now portals to `<body>` like the identify provider flyout, so it always covers the viewport regardless of where it is invoked from.
- The Obscura logo mark in the mobile header now shows its brass star fills again instead of rendering as a flat dark disc. The desktop sidebar and mobile header each render their own copy of the logo, and the SVG gradient definitions inside both copies shared identical ids — so on mobile, where the desktop copy is `display:none`, Chromium resolved `url(#brass)` into a hidden subtree and dropped the gradient. Each logo now scopes its gradient ids per-instance.
- MovieDB identify reviews no longer crash when a show returns duplicate season, episode, candidate, cast, genre, or image rows. The review drawer now keeps those rows visible with stable review keys instead of hitting Svelte's duplicate-key runtime error.
- Trickplay sprite generation (the hover-scrub film strip on the video player) is now dramatically faster, and works correctly on a class of source files (HDR video, modern phone footage, rendered animation, anything stored as full-range YUV) where it was previously failing outright. On a 4K60 reference clip (Big Buck Bunny, 642 MB, 10:34) sprite build time dropped from **51 s on the original pipeline to 2.4 s** on the new one — a 21× speedup — and a 1080p25 clip dropped from 5.7 s to 0.6 s. The worker now decodes only the source's keyframes (`-skip_frame nokey` plus input-seek), in parallel, instead of either running a single ffmpeg that has to decode every frame of the source or repeatedly decoding entire GOPs around each requested timestamp. Frames are also re-encoded as standard JPEG-range YUV (`format=yuvj420p`) before muxing, which fixes a hard failure where `ffmpeg`'s mjpeg encoder was refusing to write full-range YUV frames at all — symptoms included trickplay jobs that simply never finished, the worker spinning on retries, and the host appearing to lock up.
- Embedded subtitle extraction is also dramatically faster, especially on multi-language sources. On a 4.8 GB MKV with 37 SRT tracks the extract job dropped from **19.4 s to 0.7 s** — a 29× speedup — by walking the source container exactly once and demuxing every subtitle stream into its own VTT file in the same pass, instead of re-opening the file once per track. Output files, languages, and the player's subtitle picker are unchanged; if a source has a single broken stream that takes down the single-pass call, the worker automatically falls back to the previous per-stream approach so one bad track no longer skips the rest.
- Trickplay generation no longer fails outright on short clips or on long videos that contain a single bad keyframe region. Previously a single missing frame would crash the whole preview job (visible as an "Input file is missing" error in Operations); now the film strip simply repeats the nearest neighbour frame for any slot ffmpeg couldn't fill, and the job completes successfully.
- File fingerprinting (the MD5 + OpenSubtitles hash a video, audio, or image scan computes when it imports a file) is modestly faster on every source — about **15% on a 642 MB clip and 11% on a 4.8 GB clip** in benchmarks. Hashing is fundamentally limited by how fast the disk can hand bytes to the CPU, so this is a small win compared with trickplay or subtitles, but it shaves a few seconds off every multi-GB import. The hashes themselves are unchanged.
- The sidebar now links directly to the hosted Quick Start docs beside the changelog, so setup and usage help is one click away from inside the app.

### Added

- Shared motion helpers in `@obscura/ui-svelte/motion/transitions` (mechanical bezier easings, duration tokens, and `fadeIn` / `flyUp` / `flyDown` / `scaleIn` / `scaleChip` / `slideX` / `sheetUp` / shared-element `sendThumb` + `receiveThumb`) so all transitions speak the Dark Room motion vocabulary.
- Drag-and-drop upload zones plus Import buttons for the Videos, Series, Images, Audio, gallery detail, and audio library detail views.
- A Feed view mode on the flat Images page for full-height vertical image browsing.
- A root image upload endpoint now writes selected files directly into an image library root as unorganized flat images.
- A `media_file_ignores` migration-backed table that records library-only deletes and keeps scan workers from reimporting ignored files.
- A local `pnpm dev:seed-scroll` helper now seeds synthetic video rows for repeatable infinite-scroll testing in small development libraries.
- `VideoDetailDto` now exposes a `fingerprints` block (`hasPhash` / `hasOshash` / `hasChecksumMd5`) so identify UIs can warn about Stash-Box providers when the current video has no fingerprint to query against.
- Glass surface utilities `glass-1`, `glass-2`, and `glass-3` are now defined in `app.css`, matching the layered weights described in `docs/design-language.md`.
- A documentation shortcut now appears in the sidebar footer next to the changelog.

### Changed

- The image lightbox, confirm-delete dialog, add-to-collection modal, and command palette now fade and fly into place instead of cutting in. The image lightbox additionally crossfades from the source thumbnail using Svelte's shared-element transition.
- Library thumbnail controls now default to the largest card size until you choose and save a different size.
- The bulk action bar now animates its action buttons in when a selection becomes non-empty and out when cleared.
- Active filter chips in the toolbar now scale in/out on add or remove and slide into place when their neighbors change.
- Library grids on Videos, Images (list + masonry), Performers, Studios, Galleries, and Collections now reorder smoothly via FLIP when the result set changes (sort, filter, search) and fade in newly loaded cards with a brief, capped stagger.
- Animated images in the Images Feed now autoplay muted at full quality while on screen, pause off screen, and preload the active item plus one neighbor on each side for smoother scrolling.
- Video entry Identify menus now group Obscura plugins, Stash-Box endpoints, and community scrapers, and pending scrape results use the shared review drawer instead of an inline-only card review.
- Trickplay sprite extraction in the worker now uses parallel input-seek (`ffmpeg -ss <ts> -i …`) per frame plus a `sharp` composite step instead of a single `fps=1/N + tile` filter chain. Concurrency defaults to half the available cores clamped to `[2, 8]`. Frames are written to a temp directory and cleaned up in a `finally` block.
- Trickplay frame extraction now passes `-skip_frame nokey` to the ffmpeg decoder so each spawn discards non-keyframe packets entirely. Combined with the existing input-seek, each frame extraction decodes exactly one I-frame instead of decoding the GOP up to the requested timestamp. The output filter chain also appends `format=yuvj420p` so the mjpeg encoder accepts full-range YUV inputs (this was a hard `ff_frame_thread_encoder_init failed` error on affected sources before, not a quality regression). Benchmarked on a 4K60 642 MB reference clip: 51 s → 2.4 s.
- Embedded subtitle extraction in the worker now runs as a single ffmpeg invocation with one `-map 0:N -c:s webvtt <out>` triple per text-based subtitle stream (plus a paired `-c:s copy <out>.ass` triple for ASS/SSA streams), instead of one ffmpeg invocation per stream. ffmpeg walks the source container exactly once and demuxes every subtitle stream in parallel into its own output file. If the single-pass call errors (e.g. a malformed individual stream), the processor falls back to the previous per-stream approach so one bad track does not skip the rest. Benchmarked on a 4.8 GB MKV with 37 SRT streams: 19.4 s → 0.7 s.
- File fingerprint computation in the worker now uses a new `computeMd5AndOsHash` helper in `@obscura/media-core` that streams the file once with a 4 MB read buffer (up from Node's 64 KB default), captures the first 64 KB of the OpenSubtitles hash inline as MD5 advances, and reads the trailing 64 KB explicitly at the end. Replaces the previous pattern of `await computeMd5(file); await computeOsHash(file);` in the video, audio, and image fingerprint processors — that pattern opened the file twice and on cold cache could thrash the disk seeking between head and tail. Outputs are bit-identical (covered by a new test that proves the combined function matches `computeMd5` + `computeOsHash` byte-for-byte across multiple file sizes). Benchmarked on a 642 MB H.264 file: 1.21 s → 1.03 s; on a 4.8 GB MKV: 8.87 s → 7.91 s.

### Fixed

- Web app CI validation now uses shared browser animation test shims and current tabbed-detail assertions, so Svelte unit tests no longer fail on stale JSDOM or pre-tabbed page assumptions.
- Actor Known For cards for episode roles now use the parent series poster when one is available instead of stretching the episode thumbnail into a poster card.
- Navigating from a scrolled library page into a detail page now resets the main content scroll to the top instead of carrying the previous page's scroll position forward.
- Detail-page media tabs now reload saved sort, view mode, and thumbnail-size preferences, so actor, tag, and studio pages keep the browsing choices you made in each related-media tab.
- Actor, tag, and studio detail pages now hide related-media tabs with zero matching entities.
- Trickplay sprite generation no longer crashes the entire preview job when a single frame extraction silently fails. Two distinct cases were causing this: (1) on short videos the planner could ask ffmpeg to seek past end-of-source, where ffmpeg exits cleanly without writing the output and then `sharp` errors with "Input file is missing"; (2) on long videos, the same silent-no-output behaviour could occur on individual unindexable regions or single bad keyframes. Per-frame timestamps are now clamped to a half-second before EOF so the first case can't happen, and the composite step now substitutes any missing frame with the nearest successfully-extracted neighbour so the film strip stays visually contiguous. If literally no frames extract (catastrophic source), the worker logs a warning and skips trickplay for that video instead of failing the preview job.
- Image thumbnail resizing no longer shifts the whole Images page when moving between sizes that toggle vertical overflow.
- Video page drag-and-drop now keeps the “Drop files to import” panel centered in the visible viewport instead of centering it somewhere down the full scrollable grid.
- Flat Images uploads now prompt for an image-capable library root instead of asking for a child gallery, and the grouped Galleries root no longer offers a misleading image upload control.
- Library scans no longer fail if the media-file ignore table is unavailable while an upgraded worker is still catching up on migrations.
- Season-scoped series uploads now pass the active season number through the video upload route and write to the season folder when the user is viewing one.
- Bulk delete actions for videos, images, galleries, and audio libraries now show the library-only vs. disk-delete confirmation flow where source files can be removed.
- Videos infinite scroll now carries the current NSFW visibility mode into load-more requests and routes the visible fallback control through the same loader.
- Series, Actors, Galleries, Images, Collections, and Audio Libraries now use the same offset-based infinite loader as Videos instead of manual Prev/Next page navigation.
- Library infinite scroll now guards each load target so the same page cannot be auto-requested repeatedly, and all major entity grids treat duplicate load-more responses as end-of-list instead of spinning at the footer.
- Videos page no longer collapses to the first 60 cards mid-scroll on libraries that contain only episodes (or only movies). The merge-and-slice step in the videos read now honors the requested offset whenever both video kinds are queried, instead of skipping it whenever one side returned no rows.
- Legacy `/assets/scenes/...` card, sprite, trickplay, and custom thumbnail URLs now resolve from old scene cache directories after the SvelteKit cutover.
- Infinite scroll on every grid no longer cascades into a runaway loop after the first auto-load. The trigger is now edge-triggered: the sentinel must leave and re-enter the viewport before another fetch fires, which also closes a race where two concurrent load-more calls could clobber each other and prematurely mark the list as exhausted.
- Animated image previews and full-resolution clips served by `/api/assets/...` now respond to HTTP `Range` requests with `206 Partial Content` and advertise `Accept-Ranges: bytes`, which Safari requires before it will start playback. Image, image preview, and video preview-sidecar endpoints all stream byte ranges; Chromium browsers continue to work unchanged.
- Bulk series Identify no longer carries a manually selected candidate's refetched scrape result into the next review row after using **Apply all & next**.
- Library infinite scroll now uses a cursor-based gate keyed off the next page offset instead of an edge-triggered sentinel. The previous fix stopped the runaway cascade but introduced a stall when the sentinel never left the viewport (tall monitors, filtered views, or short result sets that didn't fill the screen); pages now keep flowing as long as the cursor is advancing, and the trigger goes quiet once the backend stops returning new items. The "Loading" status is also now announced to screen readers.
- MovieDB identify review drawers now tolerate duplicate rows from provider data instead of crashing with Svelte's `each_key_duplicate` error.

## [0.20.0] - 2026-04-24

### What's New

- **The web app has been rewritten on SvelteKit.** Obscura's frontend moved from Next.js + React to SvelteKit + Svelte 5. The app now runs as a single SvelteKit process on port 8008 with same-origin `/api/*` routes — the old Next.js + Fastify + nginx stack is gone, which makes the production Docker image simpler and the app noticeably faster to navigate on a LAN. The Dark Room visual direction carries through unchanged.

- **Scenes are now Videos.** The legacy `scenes` / `scene_folders` data model has been replaced by a typed `video_series → video_seasons → video_episodes` / `video_movies` hierarchy. On first boot of 0.20.0 from an older install, you'll see a one-time upgrade prompt explaining that the legacy tables will be dropped and your library will need a rescan — your video files on disk are untouched, only the database rows are rebuilt. After you confirm, Obscura rescans your libraries into the new model automatically. Future updates are very unlikely to require this kind of break again.

- **Seasons and episodes are first-class.** Series detail pages open onto a season grid; clicking a season drills into just that season's episodes. Video cards show a compact **S01E03** badge when a row carries season + episode numbers, and the video list defaults to episode order inside a series. The video edit form has dedicated Season / Episode / Absolute Episode inputs.

- **Universal Identify.** Every library surface — Videos, Series, Galleries, Images, Audio libraries, and Audio tracks — now supports identify and scrape through the same engine. Each entity detail page has an **Identify** button that lists eligible plugins, and the Identify page has per-entity tabs with Accept / Reject / Dismiss controls, Auto-accept, Accept All, and Stop-mid-run.

- **Cascade review drawer.** TMDB-style multi-level identification lands in a full-height review drawer: series header with poster / backdrop / logo pickers, collapsible season sections with their own poster pickers, per-episode rows with per-field checkboxes and unmatched warnings, a disambiguation **Candidate Picker** when the plugin returns multiple matches, and an **Apply cascade** footer that walks the tree and creates any missing performers / tags / studios along the way. Cascade accept downloads chosen images to the local cache so the library stays offline-capable.

- **Community plugin system.** First-party plugin packages for The Movie Database, TVDB, YouTube, and MusicBrainz, plus a built-in plugin registry hosted at [obscura-community-plugins](https://github.com/pauljoda/obscura-community-plugins). Settings → Plugins lets you install, update, enable, disable, and remove plugins with one click. A **Check for updates** button surfaces newer versions with one-click upgrade. Plugin API keys (where required) are stored encrypted and round-trip cleanly across container recreations.

- **Shared thumbnail treatment everywhere.** Every entity type — Video, Series, Gallery, Image, Performer, Studio, Tag, Audio Library, Audio Track, Collection — uses one shared thumbnail component across library pages, the dashboard, global search, the command palette, detail-page cross-references, and collection items. NSFW blur, gradient fallbacks, hover trickplay (videos), hover cycling (galleries), hover preview playback (animated images), and rotating-disc fallbacks (audio) are now consistent wherever the entity appears.

- **Saved preferences and filter presets, server-side.** Videos, Series, Galleries, Images, Actors, Studios, Tags, Audio, and Collections all expose a grid / list view toggle, a thumbnail-size slider, sort + filter controls, and a saved filter-preset menu. Choices persist to the Obscura database instead of a cookie on one laptop, so they follow you across browsers and devices.

- **Cinematic home dashboard.** The homepage is now a full-width hero carousel of featured videos (weighted toward top-rated and recently-played), a quick-nav tile grid for every media type, and a **Recent Additions** strip.

- **Fully interactive Settings page.** Watched Libraries with an inline folder browser and per-root enable / NSFW / scan-type toggles, Content Visibility (three-way NSFW mode switch + LAN auto-enable), Playback (Direct vs Adaptive HLS), Subtitles with a live preview, Metadata Providers link card, Generation Pipeline grid, Generated Storage stats, and Diagnostics (force-rebuild previews, backfill pHashes, clear all metadata).

- **Job Control dashboard.** The Operations page has a four-up overview (Running / Backlog / Failures / Retained Done) and groups queues by concern — Library scans, Library maintenance, Video media pipeline, Metadata import, Gallery image pipeline, Audio pipeline. Each queue card has inline Run / Stop / Clear Failures controls; active jobs show progress meters and can be killed individually; failed jobs expand to show the full error output. SFW mode hides NSFW-targeted jobs across every list.

- **Image lightbox overhaul.** Wheel-zoom centered on the cursor, drag-pan when zoomed, swipe left/right to navigate on mobile (swipe down to close), double-tap to toggle fit/2.5×, press 1–5 to rate inline, and an Info panel with dimensions / format / date / performers / tags. Video and animated images play back full size in the lightbox. Keyboard map: ← → navigate, +/- zoom, 0 reset, I info, 1–5 rate, Esc close. Gallery interiors now use a masonry layout that respects each image's natural aspect ratio.

- **Collections overhaul.** Custom cover images (upload or pick from an interior image), hero layouts matching audio libraries, playback sessions that survive a refresh, mixed vs. by-type views, dynamic rule editor at parity with the video browser, and slideshow advance for image items in the lightbox.

- **Audio browsing refresh.** The floating bottom player handles playback globally instead of duplicating players per page. Library detail uses a new playlist component with a brass-accent active row, a live equalizer animation, and hover play / rating / delete affordances. Track detail gets a full-width hero with a blurred cover backdrop.

- **Cross-media actor pages.** Actor detail pages now show every appearance — videos, series, galleries, images, and audio libraries — plus a **Known For** section that lists saved movie / series / unique episode roles with character names. Repeated episode-only roles collapse into a single series-linked card.

- **NSFW-aware everywhere.** SFW mode hides NSFW plugins, stash-compat scrapers, and StashBox endpoints from every provider picker. The Jobs page hides jobs targeting NSFW entities. Accepting a plugin-origin match no longer force-flags clean content as NSFW — Obscura plugins defer to the plugin manifest's `isNsfw` flag; StashBox endpoints and stash-compat scrapers stay NSFW-by-default (they are porn-metadata protocols).

- **Corrupt and legacy-path resilience.** Library scans no longer flag corrupt videos as failed jobs — the file stays with null technical metadata so you can find it and clean it up. Perceptual hashing retries frames at small time offsets before giving up. Videos whose stored paths still point at pre-cutover media directories resolve against the current cache location, so existing thumbnails, previews, and trickplay sprites stay visible after upgrading.

- **Terminology cleanup.** "Scenes" and "folders" are gone from every user-visible surface — filter chips, tooltips, settings copy, empty states, search result groups, job dashboard sections, and performer / tag / studio labels all say **Videos** and **Series** now. Contracts, database schema, API routes, web routes, and component names were renamed to match.

- **Obscura now has a dedicated documentation website scaffold.** The new Docusaurus site can be run locally from VS Code or pnpm, builds as a static site for GitHub Pages, and starts the docs with user setup, architecture, design-language, pHash, and plugin-authoring guides.

### Added

- SvelteKit web app (`apps/web-svelte`) running on port 8008 with same-origin `/api/*` routes, replacing the Next.js + Fastify + nginx stack.
- Shared Svelte design system package (`@obscura/ui-svelte`) with design tokens and primitives (`Button`, `Badge`, `Checkbox`, `StatusLed`, `Meter`, `Panel`, `MediaCard`).
- Shared server-logic package (`@obscura/app-core`) consumed by the SvelteKit server and the background worker — covers reads, writes, plugin execution, scraper runtime, StashBox runtime, job queue helpers, breaking-gate, and the video-stream / HLS transport.
- New video data model: `video_series`, `video_seasons`, `video_episodes`, `video_movies`, and typed join tables (`video_{series,season,episode,movie}_{performers,tags}`). Scrape results, stash IDs, external IDs, and collection items all reference the new tables.
- One-time **breaking-upgrade gate** for installs upgrading from the scenes model. Runs before the migrator, pauses boot, presents a full-page takeover explaining the change, and only proceeds after explicit consent. Consent is recorded as a marker file under `/data/.breaking-gate/`.
- `ui_prefs` table plus `GET/PUT/DELETE /api/ui-prefs/:key` for server-side per-user list preferences and saved filter presets across every library page.
- `playlist_sessions` table plus `GET/PUT/DELETE /api/playlist-session` so the bottom playlist controller can persist collection queue, shuffle / loop state, cursor, and slideshow timing across refreshes.
- Universal Identify runners for videos, series, galleries, images, audio libraries, and audio tracks. Per-row Accept / Reject / Dismiss, Auto-accept, Accept All, and Stop-mid-run.
- `IdentifyButton` component wired onto every entity detail page, with eligible-plugin discovery, capability filtering, and cascade review drawer handoff.
- Cascade review drawer with per-field masks, per-season / per-episode masks, image pickers (poster / backdrop / logo / still / season poster), and a disambiguation candidate picker that re-runs the plugin with the chosen external ID.
- Community plugin engine: `plugin_packages`, `plugin_auth`, `external_ids` tables; `POST /api/plugins/:id/execute`; `GET /api/plugins/check-updates`. Settings → Plugins supports install / update / enable / disable / remove with one click. TypeScript plugins load through Node's CommonJS runtime; Python plugins run via stdin/stdout.
- First-party community plugins: The Movie Database, YouTube, MusicBrainz. Registry defaults to the public GitHub-hosted index at [obscura-community-plugins](https://github.com/pauljoda/obscura-community-plugins).
- Shared thumbnail components for every entity type: `VideoThumbnail`, `SeriesThumbnail`, `GalleryThumbnail`, `ImageThumbnail`, `PerformerThumbnail`, `StudioThumbnail`, `TagThumbnail`, `CollectionThumbnail`, `AudioLibraryThumbnail`, `AudioTrackThumbnail`. All support size variants, NSFW blur, fallback gradients, cache-busting, and — where applicable — hover trickplay, hover cycling, or hover preview playback.
- Shared filter toolbar (`FilterBar`, `FilterPresetDropdown`, `ThumbSizeSlider`) and a shared form kit (`EditFormShell`, `TextField`, `TextAreaField`, `DateField`, `SearchSelect`, `TagSelect`, `ToggleChip`, `ToggleCard`, `NumberStepper`, `QualitySlider`) used by every entity create / edit page.
- `/api/system/status`, `/api/system/breaking-gate/accept`, `/api/changelog`, and `/api/client-info` local endpoints.
- Cinematic home dashboard with hero carousel, quick-nav tiles, and Recent Additions strip.
- Full Job Control dashboard at `/jobs` with grouped queue cards, live-work progress, failures with error output, recently-finished list, 5-second poll, and global actions (Kill all, Acknowledge failures, Force rebuild previews).
- Full Settings page at `/settings`: Watched Libraries with inline folder browser, Content Visibility, Playback, Subtitles with live preview, Metadata Providers link card, Generation Pipeline grid, Generated Storage stats, and Diagnostics.
- Global command palette (Cmd/Ctrl+K) with grouped entity results and recent-search recall.
- Mobile "More" overflow sheet and persistent bottom playlist controller with queue sheet.
- Inline star rating (`InlineRating`) on every entity that has a rating field — click to rate, optimistic update, rolls back on error.
- Custom cover / thumbnail uploads: gallery covers (pick-from-interior or upload), per-image thumbnail override, tag custom image, and collection custom cover.
- Cross-media performer appearances and a **Known For** section on actor detail pages (saved movie / series / unique episode roles with character names).
- Episode-number-aware video lists: server-side episode-order sort, `seasonNumber` filter on `/videos`, and a dedicated `/series` route in the shell.
- `/resolve`, `/resolve/review`, `/performers/scrape`, and `/collections/[id]/edit` workflows ported at feature parity.
- Season poster cache route (`/assets/seasons/:id/poster`) and a cascade-accept image download pipeline that persists posters / backdrops / logos / season posters locally.
- JSON sidecar metadata extraction during library scans: `.info.json` / `.json` (yt-dlp format) joins NFO in the new-video ingest path.
- Integration and unit-test coverage for the new data model, migration framework, collection rule engine, stash-import normalizer, performer / tag / studio CRUD, and the Svelte video-player subtitle-default flow.

### Changed

- Legacy installs now upgrade through a single versioned migration ledger. The scenes / scene_folders tables drop in migration 0018 after the breaking-upgrade gate confirms consent.
- Library root scan toggles collapsed to a single `scan_videos` column (was `scan_movies` + `scan_series`). Existing rows backfill as `scan_movies OR scan_series`.
- Videos page defaults to **Series** view on first load. Saved preferences are respected — only users with no saved view-mode see the new default.
- Library scans enqueue technical metadata / fingerprint / preview jobs only when the corresponding generation toggle is enabled. Trickplay sprites are built in one FFmpeg pass instead of per-tile.
- Direct-source playback on large MKV videos streams a fragmented MP4 on demand so direct mode can start immediately without waiting for a full cache file. The player reloads the media element when falling back from direct to HLS.
- Asset server resolves legacy `apps/web/public/media/scenes/...` paths to current fixture / library paths before running ffprobe, ffmpeg, or hash readers — existing thumbs, previews, and trickplay sprites stay visible after upgrading.
- Ratings, organized state, orgasm counts, and other per-entity state use optimistic updates everywhere — UI repaints immediately instead of waiting for a page refresh.
- Plugin-origin scrape accepts defer to the plugin manifest's `isNsfw` flag instead of always flagging matches as NSFW.
- Dev and production run on a single unified Docker image: PostgreSQL + ffmpeg + SvelteKit + worker in one container. The dev compose stack boots SvelteKit directly on port 8008.

### Removed

- Legacy Next.js (`apps/web`), Fastify (`apps/api`), and the shared React component library (`packages/ui`) workspaces — along with their integration tests, parity snapshots, nginx reverse-proxy config, and dev wiring. The repo now ships a single web runtime (`apps/web-svelte`) plus the worker.
- Legacy `scenes`, `scene_folders`, `scene_performers`, `scene_tags`, `scene_folder_performers`, `scene_folder_tags`, `scene_markers`, and `scene_subtitles` tables (migration 0018). The one-time upgrade gate warns before the drop runs.
- Push-era legacy-install bridge in the API migrator and the entire data-migration staging / finalize framework. Obscura is pre-1.0 and does not carry bridges between breaking changes; breaks are explicit and gated.
- `library_roots.scan_videos`, `performers.scene_count`, `tags.scene_count`, and `studios.scene_count` columns — superseded by the new video tables and at-query-time counts.
- Legacy `/scenes/*`, `/scene-folders/*`, and `/stream/*` API routes and Next.js route files. Replaced by `/videos/*`, `/video-series/*`, and `/video-stream/*`.
- `useLibraryRootAsFolder` library setting (seasons are first-class in the new model).
- Empty `packages/config/` workspace.

### Docs

- Added a Docusaurus documentation site under `documentation-site/`, wired for GitHub Pages deployment and local VS Code launch/build commands.
- Added prominent README badge links to the live documentation site, quick start guide, and plugin author guide.
- `docs/library-organization.md` — how files under a library root are classified into movies, flat series, and seasoned series, with good / bad layout examples and filename convention tips.
- `docs/design-language.md` — refreshed Dark Room design direction reference.
- Documentation site now follows the Dark Room design language end-to-end: cinematic homepage with hero, capability strip, three-track Pathways grid, six-card Features grid, alternating Showcase rows, and a CTA strip; brass-accented sidebar with glowing active markers, LED-style admonitions, instrument-panel tables, glass pagination cards, and a typographic rhythm tuned for long-form reading.
- Documentation site fully fleshed out across four tracks (Users, Developers, Plugins, Advanced — 23 pages total): expanded Quick Start / First Boot / Library Organization / Browsing / Playback / Identify & Scrape / Operations / Settings / Upgrading; Architecture / Monorepo / Database / API & Jobs / HLS Streaming / Contributing; Plugin System Overview / Manifest Reference / Capabilities / TypeScript Plugin / Python Plugin / Stash Compatibility / Publishing; pHash Contribution / StashBox Endpoints / Troubleshooting. Every page is illustrated where it makes sense (28 app screenshots) and code-blocked where it teaches a contract.
- Documentation site mobile navigation drawer now opens to full height with the Dark Room background — fixes a Chromium containing-block trap caused by `backdrop-filter` on the navbar.

## [0.19.0] - 2026-04-12
### What's New

- Scene folders now have rich detail pages with poster art, backdrop banners, descriptions, star ratings, and a Cast & Crew section — inspired by Jellyfin's series view. You will need to run a library scan post update to generate folder associations. 
- Folders are searchable from the command palette and full search page.
- Uploading files while viewing a folder places them directly into that folder on disk.
- Studio and tag detail pages show linked folders above the scene grid.
- The folder edit panel uses the same chip pickers, studio autocomplete, and star rating as scene editing.
- Mobile layout improvements: compact poster in folder headers, search bar on its own row in the filter toolbar.

### Fixed

- Playlist now auto-plays videos when navigating to a scene from the queue.
- Videos auto-advance to the next playlist entry when playback finishes. Only the expected current entry triggers advancement, preventing rogue advances when the user navigates away and plays something else.
- Playlist returns to the collection detail page when the last entry finishes instead of silently clearing.
- Collection name and currently-playing info in the playlist bar are now clickable links back to the collection detail page.
- Queue sheet no longer cuts off the last item behind the controller bar.
- Desktop queue sheet now fits its content instead of stretching to a fixed height.
- All pages now have correct bottom padding when the playlist controller is active, on both mobile and desktop.
- Images auto-advance in the playlist after the collection's configured slideshow duration.

### Added

- Individual image detail page at `/images/{id}` with full-size viewer, zoom controls, metadata editing, rating, tags, performers, and collection support. Images are now viewable as standalone pages, enabling them as playlist-navigable entities.
- Individual audio track detail page at `/audio/tracks/{id}` with embedded audio player, waveform display, technical metadata (codec, bitrate, sample rate, channels), rating, tags, performers, and library back-link. Audio tracks are now playlist-navigable.
- Playlist controller bar title is now a clickable link to the currently playing item's detail page.

### Changed

- Playlist queue panel replaced with a rich sheet: slide-up panel with thumbnails, visual current/played/upcoming states, and glass surface styling. Mobile-full-width, desktop sidecar layout. Queue now displays items in play order so shuffled playlists show the shuffled sequence.
- Playlist controller bar now sits above the mobile navigation bar instead of overlapping it, with dynamic bottom padding when a playlist is active.
- Adding a gallery to a collection now expands it into individual image entries instead of adding the gallery as a single container item. Same for audio libraries — individual tracks are added.
- Collection detail page "Play" button renamed to "Play All" and a new "Shuffle All" button starts playback with shuffle pre-calculated.

### Added

- **Collections: cross-type content groups with dynamic rules and global playlist.** Collections group scenes, galleries, images, and audio tracks into curated sets. Three modes: manual (hand-picked items), dynamic (auto-populated by a condition builder with AND/OR/NOT logic trees), and hybrid (both). The condition builder supports filters on all entity fields — tags, performers, studios, rating, date, duration, resolution, codec, and more — with autocomplete chip pickers for relation fields and a live-updating preview panel showing matching items as rules are edited. Dynamic collections refresh automatically during library scans. The collection detail page offers mixed gallery and grouped-by-type view modes. A global floating playlist controller navigates to each entity's actual detail page (with full video player, subtitles, markers, etc.) and auto-advances when content ends — with shuffle, loop, queue panel, and dismiss controls. An "Add to Collection" modal can be triggered from any entity page to manually assign items — manual assignments persist even when dynamic rules wouldn't match them.
- **Library setting: use the library’s display name as the top folder in scans.** A new toggle under Settings → Generation Pipeline controls whether video scene folders, folder-based galleries, and nested audio libraries insert a synthetic top-level row for each library root path using that root’s label (for example Shows → Series → Season). When the option is off, the hierarchy starts at the first directory under the configured path (Series → Season). Changing it requires a library rescan to rebuild parent links.
- **Scene folders now support rich metadata.** Folders can store a description, backdrop image, studio association, rating, date, and linked performers and tags — enabling Jellyfin-style detail pages with cover art, cast sections, and full metadata editing.
- **Folder detail page redesigned with Jellyfin-style layout.** The folder view now features a full-width backdrop banner, poster image overlay, metadata row (studio, date, rating, tags), and a horizontally-scrolling Cast & Crew section with performer portrait cards.
- **Folders appear in search results.** Quick search shows up to 2 folder results above scenes. The full search page includes a Folders kind toggle. Folders are searchable by title, custom name, and description.
- **Studio and tag detail pages now show linked folders.** When a folder is associated with a studio or tagged, it appears as a card grid above the scene list on the respective detail page.
- **Uploads land in the active folder.** Dragging or importing files while viewing a folder places them directly into that folder's directory on disk, bypassing the library root picker. Non-folder views retain the existing library selector.
- **Scene folders now support custom display names.** Users can set a custom name for any scene folder that takes precedence over the on-disk directory name. Custom names survive library rescans and can be cleared to revert to the filesystem basename.
- **Scene libraries now maintain a filesystem-backed folder hierarchy in the API and worker pipeline.** Library scans derive `scene_folders` directly from on-disk video directories, assign each scene to its containing folder, preserve explicit folder NSFW flags and custom folder cover paths across rescans, and expose new `/scene-folders` list/detail/cover routes plus `/assets/scene-folders/:id/cover` for folder browsing and cover rendering.
- **Scenes now have a dedicated folder browsing mode with folder metadata pages.** The scenes index adds a `folders` view that reads the URL `?folder=` state, shows child folders above the scene grid, falls back to uncategorized scenes at the root, and links into a new `/scene-folders/:id` detail page where the user can toggle the folder NSFW flag, upload a custom cover, or clear it back to the auto-preview fallback.

### Changed

- **Scene detail toolbar consolidates actions into a "More Actions" flyout.** The "Reset Metadata" and "Rebuild Preview" buttons are now inside a triple-dot menu alongside the new "Add to Collection" option, reducing toolbar clutter. Gallery and audio library detail pages also gained the same More Actions flyout with "Add to Collection".
- **Scenes, Galleries, and Audio index footers now host the stat cards.** The four-up totals strip (videos duration / gallery counts / audio libraries, and so on) sits below the main grid or browser with a top border instead of directly under the page title; the redundant scene count beside Import on the scenes page was removed, and the galleries subtitle no longer repeats the gallery count.
- **Scene folder hero tags link to tag pages.** Folder tags in the scenes browse hero use the same clickable `tag-chip` links as the scene detail editor, including NSFW visibility filtering.
- **Scene folder hero shows one on-disk library path line.** The hero replaces the separate library label, “Scene folder” caption, and directory-name subtitle with a single path such as `Main Library > scenes > …` built from the library root label and each folder’s on-disk title.
- **Scene folder hero edit control moved to the top-right.** The edit (and save/cancel) actions for folder metadata now sit in the top corner of the backdrop header instead of beside the title at the bottom of the hero, where the bottom-aligned layout made them feel misplaced.
- **Scene folder metadata is now inline in the folder browse view.** The separate `/scene-folders/:id` detail page has been replaced by an inline sticky metadata panel that appears alongside the folder content in the main scenes browse view. The old URL now redirects.
- **Scene folder detail page now matches the gallery and audio detail view patterns.** The metadata panel has a gallery-style edit mode with inline custom name editing, NSFW toggle, and save/cancel flow. The panel is sticky on desktop, empty child folder sections are hidden, and library root labels appear on both cards and detail views.
- **HLS playback is now on-demand per-segment instead of a single linear ffmpeg encoder.** The old path ran one long-running ffmpeg that wrote segments sequentially, so scrubbing anywhere past the encode head either snapped back or stalled for minutes waiting for the linear encoder to catch up. The new path mirrors what Jellyfin / Plex / Emby do: a full-length VOD playlist is fabricated upfront from the scene's probed duration (every segment listed with `#EXT-X-ENDLIST` from the first request), and each segment is transcoded on demand by a short ffmpeg invocation the first time the player requests it, then cached to disk at `<cache>/hls2/<id>/seg_NNNNN.ts`. `video.seekable` covers the full scene from frame one, so scrubbing is effectively instant — dropping the scrubber anywhere triggers a single ~1s segment encode and playback resumes exactly where dropped. Concurrent requests for the same segment share one ffmpeg via an in-memory inflight map so the player's lookahead pre-fetch doesn't fork duplicate encoders. Scene `streamUrl` now points at `/stream/:id/hls2/master.m3u8`; the legacy `/stream/:id/hls/*` routes are left in place but no longer referenced from the UI.
- **Hierarchy scanning and list scoping now share common helpers across scenes, galleries, and audio libraries.** Folder/root scope selection is centralized in the API service helpers, and gallery/audio scans now use the same parent-first path ordering and stale-directory detection primitives that power the new scene-folder sync, reducing duplicated hierarchy logic before the new scenes folder UI lands.
- **Gallery preview rendering now runs through a shared media-preview component that scene folders reuse.** Gallery cards keep their existing cover-first and preview-cycling behavior, while scene folder cards inherit the same cycle-stepper fallback whenever a custom folder cover is not present.
- **Scene folder detail pages now show the folder’s direct scenes, and audio cards also use the shared preview media layer.** The folder metadata page is no longer just a settings surface; it now renders the scenes in that directory below child folders, while audio library cards moved onto the shared `cover-only` preview component so folder, gallery, and audio cards all flow through the same media shell without forcing audio into cycling previews.

### Fixed

- **Library-root folder mode now preserves the full on-disk hierarchy instead of skipping intermediate folders.** Scans for scenes, galleries, and audio libraries now create ancestor container rows for every directory between the library root and the media file location, so enabling the setting yields paths like `Shows → Series → Show → Season` instead of collapsing directly to the leaf media folder.
- **Synthetic library-root folders now preserve scene-folder custom names while still carrying the separate library label.** When the root-folder setting is enabled, the folder row for the library root path can still display a saved custom folder name like `Testing Folder`, while `libraryRootLabel` continues to expose the configured library name like `Main Library` for context elsewhere in the UI.
- **Database migrations now run automatically when the API or worker process starts**, not only from the unified container entrypoint. Local `docker compose` dev stacks and any environment where only `pnpm dev` runs now apply pending Drizzle migrations (including new `library_settings` columns) before pg-boss and routes touch the database, so upgrades self-heal on restart without manual `db:migrate`. The legacy reconcile step also adds `use_library_root_as_folder` idempotently for bridged installs that skipped the migrator SQL.
- **Scene scans and the scenes page no longer hard-fail before the scene-folder migration is applied.** Pre-migration installs now skip scene-folder sync in the worker, return an empty folder list from the new folder API, and fall back to folderless scene responses until that migration has been applied (automatic on API/worker boot or via `pnpm --filter @obscura/api db:migrate`). Once it lands, the folder hierarchy becomes available without needing code changes.
- **Film strip scrubbing no longer gets stuck in HLS mode.** Since the backend started serving the HLS variant playlist progressively while ffmpeg is still encoding, `video.duration` on first load reports only the portion of the playlist already written — sometimes as little as a minute. The player was writing that partial value into its duration state on `loadedmetadata`, which sized the film strip and scrub bar to the encoded portion instead of the full video, so scrubbing anywhere past the encode head was impossible. The player now prefers the scene's stored duration over `video.duration` (the DB value is always the true total) and also subscribes to the `durationchange` event so any later growth still flows through. Scrubbing past the encode head still defers the seek with the existing "still encoding" chip.
- **Video player dropdowns no longer overflow the screen on mobile.** The subtitle and quality menus in the scene player used to anchor inside the video's ~225px-tall container and open upward, so on phones they escaped both the top and sides of the viewport with no way to scroll or dismiss them. They now pop as viewport-anchored sheets on mobile (fixed position, horizontal insets, capped at 60vh with internal scrolling) and fall back to the original inline desktop layout at the `sm` breakpoint. Long subtitle track labels also truncate with an ellipsis instead of pushing the menu wider than the screen.

### Added

- **New "Reset metadata" button on the scene details page.** Clears the title (reverts it to the filename stem), details, date, rating, URL, studio, performers, and tags, deletes the `.nfo` sidecar so a follow-up scan cannot re-import the same stale data, and re-enqueues the probe and fingerprint jobs so the scene goes back through the standard pipeline. Markers, playback stats, generated previews, fingerprints, and the file on disk are all preserved — use this when a wrong scraper match has been accepted and you want to identify the scene from scratch without touching the media file. Exposed as `POST /scenes/:id/reset-metadata` on the API.

## [0.18.0] - 2026-04-11

### What's New

- Perceptual hash (pHash) generation and StashDB fingerprint contribution are now built in.
- A new pHashes tab on the Identify page lets you submit fingerprints to StashDB in bulk.
- Animated images (GIF, APNG, animated WebP) no longer break gallery scans.
- Legacy installs that were managed by drizzle-kit push now self-heal on upgrade.

### Fixed

- **Image thumbnail generation no longer fails on animated images during gallery scans.** ffmpeg's image2 muxer was rejecting multi-frame inputs (animated GIF/APNG, multi-frame WebP/TIFF) with `Cannot write more than one file with the same name. Are you missing the -update option or a sequence pattern?`. The worker now always passes `-frames:v 1 -update 1` when writing the JPEG thumbnail, so the first frame is extracted regardless of source format.
- **Legacy push-managed installs no longer 500 on scene detail / pHash / settings pages after upgrade.** The startup migrator's legacy-install bridge seeds every drizzle journal entry as "already applied" so the migrator treats the existing schema as the baseline — but that meant any schema added between push's last sync and the bridge never actually landed (missing `scene_subtitles.source_format`/`source_path`, `library_settings.generate_phash`, and the `fingerprint_submissions` table, depending on when you upgraded). A new `reconcileSchema` step runs after the migrator on every boot and idempotently re-applies those deltas, so broken legacy installs self-heal the next time they redeploy — no manual SQL required.

### Docs

- New `docs/phash-contribution.md` walks through the full pHash contribution pipeline: why we share Stash's exact sprite algorithm, the identify → accept → auto-link → submit flow, the GraphQL mutation shape, the cached-client rate-limiter design, and a troubleshooting section.

### Added

- **New "Perceptual hash (pHash)" toggle on the library settings page** and a "Backfill pHashes" button in the Diagnostics section. Flipping the toggle turns on pHash generation for all future fingerprint jobs; the backfill button enqueues a job for every existing scene that has a duration but no stored phash.
- **New "pHashes" tab on the Identify page.** Lists every scene that has at least one `stash_ids` link to a StashBox-protocol endpoint, paginated 25 at a time. Each row shows the scene's stash_id chips (with a delete button per chip and an inline "Add link" form to paste a new one), the available MD5/OSHASH/PHASH hashes as read-only badges, and per-(endpoint, algorithm) submission pills indicating success/error/pending state. A per-row **Submit** button and a top-level **Submit all** button drive fingerprint contributions; bulk submit fans out sequentially so the API-side per-endpoint rate limiter actually holds, and shows a live `{current}/{total}` counter during the run.
- **Identify now short-circuits when a scene is already linked.** `POST /stashbox-endpoints/:id/identify` first checks for an existing `stash_ids` row for the target endpoint. When one exists, it fetches the remote scene by ID and returns a `matchType: "stashid"` scrape result, skipping the fingerprint/title cascade entirely. If the upstream scene was deleted it falls through to the existing cascade so the user can re-link.
- **New `POST /stashbox-endpoints/:id/submit-fingerprints` route.** Submits every available fingerprint (md5/oshash/phash) on a scene to the remote endpoint, records the per-(algorithm, hash) result in `fingerprint_submissions`, and returns the per-algorithm outcome. Refuses when duration is 0 or when no `stash_ids` row links the scene. Serialized through the cached client's rate limiter so bulk submissions from the upcoming pHashes tab stay within the 240-rpm budget.
- **New `GET /phash-contributions` route.** Paginated list of scenes with at least one linked stash_id, joined with their hashes, their linked stash_id chips (with endpoint names), and their per-(endpoint, algorithm) submission history. Powers the pHashes tab.
- `StashBoxClient.findSceneById` (`FindSceneByID` query) and `StashBoxClient.submitFingerprint` (`SubmitFingerprint` mutation) in `@obscura/stash-import`, matching Stash's upstream schema shape. These are the building blocks for fetching a scene by its known remote ID and for contributing a single fingerprint back to a StashBox-protocol server.

### Changed

- **StashBox clients are now cached per endpoint in a process-wide map.** Previously each route handler `new`'d up a fresh `StashBoxClient`, so the internal 240-rpm token bucket was effectively reset on every request — bulk operations like identify-all could blow right past it. A new `apps/api/src/lib/stashbox-clients.ts` module hands out a cached instance keyed by endpoint UUID, invalidated on PATCH/DELETE so credential changes take effect immediately. Rate limiting now actually holds across concurrent requests, which is load-bearing for the upcoming fingerprint contribution bulk-submit flow.

- New `fingerprint_submissions` table tracking per-(scene, endpoint, algorithm, hash) contribution history to StashBox-protocol servers. Powers the pHashes tab's "already submitted" indicators and prevents accidentally re-submitting identical hashes.

### Changed

- **Accepting a StashBox identify result now auto-links the scene to its remote stash ID.** Previously the acceptance flow applied title/date/performer/tag metadata but silently dropped the remote scene ID, so no `stash_ids` row was ever created from an identify run — users would have to open the scene and paste the ID manually before they could ever contribute fingerprints back. Accept now inserts the `stash_ids` row inside the same transaction, keyed on `(scene, entityType, stashBoxEndpointId)` with `onConflictDoNothing`, so the scene is immediately eligible for fingerprint contribution.

### Added

- New **Generate pHash** library setting (default off). When enabled, the worker's fingerprint job also computes a Stash-compatible perceptual hash via the bundled `obscura-phash` helper. CPU-heavy — 25 ffmpeg frame extractions per scene — so it stays off until explicitly enabled.
- New `POST /jobs/phash-backfill` endpoint that enqueues a `fingerprint` job with `phashOnly: true` for every scene that has a known duration and no stored phash. Lets admins populate hashes for their existing library in one click after enabling the setting.
- `computePhash(filePath, duration)` helper in `@obscura/media-core` that shells out to the bundled `obscura-phash` binary and returns a 16-char hex perceptual hash. Returns `null` when duration is unknown or <= 0, and gracefully skips with a warning when the helper binary is missing on PATH (dev fallback).
- Bundled `obscura-phash` helper in the unified and worker Docker images. The binary computes perceptual hashes byte-compatible with Stash's `pkg/hash/videophash` pipeline (input-seek ffmpeg screenshots at 5% → 91.4% of duration, scaled to width 160, composed into a 5×5 NRGBA montage via `disintegration/imaging`, hashed via `goimagehash.PerceptionHash`). This is the foundation for contributing local fingerprints back to StashDB / ThePornDB — compatibility with the community phash index requires exact parity with Stash's sprite pipeline, which is why the helper lives outside Node.

## [0.17.0] - 2026-04-11
### Fixed

- **Clicking a tag chip from the scene detail page showed a UUID and listed every scene as tagged.** The tag chips rendered by `metadata-panel.tsx` and the view-mode tag list in `scene-edit.tsx` linked to `/tags/${tag.id}` (UUID), but the `/tags/[id]` route treats the path segment as the tag *name* and filters scenes/galleries/audio by that name. The UUID never matched a real tag name, so the header rendered the raw UUID and the listings fell back to unfiltered results. Both call sites now link to `/tags/${encodeURIComponent(tag.name)}`, matching the convention already used by the tags index and search result cards.
- **JASSUB worker wasn't actually loadable — `.ass` playback aborted at worker init.** The previous asset-copy step shipped `dist/wasm/jassub-worker.js` (the Emscripten-generated wasm loader, *not* the worker entry) as the workerUrl, and the real worker entry (`dist/worker/worker.js`) is an ES module with bare-specifier imports (`abslink`, `abslink/w3c`, `lfa-ponyfill`, the sibling wasm loader) that a browser cannot resolve when loaded as a static file. Replaced the copy step with an esbuild bundle: `apps/web/scripts/copy-jassub-assets.mjs` now runs esbuild over `jassub/dist/worker/worker.js` with `format: "esm"`, `bundle: true`, inlining every bare-specifier import into a single self-contained worker that JASSUB instantiates with `type: "module"`. The raw `.wasm` and `default.woff2` files are still copied alongside it for JASSUB's `wasmUrl` / `availableFonts` options. Added `esbuild` as a dev dependency of `@obscura/web` and put it under `onlyBuiltDependencies` in `pnpm-workspace.yaml` so pnpm runs its platform-binary postinstall.
- **`.ass` subtitles weren't actually going through libass — they fell back to the plain-text overlay.** The scene detail endpoint was hand-mapping `SceneSubtitleTrackDto` instead of delegating to the subtitles service, and when `source_format`/`source_url` were added alongside the JASSUB renderer it was never updated — so the client always received `sourceFormat: undefined` for tracks that came in from the initial scene fetch. The web player's JASSUB gate required `sourceFormat === "ass"/"ssa"`, silently never matched, and rendered the VTT fallback text in the generic caption box instead. Aligned the scene detail mapping with the subtitles service DTO, so `.ass`/`.ssa` tracks now actually reach the libass renderer.

### Changed

- **Subtitle track list shows the original format.** The transcript panel's track management row now renders a small format badge (VTT/SRT/ASS/SSA) next to the existing source badge, so at a glance you can tell which tracks will render through libass (ASS/SSA) vs the lightweight text overlay (VTT/SRT). The badge reflects the on-disk source file, not the normalized cue cache.

### Added

- **Advanced SubStation (.ass/.ssa) subtitles now render with full libass fidelity.** Previously .ass files were converted to plain WebVTT during ingest — all override tags were stripped, so positioning, fonts, colors, gradients, karaoke, fades, and `\move`/`\t` animations were silently lost and each cue showed as centered plain text in the generic caption box. The server now preserves the original .ass/.ssa file alongside the VTT fallback for every ingest path (sidecar discovery during library maintenance, embedded extraction via ffmpeg `-c:s copy`, and manual upload), and exposes it at a new `GET /scenes/:id/subtitles/:trackId/source` route. The web player loads [JASSUB](https://github.com/ThaUnknown/jassub) (libass compiled to WebAssembly, running in a Web Worker) on demand and hands it the raw file, so .ass subtitles now render through the real libass renderer with a canvas overlay synced to the video element — positioning, font references, per-character styling, karaoke timing, fades, movements, and typesetting all work. The existing parsed-cue pipeline is untouched, so the transcript panel still shows plain text. Non-ASS tracks continue to use the lightweight text caption overlay. JASSUB's worker/wasm/font assets are copied into `apps/web/public/jassub/` by a new `predev`/`prebuild` step so Next.js serves them as static files; the unified Docker image picks them up automatically. Added `source_format` + `source_path` columns to `scene_subtitles` in migration `0001_wandering_blue_shield.sql`, a new `readSubtitleSource` service method, and `SubtitleSourceFormat` / `sourceUrl` fields on `SceneSubtitleTrackDto`.

### Fixed

- **Subtitles now render reliably under HLS and across Direct↔HLS mode switches.** The player no longer renders `<track>` elements as children of `<video>` at all — that pipeline turned out to be fundamentally flaky under MSE playback (hls.js) because Chrome does not refetch text-track cues after the media element's source is swapped to a `MediaSource` blob URL, and hls.js's own `SubtitleTrackController` also touches `video.textTracks[*].mode`, which would clobber whatever we'd set. The overlay now fetches parsed cues directly from `GET /scenes/:id/subtitles/:trackId/cues` the moment the user selects (or auto-enables) a track, holds them in React state, and drives `activeCueText` off the video's `timeupdate` / `seeking` / `seeked` events with a linear scan for the cue overlapping `video.currentTime`. This removes every dependency on native text-track behavior, which makes subtitles work identically in Direct playback, adaptive HLS, a user-picked fixed HLS level, and when toggling back and forth between them mid-playback. The `subtitleAssetBase` prop on `<VideoPlayer>` is gone along with the `<track>` rendering, the cuechange subscription effect, and the subtitle-mode management effect.
- **"Off" in the CC menu now actually stays off.** Clicking "Off" set the controlled `activeSubtitleTrackId` to `null`, but the player's library-level auto-enable effect treated `null` as "nothing picked yet" and immediately re-selected the preferred track — so the menu flipped straight back on. The player now takes a new `subtitleChoiceLocked` prop; `scene-detail.tsx` sets it whenever the user explicitly picks a track *or* the saved per-scene localStorage preference is hydrated (including the `__off__` sentinel), and the auto-enable pass hard-stops in both cases. The saved preference is also now honoured on mount — switching scenes with no saved value still runs the auto-pick once, but scenes that were explicitly toggled off stay off.

### Changed

- **The docked transcript sidecar now collapses when subtitles are turned off.** Previously the left-docked transcript panel kept rendering even after the user clicked "Off" in the CC menu, showing a cue list for a disabled track while the video took less than full width for no reason. `isTranscriptDocked` now also requires `activeSubtitleId != null`, so disabling captions immediately gives the video back its full width and the transcript falls back into the tabbed layout; re-enabling a track restores the dock on desktop viewports. The height-mirroring layout effect now also re-runs on `activeSubtitleId` changes so the transition is synchronous instead of waiting for the ResizeObserver.

### Added

- **Unit tests for HLS rendition selection and the status tracker.** `packages/contracts/src/media.test.ts` now covers `getHlsRenditions` (1080p / 720p / 480p sources, very small sources that fall back to a single custom rendition, null/undefined defaulting to 720p, and immutability of the preset table). A new `apps/api/src/lib/hls.test.ts` exercises the status tracker directly with a stubbed builder: first-call pending + background build, cached-disk reuse without rebuilding, error propagation, concurrent callers coalescing to one build, and rendition visibility while still pending. `apps/api` gained its own `vitest.config.ts` and `pnpm test` script; the root vitest config now also includes `apps/*/src/**/*.test.ts` so `pnpm test` at the root runs everything.
- **New "Default playback mode" setting on the library settings page.** Lets you pick whether the video player boots a new scene in `Direct` streaming (the source file, fastest seeks, no transcode) or `Adaptive HLS` (the on-demand ffmpeg pipeline with bitrate switching). Defaults to `Direct` so existing behavior is preserved; stored on `library_settings.default_playback_mode` (text column, default `"direct"`). Exposed via `LibrarySettingsDto.defaultPlaybackMode` and the new `playbackModes` / `normalizePlaybackMode` helpers in `@obscura/contracts`, threaded from the settings page through `scene-detail.tsx` into `VideoPlayer` as a new `defaultPlaybackMode` prop. The player uses the setting only on initial source load — the quality menu still lets you override per-video.
- **Film-strip scrubbing in HLS mode now works past the currently-encoded range.** In progressive HLS, `video.seekable.end` only advances as ffmpeg writes more segments, so scrubbing the film strip to a position the encode hadn't reached yet previously did nothing (the browser silently clamped the `currentTime` assignment to the seekable boundary). `VideoPlayer.seekTo` now detects when the scrub target is beyond `video.seekable.end`, jumps the playhead to the latest available frame, and stores the desired position as a deferred target. A watcher effect re-seeks to the real target the moment the playlist grows to cover it. While waiting, the player surfaces a "Seeking to MM:SS · still encoding" chip in the top-left chip cluster so the user knows the scrub is queued, not lost. Deferred targets are cleared on any in-range scrub or source change.

### Changed

- **Settings page reorganized and fully auto-saves.** The settings page is now ordered by what the viewer actually interacts with first: Watched Libraries stays on top, followed by Content Visibility, Playback, and Subtitles (the viewer-facing controls), then Metadata Providers, Generation Pipeline, Generated Storage, and Diagnostics. The header's legacy `Reload`, `Run Scan`, and `Save Changes` buttons are gone — reloading is a browser action, the scan button lived in the wrong place (use the Scan page), and every setting on the page now commits immediately when you change it. `Scan Interval`, `Trickplay Interval`, `Preview Clip Length`, and `Background job concurrency` steppers each save on every click. `Thumbnail Quality` and `Trickplay Quality` sliders save on pointer-up / key-up so dragging doesn't spam the API. The per-setting dirty-tracking and `handleSaveSettings` / `handleRunScan` helpers were removed along with the buttons.
- **Database schema is now managed by versioned migrations instead of `drizzle-kit push --force`.** Every upgrade used to re-run drizzle-kit's schema push at container start, with `--force` bypassing the prompt that normally guards destructive drops — so any drift (a rename drizzle-kit couldn't infer, an unexpected constraint, anything) could silently destroy user data on upgrade. Replaced with a proper migration system: SQL files live under `apps/api/drizzle/`, drizzle-orm's migrator applies them once each against `drizzle.__drizzle_migrations`, and the Docker entrypoint now runs `apps/api/src/db/migrate.ts` instead of `drizzle-kit push`. The new `pnpm --filter @obscura/api db:migrate` / `db:generate` scripts replace `db:push` for anything that touches real data. The migration runner also bridges existing deployments that were originally provisioned via `drizzle-kit push` — on first run it detects the legacy state (core tables present, no `__drizzle_migrations` table), applies this release's pre-baseline deltas (the `default_playback_mode` column add and the `scene_markers.primary_tag_id` column drop, both of which `push` would have applied inline), and seeds the migrations table so the migrator treats the existing schema as the baseline and only runs *new* migrations on top. Baseline migration `0000_initial.sql` is committed alongside this change. Fresh installs build the full schema from the migration file; upgrades hit the bridge. CLAUDE.md gained a Database section documenting the new workflow and forbidding `db:push` against real deployments.
- **`scene_markers.primary_tag_id` was removed from the schema.** The column was never wired through the application and no code read or wrote it; drizzle-kit had been flagging it for removal on every push. Dropped cleanly via the new migration system.
- **HLS transcoding is now progressive and uses a dramatically faster ffmpeg preset.** Previously the `master.m3u8` request waited until the entire multi-rendition encode finished before anything was served, using `-preset slow` across every variant — easily minutes of wait on any non-trivial video, during which the player sat in a loading state with no way to know ffmpeg was still going. Changed the preset to `veryfast` (~10× faster for the same bitrate ceiling; CRF still bounds quality), switched the HLS playlist type from `vod` to `event` with `-hls_list_size 0` so segments append live and hls.js can re-poll the playlist mid-encode, and introduced a "partial ready" watcher in `apps/api/src/lib/hls.ts`: the tracker now flips to `ready` the moment `master.m3u8` and the first segment of each variant exist on disk, without waiting for ffmpeg to complete. ffmpeg continues in the background writing later segments while playback has already started. The segment route returns `503 Retry-After` instead of `404` for files that don't exist yet while the encode is active, so hls.js retries instead of treating a not-yet-written segment as a fatal error; variant playlists are served with `no-store` while encoding so the player re-fetches them to discover new segments. Added structured `[hls <id>]` log lines at every state transition (build kicked off, partial ready, ffmpeg complete, encode failed) so progress is actually observable in the API logs. The tracker gained an `isEncodeActive` flag driving all of this; if ffmpeg fails after the partial package was already served, the tracker stays `ready` (so an already-playing session isn't interrupted) but marks the encode dead so missing segments 404 instead of 503.
- **Manual quality switches in the video player are now immediate.** The player's quality-mode effect used to set `hls.nextLevel`, which only swaps at the next fragment boundary — the requested resolution wouldn't actually appear for several seconds after the click. Switched to `hls.currentLevel` (immediate with buffer flush) for explicit picks, so choosing "720p" from the quality menu takes effect right away. Also updated `activeQualityLabel` synchronously on the switch so the chip reflects the selection before `LEVEL_SWITCHED` fires.
- **The player status chip now distinguishes "Adaptive HLS" from a fixed HLS level.** Previously the chip said "Adaptive HLS" in both cases, which was misleading when the user had manually pinned a rendition. Auto mode still reads "Adaptive HLS"; a fixed-level selection reads "HLS".
- **Segment requests now use a hanging GET during active encoding instead of spamming 503s into the browser console.** hls.js pre-buffers segments ahead of the current playhead, so with progressive HLS readiness the client almost always asked for segments that ffmpeg hadn't written yet. The `/stream/:id/hls/*` route now holds the request for up to 30 seconds, polling the filesystem at 200ms intervals, and returns the segment as soon as it appears on disk (with a 25ms stabilization wait to avoid streaming a half-written file). 503 is only returned if the wait actually times out or the encode dies — so the devtools network tab stays clean during normal playback.

## [0.16.0] - 2026-04-11

### Fixed

- **HLS "Auto" quality no longer stalls and silently drops back to direct playback.** The API's `master.m3u8` route used to block the HTTP response on the entire ffmpeg transcode, so for any non-trivial video hls.js hit its manifest-load timeout before ffmpeg finished and the player fell back to direct playback. The route is now non-blocking: the new `GET /stream/:id/hls/status` endpoint reports package state (`idle` / `pending` / `ready` / `error`) along with the rendition list, and `master.m3u8` / segment requests return `503 Retry-After: 2` while a transcode is in progress instead of hanging. The player polls `/hls/status` before handing the master URL to hls.js so the first request only fires once the package is ready. The backend coalesces concurrent callers onto a single ffmpeg invocation via the per-scene lock and surfaces errors in a tracker so later callers don't re-enter a doomed build.
- **Resolution presets now show in the quality menu before the user picks "Auto".** Previously the 480p / 720p / 1080p etc. entries were only populated inside hls.js' `MANIFEST_PARSED` handler, which never fired until the user switched to HLS mode — so the dropdown looked empty until you committed to adaptive. The player now calls `/hls/status` as soon as the source changes and seeds the quality menu with the real rendition list returned from the server. Clicking a seeded rendition switches into HLS mode and, once the manifest parses, reconciles the pick to the matching hls.js level index so the target resolution is actually applied. Also fixed a race where the auto-mode effect ran before `hlsRef.current` existed and silently no-opped; auto/explicit level selections are now re-applied inside `MANIFEST_PARSED`. hls.js is configured with expanded manifest/playlist retry budgets as a safety net for slow transcodes.
- **Audio total tracks, duration, and "This Week" now exclude NSFW library tracks.** `getAudioLibraryStats` previously filtered tracks only by `audioTracks.isNsfw`, which missed tracks that live inside a library flagged as NSFW but aren't themselves individually flagged — so in SFW mode the library count dropped but the track / duration / recent-added cards still counted hidden libraries' tracks. Rewrote the query to left-join `audio_libraries` and filter on both `audioTracks.isNsfw = false` AND `audioLibraries.isNsfw = false`. Also switched the "This Week" card to count recent *tracks* (joined to the library for the NSFW filter) so it matches the rest of the strip instead of counting recent libraries.
- **Audio stat cards now respect the NSFW mode.** The Libraries / Total Tracks / Total Duration / This Week cards on the Audio index are hydrated from `fetchAudioLibraryStats(nsfwMode)` — the server page reads the `obscura-nsfw-mode` cookie and passes it through, and the client also refetches stats whenever the NSFW mode toggles, matching the Scenes behavior. In SFW mode the totals now exclude NSFW-flagged libraries and tracks instead of still counting hidden content. Added a client-side `fetchAudioLibraryStats` helper in `apps/web/src/lib/api/media.ts` so the refetch doesn't have to go through the server API layer.

## [0.15.0] - 2026-04-11
### Changed

- **Audio page now matches the Scenes layout and NSFW handling.** The Audio index header has been rebuilt around the same four-stat card strip used on Scenes (Libraries, Total Tracks, Total Duration, This Week), replacing the old inline "1 libraries · 5 tracks" summary line so the totals read consistently across sections. Every audio library card in the grid now renders the same `NsfwShowModeChip` flame badge in the bottom-right of its thumbnail whenever the library is marked NSFW and the app is in Show mode, mirroring scene cards. On the audio library detail page the cover art wears the same flame badge, a red `NsfwChip` now appears inline with the track count / duration row, and the sub-library grid at the bottom of the page pushes each child through `NsfwBlur` + flame chip like the root grid. Track count and total duration — both in the hero row and the Library Info side panel — now count only the tracks visible under the current NSFW mode, so filtered tracks stop showing up in the totals alongside a track list that hid them.

- **Reworked the build and release process.** `latest` now always resolves to the most recent tagged release instead of the tip of `main`, so users pinning `:latest` only ever move forward when a real version is cut. Every push to `main` now builds a `:dev` image (plus `:sha-<short>` and `:<version>-<short>` per-commit tags) via the new `publish-dev.yml` workflow, leaving `:latest` alone. Releases are cut server-side by a new `release.yml` workflow: pick a bump (`patch` / `minor` / `major`) or an explicit version in the Actions UI and it bumps every `package.json`, promotes `## [Unreleased]` in `CHANGELOG.md` to `## [X.Y.Z] - YYYY-MM-DD`, commits + tags, pushes a post-release `X.Y.(Z+1)-dev` marker back to `main`, builds the unified image with `RELEASE_STRICT=1`, publishes it as `latest` / `X.Y.Z` / `X.Y` / `X`, and creates a GitHub Release whose body is the extracted changelog section. Versions no longer bump on every commit — between releases the repo carries a `-dev` pre-release marker (starting at `0.14.0-dev`). `pnpm release:check` now accepts `-dev` versions in non-release mode and still enforces a matching CHANGELOG heading when called with `--release` (the Dockerfile gates this on a new `RELEASE_STRICT` build arg). Added `scripts/release/cut.mjs` which owns all version-bumping and changelog-rewriting logic and is callable locally for dry runs (`pnpm release:cut --phase release --bump minor --dry-run`).

### Docs

- **README and CLAUDE.md now document the new release process.** README has an `Image tags` table explaining `latest` / `X.Y.Z` / `dev` / `sha-…` / `X.Y.Z-…`, a new `Releases` section at the bottom of Development walking through the workflow step by step, and an updated "Building the Docker Image Locally" block showing both dev and release build modes. CLAUDE.md's Commit & Changelog Policy is rewritten to forbid per-commit version bumps, describe the `-dev` marker convention, and include a step-by-step "How to publish a release" runbook plus release-notes discipline rules.

## [0.13.0] - 2026-04-10

### Added

- **Subtitle transparency slider.** A new Transparency control lives in both the in-player subtitle style side panel and the global settings Subtitles section, letting the user dial the entire caption layer (background plate, text, glow, and stroke) from 20% to 100% opacity. Applied via inline `opacity` on the overlay wrapper so it composes cleanly with the three existing display styles — at low values the Stylized and Classic plates fade against the video without the text becoming harder to read than the surrounding styling; at full opacity everything renders exactly as before. Persisted as `subtitle_opacity` on `library_settings` (clamped server-side to `[0.2, 1]`), mirrored in `SubtitleAppearance.opacity` on the contracts, saved into the per-user localStorage override, and reflected live in the settings page's dummy-frame preview.

## [0.12.2] - 2026-04-10

### Fixed

- **CC chip now renders on the grid scene cards next to the resolution.** In 0.12.0 the chip was added to the `SceneGridCard` JSX inside `apps/web/src/components/scenes/scene-card.tsx`, but that code path is only used for the list variant — the primary grid layout uses the shared `MediaCard` component in `@obscura/ui/composed/media-card.tsx`, which has its own top-right chip row for resolution + codec. Added a `hasSubtitles` prop to `MediaCard` and render a brass-tinted "CC" media chip as the first item in that top-right group so it sits alongside `1080p` and `H264` on every card where subtitles exist. Threaded the flag through from `scene-card.tsx` → `MediaCard`. The list-variant chip on the smaller list thumbnail stays put — it's the right placement for that layout.

## [0.12.1] - 2026-04-10

### Fixed

- **Docked transcript now truly tracks the video's height in both directions.** The previous fix used `lg:items-stretch` on the flex row to get the resize handle to stretch, but that created a feedback loop: whenever the transcript's intrinsic content was taller than the video's natural `aspect-video` height, stretch inflated the video wrapper, the `ResizeObserver` reported the inflated height, and the transcript locked at the wrong (too-tall) value. Switched back to `lg:items-start` so the video keeps its natural height, and explicitly pinned both the resize handle and the transcript side to `videoWrapperHeight` via inline `style.height`. The transcript now shrinks and grows in lock-step with the video as the window is resized, the dock handle is dragged, or a smaller-native-resolution scene is opened — even if that means a short transcript panel on a cropped-aspect video.
- **Dock toggle no longer flashes at the old height.** Moved the initial measurement from `useEffect` to `useLayoutEffect` and do a synchronous `getBoundingClientRect()` read before setting state, so the first paint of the docked layout already has the handle and transcript pinned. The effect also re-runs on `userWantsDock` / `isDesktopViewport` changes so toggling dock or crossing the `lg` breakpoint re-measures synchronously before paint, avoiding a frame where the old height leaks into the new layout.

## [0.12.0] - 2026-04-10

### Added

- **CC chip on scene cards.** Scenes that have at least one subtitle track now show a small "CC" chip in the lower-right corner of their thumbnail, above the duration badge. The scene list API runs a single `SELECT DISTINCT scene_id FROM scene_subtitles WHERE scene_id IN (...)` per page (no N+1) and sets `hasSubtitles` on each `SceneListItem` / `SceneDetail` DTO. The chip is brass-tinted and matches the Dark Room language.

### Fixed

- **Caption overlay no longer covers the player controls.** The custom subtitle caption plate was rendered with `z-10` inside the player container, which painted it above the bottom control bar whenever a cue was active at the default 88% vertical position. Removed the z-index entirely so stacking now follows DOM order — the caption sits naturally below both the top and bottom control layers, which come later in the tree, so play/pause, timestamp, and the quality/captions dropdowns are always visible when surfaced.
- **Docked transcript resize handle is visible and grabbable again.** When the dock layout switched to `lg:items-start` in 0.11.1 (to stop a tall transcript from growing the row), the resize handle collapsed to zero height because it had no intrinsic content. Switched back to `lg:items-stretch` — safe now that the transcript side has an explicit pinned height tied to the video wrapper — and made the handle itself more visible: wider hit target (`w-2`), a darker default background, and a centered 2px vertical pill indicator that brightens to the brass accent on hover and drag.

## [0.11.3] - 2026-04-10

### Added

- **Screenshots for the Subtitles & Live Transcripts README section** are now in place under `docs/screenshots/` — `scene-detail-transcript-docked.png`, `scene-detail-subtitle-style-panel.png`, `scene-transcript-tab.png`, and `settings-subtitles.png`.

### Fixed

- **Transcript dock preference is now ignored below the `lg` (1024px) breakpoint.** Previously, if the user had enabled the docked sidecar on desktop and then opened a scene on their phone, the Transcript tab still rendered in its "docked" state (showing only the tracks management + a banner) — which left the mobile user with no transcript at all, since the sidecar itself is `hidden lg:flex`. The scene detail now watches `matchMedia("(min-width: 1024px)")` and treats the dock as fully off below that threshold, so on mobile the Transcript tab always renders the full panel regardless of the persisted preference. The preference is untouched — move back to a desktop viewport and the sidecar returns automatically.

## [0.11.2] - 2026-04-10

### Docs

- **README: new Subtitles & Live Transcripts section** documenting the full subtitle feature set — sidecar discovery, embedded extraction, manual upload, the transcript tab, desktop dock mode with resize, three caption styles (Stylized / Classic / Outline), the in-player style panel, and library-wide defaults with live preview. Added a "Subtitles & live transcripts" bullet to the Highlights list. Four new screenshots referenced: `scene-transcript-tab.png`, `scene-detail-transcript-docked.png`, `scene-detail-subtitle-style-panel.png`, and `settings-subtitles.png`.

## [0.11.1] - 2026-04-10

### Fixed

- **Docked transcript sidecar is now pinned to the video's height.** Previously the flex row used `items-stretch` and the transcript's intrinsic height (tall cue list) would grow the whole row, pushing the video taller than its natural aspect-ratio height. A `ResizeObserver` on the video wrapper now mirrors its measured height onto the sidecar as an explicit `height` style, and the row uses `items-start` so nothing stretches. The transcript cue list scrolls internally within that bound, keeping the video locked at its natural size.

## [0.11.0] - 2026-04-10

### Added

- **Dockable transcript sidecar on desktop.** The transcript panel can now be pinned next to the video for live reading while you watch. A "Dock next to video" button appears in the Transcript tab's track management header (desktop only, and only on scenes that have subtitle tracks). When docked, the video takes 80% of the row by default and the transcript fills the rest; a 1.5px drag handle between them lets you resize (clamped to 40–92% video width). The dock preference and last-used width are persisted in `localStorage`, so the preference follows you across scenes — when you open a scene without subtitles the sidecar auto-collapses to full-width video, and when the next scene has subtitles the sidecar reappears at your chosen width automatically. The sidecar has its own undock button, and while it's active the Transcript tab shows a banner plus the track management controls (upload/extract/rename/delete) without duplicating the scrolling transcript.

### Changed

- `SceneTranscriptPanel` now accepts a `variant` prop (`"full" | "tracks-only" | "list-only"`) so the same component can render as the normal tab view, the management-only header when docked, or the full-height scrolling list in the sidecar. The transcript cue list uses flex layout with `min-h-0` to fill the container height in list-only mode.

## [0.10.1] - 2026-04-10

### Fixed

- **Transcript auto-scroll now truly centers the active cue.** The previous fix used `el.offsetTop` relative to the list container, which is only correct when the container is the element's `offsetParent` — it wasn't, so the active line landed at an arbitrary position inside the visible area instead of the middle. Switched to `getBoundingClientRect()` delta math so the active cue is reliably centered regardless of positioning ancestry.

## [0.10.0] - 2026-04-10

### Added

- **Library-level subtitle defaults and three display styles.** New Subtitles section in global settings lets you toggle auto-enable-on-load, set a preferred-language priority list (e.g. `en,eng,en-US` — first match wins, with ISO 639-1↔639-2 equivalence so `en` also matches `eng`), and pick between three visual styles for caption rendering: **Stylized** (Dark Room brass-edged plate — previous look), **Classic** (flat translucent-black box with plain white text), and **Outline** (white text with black stroke, no box). Text size and vertical position are controllable via sliders. The settings section includes a live dummy-frame preview that updates in realtime as you tweak the controls.
- **In-player subtitle style panel.** The Captions dropdown in the video player now has a "Subtitle style…" item that opens a side panel over the video for editing style, text size, and vertical position inline — you see the change immediately on top of whatever is playing. Per-user overrides persist in `localStorage` and override the library defaults; a "Reset to library defaults" button clears them.
- **Rename subtitle tracks.** Tracks in the Transcript tab now have a pencil icon next to the delete icon; clicking opens an inline editor for the language code and display label, saved via new `PATCH /scenes/:id/subtitles/:trackId`. Great for cleaning up ffmpeg-extracted tracks that only have generic titles.
- **Language shown alongside label.** Both the in-player captions dropdown and the Transcript tab's track list now display the resolved language name (via `Intl.DisplayNames`) in addition to any custom label — e.g. `English — SDH` instead of just `SDH`.

### Fixed

- **Transcript auto-scroll no longer moves the page viewport.** Previously the active-cue `scrollIntoView` call would bubble up and scroll the whole page, pushing the video out of view while watching with the transcript tab open. Auto-scroll is now computed manually against the list container's `scrollTop` so only the transcript scrolls — the video stays put. Manual user scrolling still pauses auto-scroll for 3 seconds, and programmatic scrolls are flagged so they don't trip the user-scroll cooldown.

## [0.9.0] - 2026-04-10

### Added

- **Multi-language subtitles end-to-end.** Obscura now loads, renders, and manages subtitle tracks for videos in any supported language. Three ingestion paths are wired up: sidecar discovery during library scan (`movie.en.srt` / `movie.ja.vtt` / etc. next to the video file), manual upload from the scene detail page (accepts `.vtt`/`.srt`/`.ass`/`.ssa`, converted to WebVTT on ingest), and embedded-track extraction via a new `extract-subtitles` worker queue that runs ffmpeg to pull soft-subtitle streams out of `.mkv`/`.mp4` containers. Extraction auto-runs after media probe and can be re-triggered from the scene UI. Image-based subtitle codecs (PGS/VobSub) are skipped gracefully.
- **Player subtitle rendering and selector.** The video player now renders a captions toggle in the control bar (next to quality/speed) listing every available track with language and source chip. The selected track drives a custom Dark Room caption overlay — opaque plate, brass edge glow, text-shadow — positioned above the controls instead of the browser's default white-box renderer. "Off" disables captions. The active language is persisted per-scene in `localStorage`.
- **Transcript tab on scene detail.** A new "Transcript" tab shows the full cue list for the active subtitle track. Past cues are grayed but still clickable, the current cue is highlighted with a brass border and glow, and upcoming cues render normally. Clicking any line seeks the player to that cue. The active line auto-scrolls into view (with a short pause after manual user scrolling so it doesn't fight you). The tab also hosts track management: language picker, upload control, "Extract embedded" button, and per-track delete.
- New `scene_subtitles` table with a unique `(scene_id, language, source)` index, and a new `SceneSubtitleTrackDto` / `SubtitleCueDto` in `@obscura/contracts`.
- New API routes: `GET/POST /scenes/:id/subtitles`, `GET/DELETE /scenes/:id/subtitles/:trackId`, `GET /scenes/:id/subtitles/:trackId/cues`, `POST /scenes/:id/subtitles/extract`.
- WebVTT as the canonical on-disk format; SRT and ASS/SSA are converted at ingest by pure-TS helpers in `@obscura/media-core/src/subtitles.ts` so the frontend only ever deals with one parser.

## [0.8.21] - 2026-04-10

### Docs

- **Rewrote `README.md` as a visuals-focused tour of the app.** Added a `docs/screenshots/` folder with desktop and mobile captures of the dashboard, scenes, scene detail (player + frame strip + metadata), galleries, audio library overview and detail, performers, studios, tags, bulk identify, community scrapers, global search, settings, and job control. Positioned Obscura as a modern, mobile-first alternative for users who want the Stash-style private library experience with a refined UI. Highlighted SFW/NSFW mode with global shortcut + hidden mobile gesture, first-class mobile support, native StashDB + community scraper support, bulk scraping across all installed scrapers, rich playback with scrollable frame strip and marker/thumbnail generation, gallery and audio libraries, flexible cache location (per-root or dedicated), automated periodic scanning, global search and command palette, HLS transcoding, and drag-and-drop uploads.

## [0.8.20] - 2026-04-10

### Fixed

- **Library NSFW flag now applies to all media under that root** — Toggling a library root’s NSFW setting updates every scene, image, gallery, audio library, and audio track whose files live under that path (not only videos). Gallery and audio rescans also refresh `isNsfw` on existing rows so it stays aligned with the root. Clearing NSFW on a root still recomputes each scene from tags, performers, and studio; other media types under the root are cleared to non-NSFW.
- Tag and studio deletion now detaches foreign-key references before removing the row (see [0.8.19]).

## [0.8.19] - 2026-04-10

### Fixed

- **Deleting tags failed when the tag was a parent or still linked to content** — `tags.parent_id` has no `ON DELETE` rule, and some databases may lack `ON DELETE CASCADE` on join tables. `deleteTag` now clears child `parent_id`, removes all `scene_tags` / `performer_tags` / `gallery_tags` / `image_tags` / `audio_library_tags` / `audio_track_tags` rows for that tag, then deletes the tag.
- **Deleting studios failed while scenes or other entities still referenced them** — Foreign keys from `scenes`, `galleries`, `images`, `audio_libraries`, and `audio_tracks` block studio removal. `deleteStudio` now nulls those `studio_id` values (and child `parent_id` on studios) in a transaction before deleting the studio row.

## [0.8.18] - 2026-04-10

### Fixed

- **nginx `client_max_body_size 20m` silently rejected large video uploads** — The unified Docker image's nginx reverse proxy had a 20 MB body limit, which would cause large video uploads to fail at the nginx layer before they ever reached Fastify. Raised to 21 GiB to match the API's `OBSCURA_MAX_VIDEO_UPLOAD` default.
- **`/assets/` paths not routed to the API in Docker** — Requests for static assets (thumbnails, waveforms, covers, HLS segments) sent to a path starting with `/assets/` without the `/api/` prefix were falling through to Next.js, returning 404. Added an explicit `location /assets/` block in nginx.conf that proxies directly to Fastify.
- **Broken-image boxes for audio library cover art** — When a cover image path is stored in the database but the underlying file no longer exists on disk (e.g., after a cache volume is recreated), the browser's `<img>` element would render a broken-image icon inside the cover box. Added `onError` handlers to all audio library cover images (grid cards, detail sidebar, child sub-library cards, and the audio player album art slot) that hide the failed image and reveal the gradient/icon fallback behind it.

## [0.8.17] - 2026-04-10

### Fixed

- **`<Checkbox>` not showing the checked state in the scenes list view** — The primitive rendered the checked/unchecked visual through Tailwind's `peer-checked:` sibling selectors plus an arbitrary-variant chain (`peer-checked:[&>svg]:opacity-100`), which is fragile: the combinator occasionally escapes Tailwind v4's class scanner when the component ships from a workspace package, and the CSS `:checked` state can desync from the controlled React `checked` prop for a frame when the checkbox is nested in interactive wrappers like the `<Link>` scene list row. Reworked the primitive to drive the box background, border, glow, and check-mark visibility directly from the `checked` prop via `cva` state variants. Behavior is otherwise unchanged — same DOM shape, same click surface, same indeterminate support — but the selected state now renders reliably the instant the prop flips.

## [0.8.16] - 2026-04-10

### Fixed

- **Scenes drag-and-drop not firing** — The drop zone only called `preventDefault` when `dataTransfer.types.includes("Files")` succeeded, which silently failed in browsers where `types` is a `DOMStringList` (no `.includes`, only `.contains`). Replaced with a portable index loop and added a document-level `dragover` + `drop` safety net that swallows stray drops so they never navigate the tab to the file. Scenes now reliably accept dropped videos on the `/scenes` grid.

### Added

- **Audio main view drag-and-drop + Import** — The top-level `/audio` page is now wrapped in `<UploadDropZone>` and has an `<ImportButton>` in the header, mirroring the scenes flow. Because the main view has no implicit library context, uploads surface a new `<AudioLibraryPicker>` modal (with a search filter for users who have many libraries) when there is more than one audio library; single-library case auto-picks silently. Per-library detail pages continue to upload directly into their own folder without the picker.
- **`AudioLibraryPicker` component** — New modal listing available audio libraries with a live filter box, used by both `<UploadDropZone>` and `<ImportButton>` via `useUploader`.

### Changed

- **`useUploader` hook** — `{ kind: "audio" }` targets now accept an optional `audioLibraryId` (previously required); when omitted the hook fetches `/audio-libraries?limit=500`, auto-picks when exactly one library exists, and otherwise surfaces `candidateAudioLibraries` so the caller can render the picker. Mirrors the existing scene root resolution path.

## [0.8.15] - 2026-04-10

### Added

- **`ConfirmDeleteDialog` — broader entity coverage + opt-in disk-delete** — The dialog now recognises `image`, `audio-track`, `gallery`, and `audio-library` entity types alongside the existing `scene` / `performer` / `studio` / `tag`, and exposes an explicit `allowDeleteFromDisk` prop instead of hard-coding the two-button layout to scenes. Scene call sites pass `allowDeleteFromDisk` to keep their legacy UX; new integrations opt in when they want the "also unlink source" affordance.
- **Image delete from the lightbox** — The image lightbox toolbar gains a trash-can button that opens `ConfirmDeleteDialog` (with the disk option enabled) and calls `DELETE /images/:id`. After a successful delete the lightbox advances to the next image (or closes if the gallery is now empty) and the parent gallery's state updates through a new `onImageDeleted` callback on `<ImageLightbox>`.
- **Audio track delete from the track list** — Track rows on audio library detail pages show a hover-reveal trash button that opens the generalised delete dialog and calls `DELETE /audio-tracks/:id`. Local library state removes the track immediately; the generated waveform/cover dir is cleaned up server-side and the source file is optionally unlinked.
- **`deleteImage()` / `deleteAudioTrack()` web API helpers** — New thin wrappers in `apps/web/src/lib/api/media.ts` mirroring the existing `deleteScene()` signature with an optional `deleteFile` flag.

## [0.8.14] - 2026-04-10

### Added

- **Audio library detail drag-drop + Import** — Audio library detail pages with a `folderPath` now wrap the main content in `<UploadDropZone>` and show an `<ImportButton>` next to the "Tracks" section header. Drop any audio files on the page and they land inside the library's folder; each file's `audio-probe` → `audio-fingerprint` → `audio-waveform` pipeline kicks off immediately so the new track shows up with duration, peaks, and metadata on the next refresh. The fixed-position audio player sits outside the drop zone so it keeps receiving drag events for its own controls.

## [0.8.13] - 2026-04-10

### Added

- **Gallery detail drag-drop + Import** — Folder-backed galleries (`galleryType === "folder"`) now show an `<ImportButton>` in the detail header and accept drag-dropped image files anywhere in the gallery view. Uploaded images land in the gallery's `folderPath` and get `image-thumbnail` + `image-fingerprint` jobs automatically so thumbnails materialise without a rescan. Zip and virtual galleries leave the affordance hidden — they have no on-disk folder to write into.

## [0.8.12] - 2026-04-10

### Added

- **Scenes page drag-drop + Import** — The `/scenes` view is now wrapped in `<UploadDropZone target={{ kind: "scene" }}>` and gains an `<ImportButton>` in the header. Drop any video files onto the grid (or click Import) and they land in the selected library root; when more than one enabled root has `scanVideos = true`, a picker modal appears. After each upload finishes the page calls `router.refresh()` so the new scene appears in the grid as soon as the scene row is inserted, and the standard `media-probe` → `fingerprint` → `preview` pipeline runs in the background.

## [0.8.11] - 2026-04-10

### Added

- **`apps/web/src/components/upload/*`** — New reusable upload primitives backing the upcoming drag-drop + Import button integration across library views. `UploadDropZone` wraps any page and shows a sharp-cornered "Drop to add" overlay while a drag is active, plus a dismissable status strip that reports per-file success/failure. `ImportButton` opens a native file picker for the same flow. `useUploader` is the shared orchestration hook — it handles the scene upload's multi-root resolution (auto-picks when only one library root has `scanVideos = true`, otherwise surfaces `<LibraryRootPicker>` for a choice), runs uploads sequentially (stable on home LANs), and tracks per-file state for the status strip. No page integrations yet — follow-up commits mount these primitives on the scenes, gallery, and audio library detail views.

### Changed

- **`uploadFile()` in `apps/web/src/lib/api/core.ts`** — Now takes an optional `extraFields` object that is appended to the `FormData` body BEFORE the file part. The scene upload endpoint needs `libraryRootId` to be present when the file stream starts, so order matters here; the helper forwards the object directly to `FormData.append` so the server-side iteration order matches.

## [0.8.10] - 2026-04-10

### Added

- **`POST /audio-libraries/:id/tracks/upload`** — Multipart endpoint that imports an audio file into an audio library's `folderPath` and creates the matching `audio_tracks` row. Bumps the parent library's denormalized `trackCount`, inherits `isNsfw` from the parent, and enqueues the standard `audio-probe` → `audio-fingerprint` → `audio-waveform` pipeline so the new track gets duration / sample rate / waveform peaks without a rescan.
- **`DELETE /audio-tracks/:id`** — Single-track delete endpoint (previously only markers had a DELETE route). Cascades `audioTrackPerformers` / `audioTrackTags` / `audioTrackMarkers` via FK, decrements the parent library's `trackCount`, removes the generated waveform/cover dir under `getGeneratedAudioTrackDir(id)`, and accepts `?deleteFile=true` to also unlink the source file.

## [0.8.9] - 2026-04-10

### Added

- **`POST /galleries/:id/images/upload`** — Multipart endpoint that imports an image into a folder-backed gallery. Streams straight to disk under the gallery's `folderPath`, creates the `images` row, bumps the parent gallery's denormalized `imageCount`, and enqueues the standard `image-thumbnail` + `image-fingerprint` pipeline so the new image picks up a thumbnail and fingerprint without a rescan. Rejects zip and virtual galleries (no on-disk folder). Inherits `isNsfw` from the parent gallery.
- **`DELETE /images/:id`** — Single-image delete endpoint (previously only bulk delete via PATCH was available). Cascades `imagePerformers` / `imageTags` via FK, removes the generated thumbnail directory under `getGeneratedImageDir(id)`, decrements the parent gallery's `imageCount`, and accepts `?deleteFile=true` to also unlink the source file from disk (refused on zip members).

## [0.8.8] - 2026-04-10

### Added

- **`POST /scenes/upload`** — New multipart endpoint that imports a video file into a selected library root and creates the matching `scenes` row. Expects a `libraryRootId` form field (sent before the file by the web client) and the file itself; streams the upload straight to disk (no `toBuffer()`), uses a collision-safe destination filename, copies the library root's NSFW flag onto the new scene, and immediately enqueues the standard `media-probe` → `fingerprint` → `preview` pipeline so the user does not need to trigger a rescan to get metadata, thumbnails, sprites, or trickplay. Returns `UploadSceneResponseDto`. Rejects disabled roots, roots with `scanVideos = false`, missing target directories, and anything that fails the shared upload validator.
- **`apps/api/src/lib/job-enqueue.ts`** — Extracted `hasPendingJob`, `withTriggerMetadata`, and `enqueueQueueJob` out of `apps/api/src/routes/jobs.ts` so service-layer code (starting with the scene upload) can queue worker jobs without reaching into a route file. Behavior is identical; `routes/jobs.ts` continues to use its existing private helpers in this commit.

### Changed

- **`apps/api/src/index.ts`** — Raised the global `@fastify/multipart` `fileSize` cap from 10 MiB to 20 GiB so video imports can stream through. Per-category enforcement (20 GiB video, 100 MiB image, 1 GiB audio, each overridable via `OBSCURA_MAX_{VIDEO,IMAGE,AUDIO}_UPLOAD`) lives in `apps/api/src/lib/upload.ts` so smaller categories still reject oversized uploads.

## [0.8.7] - 2026-04-10

### Changed

- **`GET /libraries`** — Now accepts optional `scanVideos`, `scanImages`, `scanAudio`, and `enabled` query params (each parsed as `true`/`false`/`1`/`0`). Used by the upcoming scene upload flow to enumerate roots that are eligible targets for video uploads; missing params preserve the prior "return everything" behavior so existing callers are unaffected.

## [0.8.6] - 2026-04-10

### Added

- **`apps/api/src/lib/upload.ts`** — Shared multipart-upload helper used by the upcoming scene/image/audio upload endpoints. Provides category-scoped allow-lists (video, image, audio) with mime + extension validation, `OBSCURA_MAX_{VIDEO,IMAGE,AUDIO}_UPLOAD` env overrides on the default size caps (20 GiB / 100 MiB / 1 GiB), filename sanitisation that rejects directory traversal, a collision-safe destination resolver (`name.ext` → `name (1).ext` → …), an `assertDirExists` guard that returns a clear 400 when the target folder is missing, and a `streamToFile` helper that pipes `@fastify/multipart` streams directly to disk (no `toBuffer()` so large videos do not OOM), cleaning up partial writes on error or truncation.

## [0.8.5] - 2026-04-10

### Added

- **`@obscura/contracts`** — New upload route constants (`sceneUpload`, `galleryImageUpload`, `audioLibraryTrackUpload`) and DTOs (`LibraryRootSummaryDto`, `UploadSceneResponseDto`, `UploadImageResponseDto`, `UploadAudioTrackResponseDto`) to back the upcoming in-app file-import UI. No behavior yet — these just pre-declare the API surface that subsequent commits will fill in.

## [0.8.4] - 2026-04-10

### Fixed

- **Dev startup** — API and worker crashed on boot with `DATABASE_URL must be set for pg-boss` when started from a plain dev shell (`tsx watch` doesn't auto-load `.env`, and the old BullMQ code had a `redis://localhost:6379` fallback that masked the same problem). The pg-boss facades in `apps/api/src/lib/queues.ts` and `apps/worker/src/lib/queues.ts` now fall back to `postgres://obscura:obscura@localhost:5432/obscura` — the same default used by the drizzle client — so both services come up against the dev docker-compose Postgres without any environment plumbing. With the API alive again, the cascading `TypeError: fetch failed` / `ECONNREFUSED` errors in the web app's server-rendered routes go away.

## [0.8.3] - 2026-04-10

### Fixed

- **`.gitignore`** — `.vscode/` was ignored wholesale, which silently dropped the `.vscode/tasks.json` referenced in 0.8.1 and 0.8.2's changelog entries (the commits updated docs and versions but never actually checked in the file). Now ignores `.vscode/*` with explicit allowlist for `launch.json`, `tasks.json`, `settings.json`, and `extensions.json` so shared dev configs travel with the repo.

### Added

- **`.vscode/launch.json`** — Single `Obscura: Full Stack` launch configuration that runs `pnpm dev` with `Obscura: Docker Up` as the preLaunchTask. Replaces the workspace-level launch so the full-stack dev command travels with the repo (appears as `(folder)` in the Run & Debug picker whenever this folder is loaded — standalone or inside a multi-root workspace).
- **`.vscode/tasks.json`** — Single `Obscura: Docker Up` task that boots just the Postgres container (consumed by the launch config above as its preLaunchTask).



### Changed

- **`.vscode/tasks.json`** — Collapsed to a single `Obscura: Full Stack` task that chains Postgres startup, drizzle schema push, and `pnpm dev`. Removed the individual infra / stop / db / dev tasks; run those manually from the terminal when needed.

## [0.8.1] - 2026-04-10

### Fixed

- **Docs & dev tooling** — `README.md` and `docs/architecture.md` still told contributors to start a `redis` service alongside Postgres, which failed with `no such service: redis` after 0.8.0 removed Redis from `docker-compose.yml`. Documentation now reflects the pg-boss architecture.

### Added

- **`.vscode/tasks.json`** — Versioned VS Code tasks for `Obscura: Start infra (Postgres)`, `Stop infra`, `Apply DB schema`, and `Dev (all services)`, so the dev workflow is checked in and does not depend on each machine's personal workspace config.

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
