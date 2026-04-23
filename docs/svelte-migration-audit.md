# Svelte Migration Audit

Last updated: 2026-04-22

## Executive Summary

The SvelteKit app has reached route-surface parity with the current Next.js app: both expose the same 35 first-party page routes. The shell is also much closer to parity after restoring the command palette, the mobile overflow navigation sheet, and the persistent playlist controller/queue.

This is still not a full-app cutover candidate. The target is full-stack SvelteKit, but production wiring still boots the Next.js web app and the unified production image still packages `apps/web` rather than `apps/web-svelte`. On the API side, SvelteKit now owns a substantial portion of the route tree, but a smaller proxy surface still exists for assets/streaming and the remaining scraper/runtime mutations.

## Chosen Direction

The selected target is a full-stack SvelteKit app plus a thin background worker.

- Fastify is not part of the target end-state.
- Heavy media jobs remain out-of-process for ffmpeg isolation, retries, and restart safety.
- Boot-time DB migration and breaking-change gate checks move to the SvelteKit server bootstrap unless they are later split into a dedicated bootstrap path.
- The cutover proceeds by route family with parity checks, not as a single big-bang migration.

## Route Surface

Route inventory check on 2026-04-21:

- Next.js page routes: 35
- SvelteKit page routes: 35
- Missing Svelte routes relative to Next.js: 0
- Extra Svelte routes relative to Next.js: 0

Covered route families:

- `/`
- `/audio`, `/audio/[id]`, `/audio/tracks/[id]`
- `/collections`, `/collections/new`, `/collections/[id]`, `/collections/[id]/edit`
- `/design-language`
- `/galleries`, `/galleries/[id]`
- `/identify`
- `/images`, `/images/[id]`
- `/jobs`
- `/performers`, `/performers/new`, `/performers/scrape`, `/performers/[id]`
- `/plugins`
- `/resolve`, `/resolve/review`
- `/scrape`
- `/scrapers`
- `/search`
- `/settings`
- `/studios`, `/studios/new`, `/studios/[id]`
- `/tags`, `/tags/new`, `/tags/[id]`
- `/videos`, `/videos/[id]`, `/videos/[id]/edit`

## Current Parity Status

### Frontend

- Route surface is mirrored.
- Most major feature pages now exist as real SvelteKit pages rather than placeholders.
- The shell now includes the same high-frequency controls as the React shell:
  - global command palette
  - mobile "More" overflow sheet
  - persistent playlist controller and queue
- Mobile navigation is no longer missing the overflow affordance that exists in the live app.

### Backend

The backend is now partially ported to SvelteKit.

- `apps/web-svelte` is the browser-facing API ingress. Client helpers default to same-origin `/api`, and the catch-all proxy in `apps/web-svelte/src/routes/api/[...rest]/+server.ts` only handles routes SvelteKit does not yet own locally.
- `apps/web-svelte/src/routes/api/**/+server.ts` now covers:
  - foundation and settings (`changelog`, `client-info`, `system/status`, `settings/library`, `libraries`)
  - entity CRUD and media writes for `tags`, `studios`, `performers`, `video-series`
  - collections, galleries, images, audio libraries, and audio tracks
  - `search`, `jobs` dashboard `GET`, provider package lists, and the full core `videos/*` JSON/mutation surface
  - video subtitles and markers
- The remaining Fastify dependency surface is narrower and concentrated in:
  - generated asset delivery (`/assets/*`)
  - stream delivery (`/video-stream/*`, `/audio-stream/*`)
  - scraper, StashBox, plugin, video-accept, and jobs mutation endpoints
  - `POST /videos/:id/subtitles/extract`

Cutover implication:

- Replacing the React UI is already feasible.
- Replacing the Fastify HTTP process for normal CRUD flows is close, but not finished until the remaining proxy-only route families are ported.

### Deployment

Deployment is not ready to swap over.

- `infra/docker/docker-compose.yml` still runs `pnpm --filter @obscura/web dev`.
- `infra/docker/web.Dockerfile` still builds `@obscura/web`.
- `infra/docker/unified.Dockerfile` copies and publishes `apps/web` as the production web server payload.
- The current release/build workflows therefore still ship the Next.js app, not the SvelteKit app.

### Quality Gates

Before this audit, root CI did not execute the SvelteKit unit suite. That meant the new frontend could regress without affecting `pnpm test:ci`.

The root scripts should treat `@obscura/web-svelte` as a first-class app during the migration window so the side-by-side port cannot silently rot.

## What Still Blocks a Clean Cutover

### Hard blockers

- Generated asset and media stream endpoints still live behind the Fastify proxy surface.
- Scraper/plugin/StashBox/video-accept/jobs mutation flows still rely on Fastify route handlers.
- Docker/dev/prod entrypoints still boot the Next.js app.
- No release workflow path packages `apps/web-svelte`.

### Parity blockers

- Route presence is not the same as verified visual parity. The app still needs route-by-route screenshot and interaction checks against the live build.
- The Svelte app still carries a meaningful warning backlog in `svelte-check` (state-capture and a11y warnings). Typecheck is green, but the warning volume is still high enough to hide real regressions.
- There is not yet a formal browser-driven parity suite that compares core flows between port 8008 and port 8009.

### Recommended next steps

1. Add route-by-route visual baselines for the shared 35-route surface, starting with dashboard, videos, search, plugins, settings, identify, jobs, and the main detail pages.
2. Finish the remaining runtime ownership gaps: scraper/plugin/StashBox/video-accept/jobs mutations, `/assets/*`, `/video-stream/*`, and `/audio-stream/*`.
3. Run Svelte-only verification with `INTERNAL_API_URL=none` and treat every `[api-proxy] 501` as a migration bug until normal use is clean.
4. Swap Docker/dev wiring to a selectable Svelte web target only after the browser parity pass is clean.
5. Burn down the `svelte-check` warning backlog before cutover so new regressions are visible.
