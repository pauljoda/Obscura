# Svelte Full-Stack Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Next.js + Fastify web stack with a full-stack SvelteKit app while preserving feature parity, visual parity, and background-job behavior, then remove `apps/web` and `apps/api`.

**Architecture:** The final runtime should be a SvelteKit app (`apps/web-svelte`) that owns pages, API endpoints, asset streaming, and admin/system routes, backed by shared framework-agnostic domain packages. Heavy media work must remain out-of-process for ffmpeg isolation and retry safety, so the worker stays as a thin runtime shell over shared job modules instead of being folded into request handlers. The current Fastify app remains the oracle only until each route family has matching SvelteKit API handlers, parity checks, and browser validation.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, adapter-node, TypeScript, Drizzle, PostgreSQL, pg-boss, Playwright, Vitest, ffmpeg, nginx, Docker Buildx.

---

## Scope Check

This is a program plan across multiple subsystems, not a single feature. Execution should be split into independent workstreams with separate commits and review points:

1. parity harness
2. shared application core extraction
3. SvelteKit API migration
4. worker/runtime simplification
5. frontend cutover
6. deployment + release cutover
7. legacy removal

Do not try to land the entire program in one branch-sized change.

## Non-Negotiable Migration Rules

- The Svelte app does not get to "count" as migrated until the matching feature has both logical parity and visual parity against the live app.
- Do not rewrite business logic directly inside `+server.ts` files. Move framework-agnostic logic into shared packages first, then call it from SvelteKit handlers.
- Do not move heavy scan/probe/preview/transcode work into request handlers. Keep that work in the worker runtime.
- Do not remove Fastify routes until:
  - the matching SvelteKit route exists
  - API-level parity tests pass
  - the browser parity harness passes for the related user flow
  - Docker/dev wiring can run without the Fastify process for that slice
- Performance changes are allowed only when they preserve user-visible behavior. Any intentional UX changes must be called out separately.

## Target End State

After the cutover, the runtime should look like this:

- `apps/web-svelte` serves all UI routes and all `/api/*` endpoints.
- `apps/web-svelte` also owns `/assets/*` and streaming endpoints currently served by Fastify.
- shared application logic lives in new framework-agnostic packages rather than `apps/api/src/routes/*`.
- `apps/worker` remains as a thin process wrapper around shared queue/job modules.
- `apps/web` and `apps/api` are deleted.
- Docker, dev scripts, and release workflows build and ship only the Svelte stack.

## Current State Snapshot

- Page-route parity is already 35/35 between `apps/web` and `apps/web-svelte`.
- Shell parity improved: command palette, mobile "More" sheet, and playlist controller are now present in Svelte.
- Backend parity is 0% complete in architectural terms:
  - `apps/web-svelte` still calls Fastify via `PUBLIC_API_URL` / `INTERNAL_API_URL`
  - there are no `apps/web-svelte/src/routes/api/**/+server.ts` files yet
  - Docker/dev/prod still start `apps/web` and `apps/api`
- Current backend surface to replace:
  - `apps/api/src/routes/assets.ts`
  - `apps/api/src/routes/audio-libraries.ts`
  - `apps/api/src/routes/audio-stream.ts`
  - `apps/api/src/routes/audio-tracks.ts`
  - `apps/api/src/routes/changelog.ts`
  - `apps/api/src/routes/collections.ts`
  - `apps/api/src/routes/galleries.ts`
  - `apps/api/src/routes/images.ts`
  - `apps/api/src/routes/jobs.ts`
  - `apps/api/src/routes/performers.ts`
  - `apps/api/src/routes/plugins.ts`
  - `apps/api/src/routes/scrapers.ts`
  - `apps/api/src/routes/search.ts`
  - `apps/api/src/routes/settings.ts`
  - `apps/api/src/routes/stashbox.ts`
  - `apps/api/src/routes/studios.ts`
  - `apps/api/src/routes/system.ts`
  - `apps/api/src/routes/tags.ts`
  - `apps/api/src/routes/video-accept.ts`
  - `apps/api/src/routes/video-library.ts`
  - `apps/api/src/routes/video-series.ts`
  - `apps/api/src/routes/video-stream.ts`
  - `apps/api/src/routes/videos.ts`
- Current worker/job surface to preserve:
  - library scan
  - media probe
  - fingerprint
  - preview
  - extract subtitles
  - gallery/image/audio processors
  - collection refresh
  - metadata import
  - scheduler and queue lifecycle

## File Structure

### New files

- `docs/superpowers/specs/2026-04-21-svelte-full-stack-architecture.md` — architecture contract for the cutover.
- `e2e/parity/route-matrix.ts` — canonical list of routes and scenarios to compare between the live app and the port.
- `e2e/parity.spec.ts` — route-by-route parity checks and screenshot capture.
- `packages/app-core/package.json` — shared domain layer package.
- `packages/app-core/src/index.ts`
- `packages/app-core/src/context.ts`
- `packages/app-core/src/http-errors.ts`
- `packages/app-core/src/services/*.ts` — route-family service modules extracted from Fastify handlers.
- `packages/job-runtime/package.json` — shared queue/job runtime package.
- `packages/job-runtime/src/index.ts`
- `packages/job-runtime/src/queues.ts`
- `packages/job-runtime/src/processors/*.ts`
- `apps/web-svelte/src/hooks.server.ts` — request context/bootstrap for full-stack SvelteKit.
- `apps/web-svelte/src/routes/api/**/+server.ts` — SvelteKit replacements for the Fastify routes.
- `apps/web-svelte/src/routes/assets/**/+server.ts` — asset/stream handlers moved under the SvelteKit server.

### Modified files

- `apps/web-svelte/src/lib/api/*.ts` — switch from direct Fastify calls to local relative endpoints.
- `apps/web-svelte/src/lib/server/*.ts` — replace external API wrappers with internal server calls.
- `apps/web-svelte/src/routes/**/+page.server.ts` — remove `INTERNAL_API_URL` dependencies as slices migrate local.
- `apps/api/src/routes/*.ts` — temporarily delegate into `packages/app-core`, then get deleted slice by slice.
- `apps/api/src/app.ts` — temporary delegation surface during migration.
- `apps/api/src/server.ts` — temporary bootstrap only until removed.
- `apps/worker/src/runtime.ts`
- `apps/worker/src/server.ts`
- `apps/worker/src/lib/*.ts`
- `apps/worker/src/processors/*.ts`
- `infra/docker/docker-compose.yml`
- `infra/docker/web.Dockerfile`
- `infra/docker/unified.Dockerfile`
- `infra/docker/entrypoint.sh`
- `.github/workflows/publish-dev.yml`
- `.github/workflows/release.yml`
- `playwright.config.ts`
- `package.json`

### Deleted files at end-state

- `apps/web/**`
- `apps/api/**`
- any Fastify-only Docker wiring left after cutover

## Task List

### Task 1: Freeze the Target Architecture and Cutover Rules

**Files:**
- Create: `docs/superpowers/specs/2026-04-21-svelte-full-stack-architecture.md`
- Modify: `docs/svelte-migration-audit.md`

- [ ] **Step 1: Write the architecture spec**

Document these decisions explicitly:

```md
- SvelteKit owns pages + /api + /assets + stream endpoints.
- Shared domain logic moves to packages/app-core.
- Shared queue/runtime logic moves to packages/job-runtime.
- Worker remains a separate long-lived process.
- Fastify is a temporary compatibility shell only.
- The cutover is route-family based, not "big bang".
```

- [ ] **Step 2: Extend the audit doc**

Add a section named `## Chosen Direction` with:

```md
The selected target is a full-stack SvelteKit app plus a thin background worker.
Fastify is not part of the target end-state.
Heavy media jobs remain out-of-process.
```

- [ ] **Step 3: Verify docs are present**

Run:

```bash
test -f docs/superpowers/specs/2026-04-21-svelte-full-stack-architecture.md
test -f docs/svelte-migration-audit.md
```

Expected: both commands exit `0`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-21-svelte-full-stack-architecture.md docs/svelte-migration-audit.md
git commit -m "docs: freeze svelte full-stack target architecture"
```

---

### Task 2: Build the Parity Harness Before More Rewrites

**Files:**
- Create: `e2e/parity/route-matrix.ts`
- Create: `e2e/parity.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Define the route matrix**

Start with a typed route inventory:

```ts
export const parityRoutes = [
  { path: "/", name: "dashboard" },
  { path: "/videos", name: "videos" },
  { path: "/videos/[fixtureId]", name: "video-detail" },
  { path: "/search", name: "search" },
  { path: "/plugins", name: "plugins" },
  { path: "/settings", name: "settings" },
  { path: "/jobs", name: "jobs" },
  { path: "/identify", name: "identify" },
] as const;
```

- [ ] **Step 2: Add dual-base parity tests**

Implement a Playwright spec that visits the live build and the Svelte build for each route:

```ts
const liveBase = process.env.OBSCURA_E2E_WEB_URL ?? "http://127.0.0.1:8008";
const svelteBase = process.env.OBSCURA_E2E_SVELTE_URL ?? "http://127.0.0.1:8009";
```

For each scenario:

- assert the route loads
- assert the page title/primary heading exists
- capture screenshots for later diffing

- [ ] **Step 3: Add scripts**

Add top-level scripts:

```json
{
  "test:parity": "playwright test e2e/parity.spec.ts",
  "test:parity:update": "playwright test e2e/parity.spec.ts --update-snapshots"
}
```

- [ ] **Step 4: Run the harness**

Run:

```bash
pnpm test:parity
```

Expected: the spec completes and produces artifacts even if some assertions still fail initially.

- [ ] **Step 5: Commit**

```bash
git add e2e/parity/route-matrix.ts e2e/parity.spec.ts playwright.config.ts package.json
git commit -m "test: add svelte parity harness"
```

---

### Task 3: Extract a Shared Application Core from Fastify

**Files:**
- Create: `packages/app-core/package.json`
- Create: `packages/app-core/src/index.ts`
- Create: `packages/app-core/src/context.ts`
- Create: `packages/app-core/src/http-errors.ts`
- Create: `packages/app-core/src/services/`
- Modify: `pnpm-workspace.yaml`
- Modify: `apps/api/src/routes/*.ts`

- [ ] **Step 1: Create the package shell**

Start with:

```ts
export interface AppRequestContext {
  databaseUrl?: string;
  cacheDir?: string;
  dataDir?: string;
  actor: "local-user";
}
```

- [ ] **Step 2: Extract one low-risk vertical slice first**

Move pure logic for these route families first:

- `system`
- `settings`
- `search`
- `changelog`

Do not start with streaming or multipart-heavy routes.

- [ ] **Step 3: Make Fastify routes thin adapters**

Each Fastify route should become:

```ts
const result = await getSystemStatus(appContext, input);
reply.send(result);
```

No Drizzle query or queue logic should remain inline in the route file after extraction.

- [ ] **Step 4: Verify with existing tests**

Run:

```bash
pnpm --filter @obscura/api typecheck
pnpm test:integration
```

Expected: existing API tests still pass after the extraction.

- [ ] **Step 5: Commit**

```bash
git add packages/app-core pnpm-workspace.yaml apps/api/src/routes apps/api/src/app.ts
git commit -m "refactor: extract shared app core foundations"
```

---

### Task 4: Migrate Low-Risk API Route Families into SvelteKit

**Files:**
- Create: `apps/web-svelte/src/hooks.server.ts`
- Create: `apps/web-svelte/src/routes/api/system/+server.ts`
- Create: `apps/web-svelte/src/routes/api/settings/+server.ts`
- Create: `apps/web-svelte/src/routes/api/search/+server.ts`
- Create: `apps/web-svelte/src/routes/api/changelog/+server.ts`
- Modify: `apps/web-svelte/src/lib/api/core.ts`
- Modify: `apps/web-svelte/src/lib/server/core.ts`
- Modify: `apps/web-svelte/src/routes/**/+page.server.ts`

- [ ] **Step 1: Add request-local app context in SvelteKit**

`hooks.server.ts` should initialize request context once and expose it through `event.locals`.

- [ ] **Step 2: Port the first route family**

Implement SvelteKit `+server.ts` handlers that call the shared `packages/app-core` services instead of Fastify.

- [ ] **Step 3: Switch only those Svelte pages to local relative fetches**

After the local handlers exist, update the matching loaders/helpers to call:

```ts
await fetch("/api/system/status");
```

instead of the Fastify base URL.

- [ ] **Step 4: Compare against the live app**

Run:

```bash
pnpm test:parity
pnpm --filter @obscura/web-svelte typecheck
```

Expected: the system/settings/search/changelog scenarios pass through the local Svelte handlers with unchanged UI output.

- [ ] **Step 5: Commit**

```bash
git add apps/web-svelte/src/hooks.server.ts apps/web-svelte/src/routes/api apps/web-svelte/src/lib/api apps/web-svelte/src/lib/server
git commit -m "feat(web-svelte): add first local api routes"
```

---

### Task 5: Migrate CRUD and Workflow Route Families by Slice

**Files:**
- Create: `apps/web-svelte/src/routes/api/{studios,tags,performers,galleries,images,collections,plugins,scrapers,stashbox,jobs,videos,video-series,video-accept,audio-libraries,audio-tracks}/**/+server.ts`
- Modify: `packages/app-core/src/services/*.ts`
- Modify: `apps/web-svelte/src/lib/api/*.ts`
- Modify: `apps/web-svelte/src/routes/**/+page.server.ts`

- [ ] **Step 1: Migrate route families in this order**

1. entity CRUD: `studios`, `tags`, `performers`
2. media CRUD: `galleries`, `images`, `audio-libraries`, `audio-tracks`
3. collections
4. plugins + scrapers + stashbox
5. jobs + video-accept
6. videos + video-series

- [ ] **Step 2: For each family, complete the same loop**

```md
- extract shared service logic if still in Fastify
- add SvelteKit +server.ts handlers
- switch Svelte loaders/mutations to local relative endpoints
- run parity harness for affected pages
- run typecheck + relevant tests
- commit before moving to the next family
```

- [ ] **Step 3: Keep Fastify as a compatibility shell only**

As each family moves, Fastify should call the same shared service layer until final deletion. Do not allow SvelteKit and Fastify to diverge in behavior.

- [ ] **Step 4: Verify after every family**

Run:

```bash
pnpm --filter @obscura/web-svelte typecheck
pnpm test:integration
pnpm test:parity
```

- [ ] **Step 5: Commit each family separately**

Example:

```bash
git commit -m "feat(web-svelte): migrate entity crud routes"
```

---

### Task 6: Migrate Assets and Streaming Last

**Files:**
- Create: `apps/web-svelte/src/routes/assets/**/+server.ts`
- Create: `apps/web-svelte/src/routes/api/video-stream/**/+server.ts`
- Create: `apps/web-svelte/src/routes/api/audio-stream/**/+server.ts`
- Modify: `packages/app-core/src/services/videos/*.ts`
- Modify: `infra/docker/nginx.conf` if route forwarding changes

- [ ] **Step 1: Keep binary/stream handlers isolated**

Port these only after the normal JSON route families are stable:

- cover/poster/backdrop asset endpoints
- subtitle upload/download endpoints
- HLS/preview/trickplay/video-stream endpoints
- audio stream endpoints

- [ ] **Step 2: Preserve URL shape**

Keep current public URLs stable:

```txt
/assets/...
/api/video-stream/...
/api/audio-stream/...
```

Do not change the frontend-facing paths during the migration.

- [ ] **Step 3: Run focused checks**

Run:

```bash
pnpm test:parity
pnpm test:e2e
```

Expected: detail pages still render media, previews, and subtitles correctly.

- [ ] **Step 4: Commit**

```bash
git add apps/web-svelte/src/routes/assets apps/web-svelte/src/routes/api/video-stream apps/web-svelte/src/routes/api/audio-stream
git commit -m "feat(web-svelte): migrate asset and stream routes"
```

---

### Task 7: Extract Shared Job Runtime and Thin the Worker

**Files:**
- Create: `packages/job-runtime/package.json`
- Create: `packages/job-runtime/src/index.ts`
- Create: `packages/job-runtime/src/processors/*.ts`
- Modify: `apps/worker/src/runtime.ts`
- Modify: `apps/worker/src/server.ts`
- Modify: `apps/worker/src/lib/*.ts`
- Modify: `apps/api/src/lib/queues.ts`

- [ ] **Step 1: Move queue and processor registration into `packages/job-runtime`**

The shared package should own:

- queue adapter setup
- scheduler boot
- worker registration
- processor wiring
- job tracking hooks

- [ ] **Step 2: Reduce `apps/worker` to bootstrap code**

Target shape:

```ts
import { buildJobRuntime } from "@obscura/job-runtime";
const runtime = buildJobRuntime(env);
await runtime.start();
```

- [ ] **Step 3: Ensure SvelteKit can enqueue through the shared queue adapter**

The future SvelteKit `/api/jobs/*` routes should call the same shared queue functions used by the worker runtime.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm --filter @obscura/worker typecheck
pnpm test:integration
```

- [ ] **Step 5: Commit**

```bash
git add packages/job-runtime apps/worker apps/api/src/lib/queues.ts
git commit -m "refactor(worker): extract shared job runtime"
```

---

### Task 8: Flip Dev, Docker, and Release Wiring to SvelteKit

**Files:**
- Modify: `infra/docker/docker-compose.yml`
- Modify: `infra/docker/web.Dockerfile`
- Modify: `infra/docker/unified.Dockerfile`
- Modify: `infra/docker/entrypoint.sh`
- Modify: `.github/workflows/publish-dev.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `package.json`

- [ ] **Step 1: Make SvelteKit the default dev web target**

Change compose/dev scripts so local development boots `@obscura/web-svelte`.

- [ ] **Step 2: Build the SvelteKit server in the unified image**

The production image should launch:

- SvelteKit server
- worker
- postgres
- nginx

Fastify should no longer be started in the entrypoint after this step.

- [ ] **Step 3: Keep a temporary fallback switch during validation**

Use an env-gated switch only during the transition:

```sh
OBSCURA_WEB_RUNTIME=svelte
```

Delete the switch after a clean release cycle.

- [ ] **Step 4: Verify**

Run:

```bash
docker compose -f infra/docker/docker-compose.yml up --build
pnpm test:ci
pnpm test:parity
```

- [ ] **Step 5: Commit**

```bash
git add infra/docker .github/workflows package.json
git commit -m "build: switch runtime to sveltekit"
```

---

### Task 9: Burn Down Warnings, Complete Visual Parity, Then Delete Legacy Apps

**Files:**
- Modify: `apps/web-svelte/src/**/*.svelte`
- Modify: `apps/web-svelte/src/**/*.ts`
- Delete: `apps/web/**`
- Delete: `apps/api/**`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Reduce `svelte-check` warnings to zero or a small reviewed allowlist**

Start with:

- state-capture warnings
- non-reactive update warnings
- form-label/accessibility warnings

- [ ] **Step 2: Run the route-by-route parity sweep**

For every route in `e2e/parity/route-matrix.ts`:

- compare primary layout
- compare key controls
- compare empty/loading/error states
- compare mobile layout
- compare detail-page media behavior

- [ ] **Step 3: Remove legacy apps only after a clean parity pass**

Delete `apps/web` and `apps/api` only when:

```md
- test:ci passes
- parity harness passes
- docker boots without Fastify
- release workflow builds the Svelte image
```

- [ ] **Step 4: Run final verification**

```bash
pnpm test:ci
pnpm test:parity
pnpm test:e2e
pnpm --filter @obscura/web-svelte typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove legacy web and api apps"
```

---

## Recommended Execution Order

Execute in this exact order:

1. Task 1 — architecture freeze
2. Task 2 — parity harness
3. Task 3 — shared app core
4. Task 4 — low-risk Svelte API routes
5. Task 5 — remaining JSON route families
6. Task 7 — shared job runtime
7. Task 6 — assets/streaming
8. Task 8 — Docker/release cutover
9. Task 9 — warning burn-down and legacy deletion

## First Slice to Implement

Start with Task 2 immediately after approving this plan. Without the parity harness, every later migration step becomes opinion-driven instead of evidence-driven.

## Self-Review

### Spec coverage

- full frontend replacement: covered by Tasks 2, 4, 5, 6, 9
- full backend replacement: covered by Tasks 3, 4, 5, 6, 8, 9
- worker/job preservation with simplification: covered by Task 7
- logical parity: covered by shared-service extraction plus parity harness
- visual parity: covered by Tasks 2 and 9
- deployment/release cutover: covered by Task 8

### Placeholder scan

- no `TODO`/`TBD` markers
- no "just add tests" placeholders without commands
- cutover conditions are explicit

### Type consistency

- `packages/app-core` is the shared domain package throughout
- `packages/job-runtime` is the shared queue/runtime package throughout
- Svelte server routes consistently live under `apps/web-svelte/src/routes/api/**/+server.ts`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-21-svelte-full-stack-cutover.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
