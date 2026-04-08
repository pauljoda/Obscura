# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **NSFW tag labels in blur mode** — New `NsfwTagLabel` shows garbled block glyphs plus a light blur for tags marked `isNsfw` when global mode is **Blur**; hover reveals the real name (same **Show** / **Off** rules as `NsfwBlur`). Embedded tags on scenes, images, galleries, and performer detail now include `isNsfw` via `TagEmbedDto` in `@obscura/contracts` and API list/detail payloads. `MediaCard` accepts an optional `tagsSlot` so scene grid cards can render obscured tags.

- **Gallery NSFW propagation (API)** — `PATCH /galleries/:id` applies `isNsfw` to all descendant sub-galleries and images in the same transaction (recursive CTE). The JSON body may include `affectedGalleryIds` so clients can invalidate caches. Propagation runs only when the flag value changes.

### Changed

- **NSFW blur overlay** — The centered badge uses theme `error` / `error-text` / `error-muted` tokens (the previous `status-error` utilities are not defined in `@theme`, so the label did not pick up red). `NsfwChip` and `NsfwEditToggle` use the same tokens for consistency.

- **Gallery detail freshness** — Server-side gallery detail fetch uses `revalidate: 0` so a full page reload reflects edits immediately. After saving gallery metadata, the web app revalidates `galleries` and per-gallery cache tags and syncs NSFW state into sub-gallery and image list client state.

- **Video player metrics** — The top-right **ABR** (bandwidth) chip is hidden in **Direct** playback mode; it only appears for adaptive HLS. Buffer and drop stats stay visible.

### Fixed

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
- **Command palette search** — The ⌘K / Ctrl+K quick search now passes the current NSFW mode to the search API, matching the full search page (SFW mode excludes NSFW entities from preview results).

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
