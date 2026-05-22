# Changelog

Important user-facing changes are documented here. This changelog is intentionally curated and high level; use the git history for commit-by-commit detail.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]
### What's New
- People now replaces Actors across the app navigation and browse experience, including the canonical `/people` route for person profiles.
- Entity thumbnail titles now wrap to two lines instead of scrolling on a single line, making longer titles much easier to read at a glance, and the details area was refined to feel less empty when metadata is sparse.
- Entity detail edit mode now features a tiptap WYSIWYG markdown editor for descriptions, a searchable tag picker with live API search and inline tag creation, and an icon-only edit toggle replacing the old labeled toolbar.
- Entity detail pages now support tab-scoped editing for reusable sections: users can enter edit mode, update fields inline with validation, save explicitly, and get warned before leaving a tab with unsaved changes. Rich metadata sections such as studios, credits, stats, dates, technical data, progress, positions, classification, sources, and fingerprints remain visible through the shared detail section system.
- The entity browse experience was refined into a "reel-transport" control room aesthetic — the pagination strip now reads like a deck counter with a brass progress hairline and grouped transport buttons, the toolbar no longer reshuffles when you search, thumbnails carry a quieter shadow with a brass underline accent on hover and select, and the kind tabs gained a glowing brass indicator. Mobile layouts stay legible without pushing the grid around when filters appear.
- Browse search now queries the server, so typing in the search box searches all entities in the library — not just the loaded page. Results, pagination totals, and page counts update to reflect the filtered dataset.
- Browse pagination now shows the true total count from the server, so the "showing" readout reads `1–250 of 4,500` instead of the loaded subset, the page indicator shows the real `01 / 18`, and the seek-to-end button jumps to the actual last page by buffering remaining cursor pages on demand. The centered transport buttons stay rock-steady as the readout digits grow.
- Obscura v2 rebuilt the app around a .NET API, EF Core persistence, PostgreSQL, and a .NET worker, replacing the legacy server/runtime path with one backend-owned architecture.
- The media library now uses EF-backed entity records with explicit child and relationship links for videos, series, seasons, images, galleries, books, audio, people, studios, tags, and collections, giving browse and detail pages a common model without a global graph abstraction.
- Entity pages now load and display child and related items through a lighter relationship model, making large series, galleries, and collections faster to browse.
- Playback now follows Jellyfin-compatible video routes for playback negotiation, direct streaming, adaptive HLS, trickplay image playlists, playback sessions, and watched-state updates.
- The Svelte frontend now renders the v2 browse, dashboard, detail, identify, plugins, settings, and playback surfaces through shared Dark Room components instead of the older v1 UI patterns.
- The temporary v2 migration, fresh-start, backup, and legacy-import tools were removed now that current builds run directly on the EF-backed entity model.
- Identify review now separates structural children from related people and studios, so series cascades can carry seasons, episodes, credits, and artwork together.
- Identify now applies full credit lists even when the same person has multiple roles on a title, preserving the combined credit metadata without crashing.
- Series, season, and video detail pages now show identified cast, crew, studio, and tag relationships from the v2 relationship model.
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
- Library rescans now remove deleted video files even when older rows were not linked to their library root, so stale videos disappear after the next scan.
- Python plugin and Stash scraper commands now run exactly as declared, so manifests should use `python3` explicitly when they need Python 3 instead of relying on an automatic command rewrite.
- Video playback controls now stay synchronized with the native media element, so playback, seeking, and the buffered range render correctly while HLS plays.
- Adaptive video playback now keeps decoded video visible over stale poster artwork and can prebuffer more of the stream during local playback.
- Browse grids now use docked pagination inside the shared entity grid, so large media lists keep a predictable scroll area and avoid rendering thousands of thumbnails at once.
- Browse grids now fit their internal scroll area to the visible page instead of clipping below the app frame.

### Changed
- The person browse section and person detail links now use People terminology and `/people` URLs instead of Actors and `/performers`.
- Entity thumbnail titles now wrap to two lines instead of scrolling on a single line, and the details section layout was updated to gracefully adapt to varying title lengths while keeping metadata aligned.
- Clicking a thumbnail while items are selected now toggles selection instead of navigating, so multi-select flows no longer accidentally leave the page.
- The bulk selection bar now shows Select All, Clear, and NSFW toggle as dedicated controls; page-specific actions move into an Actions flyout menu for a cleaner toolbar on mobile.
- Plugin execution no longer rewrites `python` commands to `python3`; the manifest `script` executable is now used verbatim.

### Added
- MarkdownEditor form component: tiptap-based WYSIWYG with Dark Room toolbar styling, markdown serialization, and formatting support (bold, italic, headings, lists, blockquotes, code, links).
- EntityPicker form component: multi/single-select entity reference picker with debounced live API search, thumbnail avatars, keyboard navigation, and inline creation for new items.
- Editable EntityDetail sections now save through one global entity metadata patch endpoint, shared with identify proposal application so manual edits and plugin metadata use the same backend path.
- High-level v2 implementation summary for the rebuilt Obscura architecture, media model, playback pipeline, and UI surfaces.
- EF-projected browse/detail APIs for videos, series, seasons, images, galleries, books, audio libraries/tracks, people, studios, tags, collections, and generic entity lists.
- `EntityListResponse.totalCount` reports the unbounded count of entities matching the response's filters, so paginated UIs can render accurate `page X of Y` indicators and a true seek-to-end target without re-counting after every cursor advance.

### Changed
- Browse search now hits the server instead of filtering the loaded page locally, so the toolbar search box searches the full library. Queries are debounced 300ms and abort in-flight requests when superseded.
- The entity grid toolbar now uses the same glass material as the pagination strip, with unified borders across the search box, sort/view/filter buttons, and the thumbnail-size slider so the controls read as one material family. The active-filter row reserves its space even when empty, so adding or clearing a filter chip no longer nudges the grid. On mobile the trailing filter/preset/clear buttons hug the right edge instead of stranding on the left with empty space beside them.
- Entity browse pages received a visual polish pass: pagination became a transport-style strip with a brass progress indicator, the search toolbar layout is stable while typing and filtering, thumbnail hover/selection now uses a brass underline and gentler shadows, and the kind tabs got a glowing accent rail.
- Browse pagination now displays the true matching-entity total from the API instead of the loaded subset, the centered transport stays geometrically pinned as the readout digit count grows, the search box no longer shows a redundant native clear button alongside the styled one, and the per-page selector inherits the surrounding monospace font instead of falling back to the iOS-safe system size.
- The entity grid no longer traps wheel/touch scrolling at its boundaries. Scrolling up past the top of the grid (or down past the bottom) now chains naturally to the outer page, so the page header is reachable on mobile after browsing into the grid.
- The docked pagination strip is no longer subject to the inner grid's overscroll rubber-band on iOS/macOS. The strip now sits in normal flow below the scrolling card area instead of as a sticky child of it, so reaching the end of the grid no longer makes the readout and transport buttons bounce.
- The entity grid viewport now anchors against the layout's scrolling container instead of the raw window height, so on mobile the pagination strip sits cleanly above the bottom navigation bar rather than disappearing behind it. A sparse grid (e.g. three images) also fills the available space and pins the pagination strip to the bottom of the visible area instead of floating mid-page — but without creating a tall scrollable empty region inside the card viewport.
- The entity grid's search/sort toolbar at the top and the pagination strip at the bottom now both float over the page-level scroll, anchored to the visible top and bottom edges with matching breathing-room buffers from the scroll edges. Cards slide cleanly under the toolbar — the previous transparent gap between the docked toolbar and the first card row that let card content clip into view has been removed — and the inner-viewport dual-scroll was removed so the docked controls no longer clip the top of cards that scroll under them.
- The v2 development data model was simplified around generic entity children, relationships, and thumbnail projections; rescanning/importing v1 data is required.
- Changelog entries are now curated release notes for important user-visible changes instead of an exhaustive development log.
- Domain entities now use a breaking object-oriented model with enum entity kinds and attached mutable capabilities instead of registry/string capability lookups.
- Entity children and relationships now group by `EntityKind`, and video credits now live in a mutable typed credits capability.
- Child and relationship API payloads now share one grouped entity shape with `kind`, `label`, and `entities` fields.
- Plugin identify protocol context was renamed from `graph` / `IdentifyGraphContext` to `structuralContext` / `IdentifyStructuralContext`.
- The `Counters` capability, `entity_counters` table, and the plugin metadata-patch `counters` field were removed; numeric scraped metadata now uses `stats`. Rescanning v1 data is required.
- The rating capability payload was flattened (`value` is now the rating number directly instead of a nested object), and the unused domain image capability and `entity_aliases` table were removed.
- Entity hierarchy persistence now treats `parent_entity_id` and `sort_order` on `entities` as the source of truth; domain hydration still builds child arrays for application code.
- Top-level media browse pages now share one Svelte entity-index component for loading, empty states, retry handling, and paged browsing behavior.
- The thumbnail lab now loads a much larger synthetic fixture set through the shared paged-browsing path for stress testing.
- The thumbnail lab now shows how many cards are loaded and rendered on the current page so pagination behavior can be checked directly.

### Fixed
- Identified cast, crew, studios, and tags now populate detail API relationship groups again, and season pages fall back to series-level cast and crew when the season has no separate relationship data.
- Entity detail reference sections now render linked entity thumbnails in a single horizontal scrolling row without selection checkboxes, keeping checkbox selection scoped to full EntityGrid views.
- Entity detail tabs now render shared rich metadata sections such as credits, studios, stats, technical data, sources, and fingerprints without each route having to provide a custom renderer.
- Library scans now correctly remove galleries, books, and audio libraries only from the scanned root instead of accidentally deleting entities belonging to other roots.
- Library scans now remove missing video files whose stored source path is under the scanned root even if the row is missing its root link.
- Scanning a video library root now cleans up empty series and season container entities after their child videos are removed from disk.
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
- Video playback now drives the visible progress and buffer rails from the native video element, fixing stale player controls while adaptive HLS plays.
- Adaptive video playback now keeps decoded video visible over stale poster artwork and can prebuffer more of the stream during local playback.

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
