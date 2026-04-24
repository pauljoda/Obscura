---
sidebar_position: 1
title: Architecture
description: Runtime and package boundaries for Obscura.
---

# Architecture

Obscura is a pnpm and Turbo monorepo with two runtime processes:

- `apps/web-svelte`: SvelteKit full-stack app, UI, same-origin `/api` routes, streaming endpoints, and lightweight server orchestration.
- `apps/worker`: pg-boss worker for durable scan, probe, thumbnail, sprite, HLS, fingerprint, and import jobs.

PostgreSQL 16 is the only stateful dependency. It stores application data and backs the job queue.

## Shared packages

| Package | Responsibility |
| --- | --- |
| `@obscura/contracts` | Typed DTOs, route constants, job identifiers, and shared transport shapes. |
| `@obscura/db` | Drizzle schema, migrations, and database runtime helpers. |
| `@obscura/app-core` | Shared reads, writes, orchestration, plugin runtime, and server logic. |
| `@obscura/media-core` | File discovery, fingerprinting, scan primitives, and media helpers. |
| `@obscura/plugins` | Native plugin manifests, execution helpers, auth, normalizers, and Stash compatibility. |
| `@obscura/ui-svelte` | Design tokens and reusable Svelte primitives. |

## Database migrations

Schema lives in `packages/db/src/schema.ts`. Versioned SQL migrations live in `packages/db/drizzle/` and are applied by `packages/db/src/migrate.ts`.

When adding a schema change:

1. Edit the schema.
2. Run `pnpm --filter @obscura/db db:generate`.
3. Read the generated SQL and fix destructive output by hand.
4. Commit the schema, SQL migration, snapshot, and journal changes together.

Never use `db:push` against a deployment you care about. It bypasses the migration ledger.

## Deployment

Development uses `infra/docker/docker-compose.yml`. Production uses the unified image at `ghcr.io/pauljoda/obscura`, which bundles PostgreSQL, ffmpeg, SvelteKit, and the worker behind port `8008`.
