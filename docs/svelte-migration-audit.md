# Svelte Migration Audit

Last updated: 2026-04-21

## Executive Summary

The SvelteKit app has reached route-surface parity with the current Next.js app: both expose the same 35 first-party page routes. The shell is also much closer to parity after restoring the command palette, the mobile overflow navigation sheet, and the persistent playlist controller/queue.

This is still not a full-app cutover candidate. The target is full-stack SvelteKit, but the current implementation still depends on the existing Fastify API for server data and mutations, the Docker/dev entrypoints still boot the Next.js web app, and the unified production image still packages `apps/web` rather than `apps/web-svelte`.

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

The backend has not been ported to SvelteKit.

- `apps/web-svelte` uses `PUBLIC_API_URL` on the client and `INTERNAL_API_URL` on the server to talk to the existing Fastify service.
- `apps/web-svelte/src/routes` currently has no `+server.ts` endpoints.
- The only server-owned route file in the Svelte app is `+layout.server.ts`, which performs SSR data loading, not API replacement.

Cutover implication:

- Replacing React with SvelteKit is currently feasible.
- Replacing Node/Fastify is not. The Svelte app is still coupled to the existing API process.

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

- No Svelte-owned backend surface. All data and mutation behavior still rely on Fastify.
- Docker/dev/prod entrypoints still boot the Next.js app.
- No release workflow path packages `apps/web-svelte`.

### Parity blockers

- Route presence is not the same as verified visual parity. The app still needs route-by-route screenshot and interaction checks against the live build.
- The Svelte app still carries a meaningful warning backlog in `svelte-check` (state-capture and a11y warnings). Typecheck is green, but the warning volume is still high enough to hide real regressions.
- There is not yet a formal browser-driven parity suite that compares core flows between port 8008 and port 8009.

### Recommended next steps

1. Add route-by-route visual baselines for the shared 35-route surface, starting with dashboard, videos, search, plugins, settings, identify, jobs, and the main detail pages.
2. Extract shared framework-agnostic application services from Fastify before adding SvelteKit `+server.ts` handlers.
3. Add SvelteKit-owned `/api/*`, `/assets/*`, and streaming handlers route family by route family while keeping Fastify as the oracle until each slice passes parity.
4. Swap Docker/dev wiring to a selectable Svelte web target only after the browser parity pass is clean.
5. Burn down the `svelte-check` warning backlog before cutover so new regressions are visible.
