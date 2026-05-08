# Gallery Comics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make zip/cbz comic galleries feel native by adding ComicInfo metadata, natural page ordering, scoped image browsing controls, aspect-aware thumbnails, cover fallbacks, and a dedicated reader.

**Architecture:** Keep comics as galleries. Add focused pure helpers for natural sorting, ComicInfo parsing, and reader spread math; wire those helpers into gallery scan/read paths and the Svelte gallery detail page. Reuse the existing Images `MediaSurface` and image asset routes instead of creating a separate Comics entity.

**Tech Stack:** TypeScript, SvelteKit/Svelte 5, Drizzle/Postgres, Vitest, adm-zip, existing Obscura media/app core packages.

---

## File Structure

- `packages/media-core/src/index.ts`: natural sort helpers, ComicInfo parser, archive ComicInfo extraction.
- `packages/media-core/src/index.test.ts`: unit tests for natural sorting and ComicInfo parsing.
- `packages/contracts/src/index.ts`: gallery DTO additions for comic metadata and comic-aware labels.
- `packages/app-core/src/gallery-media.ts`: natural image sort option, gallery detail comic metadata fields, cover fallback reads, child preview fallback.
- `apps/worker/src/processors/gallery-scan.ts`: use natural ordering for folder and archive pages, seed ComicInfo metadata, map comic creators to performers and comic tags to tags.
- `apps/web-svelte/src/lib/media-surface/configs/images.ts`: support gallery-scoped surface id/defaults and natural sort option.
- `apps/web-svelte/src/routes/galleries/[id]/+page.server.ts`: load gallery-scoped image browsing prefs and initial sort defaults.
- `apps/web-svelte/src/routes/galleries/[id]/+page.svelte`: replace manual masonry with `MediaSurface`, label comic performers as Authors, expose Read action.
- `apps/web-svelte/src/lib/components/ComicReader.svelte`: dedicated paged/webtoon reader.
- `apps/web-svelte/src/lib/components/comic-reader.ts`: pure spread/page helpers.
- `apps/web-svelte/src/lib/components/comic-reader.test.ts`: spread math tests.
- `apps/web-svelte/src/lib/components/thumbnails/GalleryThumbnail.svelte`: aspect-aware cover/previews.
- `CHANGELOG.md`: user-facing entries for the feature.

## Tasks

### Task 1: Core Comic Helpers

**Files:**
- Modify: `packages/media-core/src/index.ts`
- Modify: `packages/media-core/src/index.test.ts`

- [ ] Add failing tests for `naturalComparePaths`, `sortPathsNaturally`, `parseComicInfoXml`, and `extractComicInfoFromZip`.
- [ ] Run `pnpm --filter @obscura/media-core test:unit -- src/index.test.ts` and confirm the new tests fail because the helpers are missing.
- [ ] Implement the helpers in `packages/media-core/src/index.ts`.
- [ ] Run `pnpm --filter @obscura/media-core test:unit -- src/index.test.ts` and confirm the tests pass.
- [ ] Commit with `feat(media): add comic metadata helpers`.

### Task 2: Archive And Folder Scan Metadata

**Files:**
- Modify: `apps/worker/src/processors/gallery-scan.ts`
- Modify: `CHANGELOG.md`

- [ ] Add failing worker/core-adjacent tests if a suitable worker processor harness exists; otherwise cover the pure scan inputs through media-core tests from Task 1 and keep scanner validation to typecheck.
- [ ] Use natural sorting for loose gallery images and archive member images.
- [ ] Parse `ComicInfo.xml` from a folder or archive when present.
- [ ] Seed gallery title/details/date/urls on first import and map publisher/imprint to studio, creators to performers, and genre/tags/characters/series metadata to tags.
- [ ] Run `pnpm --filter @obscura/worker typecheck`.
- [ ] Commit with `feat(worker): import comic gallery metadata`.

### Task 3: Gallery Reads, Covers, And Natural Sort

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/app-core/src/gallery-media.ts`
- Modify: `apps/web-svelte/src/routes/api/images/images-route.test.ts`
- Modify: `CHANGELOG.md`

- [ ] Add failing tests for the Images API passing `sort=natural` and `gallery=<id>` through to app-core.
- [ ] Extend image sorting with a natural/page-order option that orders by gallery `sortOrder` and title fallback.
- [ ] Extend gallery detail/list DTOs with `isComic`, `comicInfo`, and aspect hints where needed.
- [ ] Resolve gallery covers by custom cover, explicit cover image, first direct image, then child gallery first/cover images.
- [ ] Run `pnpm --filter @obscura/web-svelte test:unit -- src/routes/api/images/images-route.test.ts` and `pnpm --filter @obscura/app-core typecheck`.
- [ ] Commit with `feat(api): expose comic gallery ordering and covers`.

### Task 4: Scoped Gallery Image Surface

**Files:**
- Modify: `apps/web-svelte/src/lib/media-surface/configs/images.ts`
- Modify: `apps/web-svelte/src/routes/galleries/[id]/+page.server.ts`
- Modify: `apps/web-svelte/src/routes/galleries/[id]/+page.svelte`
- Modify: `apps/web-svelte/src/lib/components/thumbnails/GalleryThumbnail.svelte`
- Modify: `CHANGELOG.md`

- [ ] Add failing tests for `imagesSurfaceConfig` gallery-scoped defaults if a config test file is introduced.
- [ ] Let `imagesSurfaceConfig` accept `surfaceId`, default view mode, default sort, and available view modes for gallery detail.
- [ ] Replace the manual gallery masonry/load-more implementation with `MediaSurface`.
- [ ] Preserve gallery edit/import/sidebar behavior around the new surface.
- [ ] Render comic performer labels as Authors on comic-aware galleries.
- [ ] Make gallery thumbnails respect cover/preview aspect instead of forcing square crops in gallery-aware contexts.
- [ ] Run `npx @sveltejs/mcp svelte-autofixer` on changed `.svelte` files.
- [ ] Run `pnpm --filter @obscura/web-svelte typecheck`.
- [ ] Commit with `feat(web): use image surface inside galleries`.

### Task 5: Comic Reader

**Files:**
- Create: `apps/web-svelte/src/lib/components/comic-reader.ts`
- Create: `apps/web-svelte/src/lib/components/comic-reader.test.ts`
- Create: `apps/web-svelte/src/lib/components/ComicReader.svelte`
- Modify: `apps/web-svelte/src/routes/galleries/[id]/+page.svelte`
- Modify: `CHANGELOG.md`

- [ ] Add failing tests for spread computation with single page, two-page, and first-page-cover modes.
- [ ] Implement pure reader page/spread helpers.
- [ ] Build `ComicReader.svelte` with paged and webtoon modes, one/two-page toggle, first-page-cover toggle, keyboard navigation, and sharp Dark Room glass controls.
- [ ] Open the reader from the gallery detail Read action and from comic page activation.
- [ ] Run `pnpm --filter @obscura/web-svelte test:unit -- src/lib/components/comic-reader.test.ts`.
- [ ] Run `npx @sveltejs/mcp svelte-autofixer apps/web-svelte/src/lib/components/ComicReader.svelte`.
- [ ] Commit with `feat(web): add comic reader`.

### Task 6: Full Verification

**Files:**
- Modify only files needed to fix verification failures.

- [ ] Run `pnpm --filter @obscura/media-core test:unit`.
- [ ] Run `pnpm --filter @obscura/web-svelte test:unit`.
- [ ] Run `pnpm --filter @obscura/web-svelte typecheck`.
- [ ] Run `pnpm --filter @obscura/worker typecheck`.
- [ ] Start the dev server if needed and inspect gallery detail/comic reader with `agent-browser`.
- [ ] Commit any verification fixes with an appropriate `fix(...)` message and changelog entry.

## Self-Review

- Spec coverage: The tasks cover archive-native cbz/zip handling, ComicInfo metadata, natural ordering, scoped Images browsing, aspect-aware thumbnails, cover fallback/tiling, and the reader.
- Placeholder scan: The plan intentionally leaves no unspecified implementation task; each task lists concrete files, behavior, commands, and commit messages.
- Type consistency: The plan consistently uses `isComic`, `comicInfo`, `sort=natural`, `galleryId`, and `MediaSurface` terminology.
