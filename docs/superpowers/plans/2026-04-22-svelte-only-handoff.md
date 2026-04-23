# SvelteKit-Only Handoff

The SvelteKit app is now the single API ingress. You can run it **without
Fastify or Next.js** and exercise the full surface; anything not yet
owned locally responds with a loud 501 "route not migrated" body (instead
of silently hanging), so every gap surfaces as a visible bug during
user testing.

## How to run Svelte-only

**VS Code:** Run configuration **"Svelte-Only: SvelteKit + Worker (no
Fastify, no Next)"**. Compound config **"Svelte-Only + Chrome"** also
attaches a debugger.

**Terminal:**

```bash
pnpm dev:svelte-only
```

This starts:

- `@obscura/web-svelte` (SvelteKit dev server, port 8009)
- `@obscura/worker` (pg-boss job worker, no HTTP)

It does **not** start:

- `@obscura/api` (Fastify) — `INTERNAL_API_URL=none` tells the Svelte
  catch-all proxy to return 501 instead of forwarding.
- `@obscura/web` (Next.js / React) — deprecated.

Postgres still runs via the existing `Obscura: Docker Up` task.

## How "not yet migrated" surfaces

When the UI hits a route SvelteKit doesn't own locally:

- **Dev console:** `[api-proxy] 501 <METHOD> /api/<path>`
- **Response:** `501` with body
  `{ "error": "Not migrated", "method": "...", "path": "/api/...", "message": "..." }`

If `INTERNAL_API_URL` is pointed at a real upstream and that upstream is
unreachable, the proxy instead returns `502` with the same shape.

## What's locally owned (Svelte serves)

From `apps/web-svelte/src/routes/api/`:

**Foundation & settings**

- `changelog`
- `client-info`
- `system/status`, `system/breaking-gate/accept`
- `settings/library` (GET + PUT)
- `libraries` (GET, POST), `libraries/:id` (PATCH, DELETE), `libraries/browse` (GET)

**Entity lists + details**

- `tags`, `tags/:id`
- `studios`, `studios/:id`
- `performers`, `performers/:id`
- `video-series`, `video-series/:id`

**Entity writes + images**

- `tags/:id/favorite`, `rating`, `image` (POST multipart, DELETE), `image/from-url`
- `studios/:id/favorite`, `rating`, `image`, `image/from-url`
- `performers/:id/favorite`, `rating`, `image`, `image/from-url`
- `video-series/:id/cover`, `backdrop` (POST multipart + DELETE)

**Video routes**

- `videos` (list)
- `videos/stats`
- `videos/upload`
- `videos/:id` (GET, PATCH, DELETE)
- `videos/:id/reset-metadata`
- `videos/:id/play`
- `videos/:id/orgasm`
- `videos/:id/preview/rebuild`
- `videos/:id/thumbnail` (+ `from-url`, `from-frame`)
- `videos/:id/subtitles`, `subtitles/:trackId` (+ `source`, `cues`)
- `videos/:id/markers`, `videos/markers/:markerId`

**Media libraries**

- `collections` (+ items, reorder, refresh, preview-rules)
- `galleries` (+ stats, cover, chapters, image upload/list)
- `images` (+ bulk)
- `audio-libraries` (+ stats, cover, track upload)
- `audio-tracks` (+ play, markers)

**Provider integrations (list only)**

- `plugins/packages`
- `scrapers/packages`
- `stashbox-endpoints`

**Read models**

- `search`
- `jobs` (dashboard GET)

**Catch-all proxy**

- `[...rest]/+server.ts`

## What's still proxied (expect 501s)

These route families are **not yet owned** by SvelteKit. When
`INTERNAL_API_URL=none`, calls return 501; start Fastify and point the
var at it to keep them working while you migrate them.

**Fully proxied**

1. `assets/*` — generated asset streaming (thumbnails, sprites, etc.)
2. `audio-stream/*` — HLS-like audio streaming
3. `video-accept/*` — scrape-accept flows for series/movies/episodes
4. `video-library/*` — hierarchy/browse endpoints
5. `video-stream/*` — HLS streaming

**Partially proxied (only list / dashboard is local)**

6. `jobs` mutations — run, cancel, queues/:name/run, phash-backfill,
   rebuild-preview, migrate-video-asset-storage, acknowledge-failed,
   clear-metadata
7. `scrapers` writes and runtime reads — community index/install, execute,
   results, accept/reject, performer apply-scrape
8. `stashbox` writes and identify flows — test, identify, lookup,
   stash-ids, phash contributions, metadata providers
9. `plugins` writes and runtime reads — install, delete, patch, execute,
   auth config, indexes, batch runs
10. `videos/:id/subtitles/extract` — queue-backed enqueue

## Approximate remaining work

From the Fastify service layer:

| Service                        | LOC   |
| ------------------------------ | ----- |
| `services/videos/core.ts`      | 2357  |
| `services/gallery.service.ts`  | 883   |
| `services/image.service.ts`    | 687   |
| `services/audio-track.service.ts` | 657 |
| `services/audio-library.service.ts` | 575 |
| `services/collection.service.ts` | 601 |
| + scrape-accept + plugins + scrapers + stashbox routes | ~2500 |

The remaining work is now concentrated in runtime-heavy surfaces
(assets, stream delivery, queue-backed scraper/plugin/jobs flows) rather
than broad CRUD coverage. Pattern is established: shared app-core
helpers, Svelte `+server.ts` shims, and 501s for anything still falling
through the proxy.

## Migration rhythm

1. Run `pnpm dev:svelte-only` (or the VS Code config).
2. Click through the UI you want to test. Dev console + UI both surface
   missing routes as 501s.
3. For each 501:
   - Copy the service file from `apps/api/src/services/<entity>.service.ts`
     into `packages/app-core/src/<entity>.ts`.
   - Thread `db: AppDb` as the first argument; replace `AppError` throws
     with the generic sentinels from `@obscura/app-core/errors`
     (`NotFoundError` / `ValidationError` / `UpstreamError` /
     `ConflictError`).
   - Replace `apps/api/src/services/<entity>.service.ts` with a thin
     shim that re-exports types and maps sentinels to `AppError`.
   - Add the matching `apps/web-svelte/src/routes/api/<path>/+server.ts`
     that calls the shared helper and maps errors via
     `mapAppCoreErrorToJson` in `apps/web-svelte/src/lib/server/error-mapper.ts`.
4. Parity-test before and after against a running Fastify
   (`INTERNAL_API_URL=http://localhost:4000`):

    ```bash
    diff <(curl -s http://localhost:4000/<path> | python3 -m json.tool --sort-keys) \
         <(curl -s http://localhost:8009/api/<path> | python3 -m json.tool --sort-keys)
    ```

5. Commit. Every route migrated shrinks the proxy fallback surface.

## When can `apps/api` be deleted?

When the audit at the top of this file has zero proxied routes and
**`INTERNAL_API_URL=none` causes zero failures during normal use**.

At that point:

- Delete `apps/api` and its subdirectories.
- Delete `apps/web` (Next.js frontend).
- Delete `apps/web-svelte/src/routes/api/[...rest]/+server.ts` and the
  `INTERNAL_API_URL` env var.
- Update `infra/docker/` compose + unified Dockerfile to serve
  SvelteKit as the only HTTP process (plus worker + Postgres).
- Update `CLAUDE.md` to match.
