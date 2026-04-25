---
sidebar_position: 1
title: Architecture
description: The big picture — runtime processes, package boundaries, data flow.
---

# Architecture

Obscura is intentionally small. Two runtime processes, one database, and a handful of shared packages. This page is the elevator overview; the rest of the Developers section drills into each layer.

## Two processes, one database

```text
                   ┌────────────────────────┐
                   │      Browser / LAN     │
                   └────────────┬───────────┘
                                │  HTTP :8008
                                ▼
       ┌─────────────────────────────────────────────────┐
       │         apps/web-svelte  (SvelteKit)            │
       │  • SSR pages       • same-origin /api/*         │
       │  • HLS streaming   • file uploads               │
       └────────────┬─────────────────────┬──────────────┘
                    │                     │
                    │ enqueueJob()        │ SQL
                    ▼                     ▼
       ┌──────────────────────┐   ┌──────────────────────┐
       │   apps/worker        │   │   PostgreSQL 16      │
       │   (pg-boss runtime)  │◄──►   • app schema       │
       │                      │   │   • pgboss schema    │
       │  scan / probe / hls  │   │   • job_runs ledger  │
       │  fingerprint / etc.  │   └──────────────────────┘
       └──────────┬───────────┘
                  │ ffmpeg / obscura-phash / sharp / audiowaveform
                  ▼
       ┌──────────────────────┐
       │   /data/cache        │   HLS, sprites, thumbnails,
       │                      │   waveforms, scrape images
       └──────────────────────┘
```

The web app does request-time work (SSR, file streaming, lightweight reads/writes); the worker does anything that takes longer than a request cycle. Both processes share `@obscura/app-core`, talk to one PostgreSQL, and live in one container in production.

| Process | Purpose | Where |
| --- | --- | --- |
| **`apps/web-svelte`** | SvelteKit full-stack app — UI plus same-origin `/api/*`. Handles streaming, file uploads, immediate reads/writes. | Port `8008`. |
| **`apps/worker`** | pg-boss worker. Picks jobs off PostgreSQL queues and runs scan, probe, fingerprint, preview, HLS prep, import, etc. | No exposed port. |
| **PostgreSQL 16** | Application schema **and** pg-boss queue tables. The single source of truth for state. | `/data/postgres` in the container. |

That's it. No Redis, no separate API server, no message broker, no Lambdas, no microservices. Single-user, private LAN — the architecture matches the use case.

## Shared packages

```text
apps/web-svelte ──┐         ┌── packages/contracts (DTOs, routes, queue defs)
                  ├── packages/app-core ──┼── packages/db (schema, migrations)
apps/worker ──────┘                       ├── packages/media-core (discovery, fingerprint, ffprobe)
                                          ├── packages/plugins (manifest, runtime, normalizers)
                                          └── packages/stash-import (Stash YAML adapter)

apps/web-svelte ── packages/ui-svelte (design tokens, Svelte primitives)
```

| Package | Responsibility |
| --- | --- |
| **`@obscura/contracts`** | Typed DTOs, API route constants, job identifiers, queue definitions. Shared transport shapes consumed by every app and package. |
| **`@obscura/db`** | Drizzle ORM schema (`schema.ts`), versioned SQL migrations (`drizzle/`), the migration runner, and the breaking-gate. |
| **`@obscura/app-core`** | The shared application layer. CRUD, orchestration, plugin runtime, identify engine, HLS helpers, search providers, queue writes. Imported by the web app and the worker. |
| **`@obscura/media-core`** | Pure media helpers — file discovery, depth-based classification, fingerprint computation (md5, oshash, phash), ffprobe wrapper, cache directory resolution. Zero DB dependencies. |
| **`@obscura/plugins`** | Plugin manifest parsing, TypeScript loader, Python subprocess executor, result normalizers, capability types. |
| **`@obscura/stash-import`** | Stash-compat YAML scraper adapter and StashBox GraphQL client. |
| **`@obscura/ui-svelte`** | Design tokens + reusable Svelte primitives (`Button`, `Badge`, `MediaCard`, `StatusLed`, `Meter`, `Panel`). Isolated — no DB or contracts deps. |

[Monorepo Layout](./monorepo.md) walks each package and the dependency graph.

## Key architectural decisions

These are the "why is it like this" decisions. They came up enough times that we wrote them down.

### Full-stack SvelteKit + a worker

One SvelteKit process owns the UI, same-origin `/api/*` endpoints, and lightweight server orchestration. Heavy work goes to the worker. The decision was: anything that needs to outlive a request cycle becomes a job.

This replaces an earlier Next.js + Fastify + nginx stack that we found harder to operate.

### PostgreSQL 16 + Drizzle ORM

One stateful dependency — Postgres — used for both application data and the job queue. Drizzle gives us versioned SQL migrations under `packages/db/drizzle/` checked into git. No `db:push` in production.

### pg-boss for jobs

Postgres-backed queues mean no Redis, no separate broker. Job state mirrors into the `job_runs` table (a Obscura-owned ledger), which is what the Operations dashboard reads. pg-boss handles delivery; `job_runs` handles UI and triage.

### HLS on demand

Videos transcode to HLS via ffmpeg only when requested. Cached renditions are served by SvelteKit. Direct playback (HTTP range) is also supported and the default. See [HLS Streaming](./hls-streaming.md).

### Stash as an import source, not an application schema

Stash data is normalized into Obscura-owned tables on import. We do not embed the Stash schema as our schema. Compatibility (Stash YAML scrapers, StashBox endpoints) is an adapter layer in `packages/stash-import`.

### Typed contracts everywhere

DTOs, route paths, and job identifiers live in `@obscura/contracts` and are shared across both apps. No string-typed API surface.

## Data flow: a scan, end to end

A worked example to anchor the layers.

1. **User clicks Run** on the Library scan queue card.
2. SvelteKit handler `/api/jobs/queues/library-scan/run` calls `enqueueJob()` (in `packages/app-core/src/queue-writes.ts`).
3. `enqueueJob()` inserts a row into pg-boss and a paired row into `job_runs`.
4. The worker (already polling pg-boss) picks the job up and dispatches to `processLibraryScan` from `apps/worker/src/processors/`.
5. The processor uses `@obscura/media-core` to walk the library root, classifies each file (movie / flat-series episode / seasoned-series episode), and writes new entity rows via `@obscura/app-core`.
6. For each new file, the processor enqueues downstream jobs: `media-probe`, `fingerprint`, then `preview` once probe data is in.
7. Each downstream job repeats the loop — pg-boss + `job_runs` row + worker processor.
8. The Operations dashboard polls `/api/jobs/dashboard` every 5 s, reads from `job_runs`, and shows the live state to the user.

That pattern — handler → enqueue → worker processor → DB write → optionally enqueue more — is the spine of every async operation in the app.

## Where everything is

The folders that matter day-to-day:

```text
apps/web-svelte/
  src/routes/             SvelteKit pages and API endpoints
  src/lib/server/         Server-side helpers
  src/lib/components/     UI components
apps/worker/
  src/processors/         One file per queue
  src/runtime.ts          Worker boot / handler registration

packages/app-core/src/    The shared app layer
packages/contracts/src/   DTOs, routes, queue defs
packages/db/src/          Schema, migrations, breaking-gate
packages/db/drizzle/      Generated SQL migrations
packages/media-core/src/  Discovery, ffprobe, fingerprint
packages/plugins/src/     Manifest, runtimes, normalizers
packages/ui-svelte/src/   Design system

infra/docker/             Dockerfiles and dev compose
infra/phash/              Go binary for Stash-compatible pHash
.github/workflows/        CI/CD
docs/                     Architecture & design language MDs
documentation-site/       This site
```

Read on:

- [Monorepo Layout](./monorepo.md) — every package + dependency graph
- [Database](./database.md) — schema, migrations, breaking-gate
- [API & Jobs](./api-and-jobs.md) — request and queue contracts
- [HLS Streaming](./hls-streaming.md) — the transcode and caching pipeline
- [Design Language](./design-language.md) — Dark Room, sharp + glass + brass
- [Contributing](./contributing.md) — commit, changelog, release flow
