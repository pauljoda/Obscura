# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
