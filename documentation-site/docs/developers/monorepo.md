---
sidebar_position: 2
title: Monorepo Layout
description: Every workspace, what it does, and the dependency graph.
---

# Monorepo Layout

The repo is a pnpm + turbo monorepo. Workspaces are declared in `pnpm-workspace.yaml`:

```yaml title="pnpm-workspace.yaml"
packages:
  - apps/*
  - documentation-site
  - packages/*
```

## Apps

| Path | Purpose |
| --- | --- |
| `apps/web-svelte` | SvelteKit web app + same-origin `/api/*`. Listens on port `8008`. Uses `@obscura/app-core`, `@obscura/contracts`, `@obscura/db`, `@obscura/media-core`, `@obscura/ui-svelte`, plus `hls.js` for client playback. |
| `apps/worker` | pg-boss background worker. Registers a handler per queue defined in `@obscura/contracts`, dispatches into processors under `apps/worker/src/processors/`, writes to `job_runs`. Uses `@obscura/app-core`, `@obscura/contracts`, `@obscura/db`, `@obscura/media-core`, plus `sharp` for image work. |
| `documentation-site` | This Docusaurus site. Independent of the runtime apps. |

## Packages

```text
@obscura/contracts
        ▲
        │
        ├─ @obscura/db ──────┐
        │                    │
        ├─ @obscura/media-core ─┐
        │                       │
        ├─ @obscura/plugins ────┼── @obscura/app-core ── apps/web-svelte
        │                       │                     ╲
        ├─ @obscura/stash-import ──────────────────────╲── apps/worker
        │
        └─ @obscura/ui-svelte ── apps/web-svelte
```

| Package | What lives there |
| --- | --- |
| **`@obscura/contracts`** | Typed DTOs, API route paths, queue definitions, media constants (HLS rendition presets, supported video extensions). The neutral wire-format package — no DB, no business logic. |
| **`@obscura/db`** | Drizzle ORM schema (`src/schema.ts`), migration runner (`src/migrate.ts`), versioned SQL files in `drizzle/`, and the breaking-gate (`src/breaking-gate.ts`). Depends on `contracts` and `media-core`. |
| **`@obscura/media-core`** | File discovery (`isVideoFile`, `supportedVideoExtensions`), depth-based classification (`classifier/`), fingerprint computation (md5/oshash/phash via shelled-out binaries), ffprobe wrapper, cache directory resolution. Pure functions; no DB. |
| **`@obscura/plugins`** | Plugin manifest parser, TypeScript loader, Python subprocess executor, capability types, result normalizers. Depends on `contracts`, `db`, `media-core`, `stash-import`. |
| **`@obscura/stash-import`** | Stash-compat YAML scraper adapter and StashBox GraphQL client. Used by `plugins` for legacy interop. |
| **`@obscura/app-core`** | The shared application layer: CRUD writes, plugin execution glue, identify engine, search providers, HLS helpers, queue writers. Depends on everything above. Imported by both apps. |
| **`@obscura/ui-svelte`** | Design tokens, Svelte primitives (`Button`, `Badge`, `Checkbox`, `MediaCard`, `StatusLed`, `Meter`, `Panel`), and shared utilities (trickplay sprite renderer, classification tree). Isolated — no DB, no contracts. |

## Turbo configuration

`turbo.json` defines the task graph. Highlights:

- **`build`** is topologically ordered (`^build`) — packages build before the apps that depend on them.
- **`dev`** is a `persistent: true`, non-cached task. `pnpm dev` runs `web-svelte` and `worker` in parallel via the filter.
- **`lint`**, **`typecheck`**, and **`test`** are independent; they fan out across the whole graph.
- Global env vars passed to every task: `DATABASE_URL`, `PUBLIC_API_URL`, `PUBLIC_APP_URL`, `NODE_ENV`, `PORT`, `HOST`.

## Useful root scripts

```bash
pnpm dev          # parallel web + worker via turbo --filter
pnpm build        # turbo build (topological)
pnpm lint         # turbo run lint
pnpm typecheck    # turbo run typecheck
pnpm check        # lint + typecheck
pnpm test:unit    # vitest unit tests (fast, no DB)
pnpm test:integration  # vitest with testcontainers/postgresql
pnpm test:web-svelte   # Svelte component tests
pnpm test:e2e     # Playwright against the running app
pnpm docs:dev     # Docusaurus dev server (this site)
pnpm docs:build   # Static build of the docs site
```

Per-package scripts you'll reach for:

```bash
pnpm --filter @obscura/db db:generate    # diff schema → write a new SQL migration
pnpm --filter @obscura/db db:migrate     # apply pending migrations to DATABASE_URL
pnpm --filter @obscura/web-svelte dev    # web only
pnpm --filter @obscura/worker dev        # worker only
```

## Dependency rules of thumb

- **Apps depend on packages, never the other way.** If you find yourself importing `apps/web-svelte` from a package, restructure.
- **`ui-svelte` is isolated.** Don't add DB or contracts deps there — it's the design system.
- **Contracts are the wire format.** They're deliberately minimal so they can be imported anywhere without dragging in heavyweight transitive deps.
- **`app-core` is the shared application layer.** If logic is shared between the web app and the worker, it lives here. UI-only logic stays in `web-svelte`; queue-handler-only logic stays in `worker`.
- **Don't reach across apps.** `web-svelte` doesn't import from `worker` and vice versa. The shared surface is `app-core`.

## Where to put new code

A small decision matrix:

| You're adding… | It goes in… |
| --- | --- |
| A new SvelteKit page | `apps/web-svelte/src/routes/.../+page.svelte` |
| A new HTTP endpoint | `apps/web-svelte/src/routes/api/.../+server.ts` (thin handler) + `packages/app-core/src/...` (the actual write) |
| A new background job | A new queue in `packages/contracts`, a processor in `apps/worker/src/processors/`, plus an `enqueueJob` call site |
| A new DB table or column | `packages/db/src/schema.ts` then `pnpm --filter @obscura/db db:generate`. Read the SQL output before committing. |
| A new design primitive | `packages/ui-svelte/src/primitives/` |
| A new plugin runtime feature | `packages/plugins/` |

## Reading order, if you're new

1. Skim `pnpm-workspace.yaml` and `turbo.json` to see the workspace shape.
2. Open `packages/contracts/src/index.ts` — gives you the wire format and the queue list in two screens.
3. Open `packages/db/src/schema.ts` to see the data model.
4. Pick one feature you care about and trace it: handler in `apps/web-svelte/src/routes/api/.../+server.ts` → write in `packages/app-core` → table in `packages/db/src/schema.ts`.
5. If async: also look at the matching processor in `apps/worker/src/processors/`.
