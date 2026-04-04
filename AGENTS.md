# Obscura Repository Contract

## Commit & Changelog Policy

- Every meaningful implementation iteration must end in a git commit.
- Use small, reviewable commits with intentional scopes.
- Update `CHANGELOG.md` after each commit — add entries under `## [Unreleased]`.
- Follow [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).
- Suggested commit style:
  - `chore: bootstrap workspace`
  - `docs: define repo contract`
  - `feat(web): add media library shell`
  - `feat(api): add health and jobs routes`
  - `fix(worker): stabilize queue startup`
- Do not batch unrelated changes into a single commit.

### Versioning

- The root `package.json` version is the single source of truth.
- Git release tags must be `vX.Y.Z`.
- Run `pnpm release:check` before tagging — it validates semver format and changelog headings.
- Do not create release tags when version and changelog are out of sync.
- **MAJOR**: Breaking API changes, DB schema changes requiring manual migration, config format changes.
- **MINOR**: New features, new API endpoints, new UI views.
- **PATCH**: Bug fixes, UI tweaks, dependency updates, docs.

## Product

Obscura is a private self-hosted media browser. It is video-first, but supports images and galleries as first-class library entities. Optimized for a single trusted user on a private LAN, deployed via Docker.

## Project Structure

```
apps/web/          — Next.js 15 App Router frontend (port 8008)
apps/api/          — Fastify 5 HTTP API (port 4000)
apps/worker/       — BullMQ background worker

packages/ui/       — Design tokens, shared components (shadcn/ui base)
packages/contracts/ — Typed DTOs, route constants, job identifiers
packages/config/   — Shared TypeScript and lint configuration
packages/media-core/ — File discovery, fingerprint, scan primitives
packages/stash-import/ — Stash migration adapter

infra/docker/      — Dockerfiles and dev compose stack
scripts/release/   — Version validation tooling
docs/              — Architecture and design language docs
```

## Architecture

- Monorepo with `pnpm` workspaces and `turbo`.
- Three services: web (Next.js), api (Fastify), worker (BullMQ).
- PostgreSQL 16 for persistence, Redis 7 for queue coordination.
- All services share typed contracts via `@obscura/contracts`.

## Key Architectural Decisions

1. **Separate services** — UI, API, and worker run as independent processes. This keeps concerns isolated and allows independent scaling.
2. **PostgreSQL + Drizzle ORM** — Typed schema with push-based migrations during development, SQL migration files for production.
3. **BullMQ + Redis** — Durable job queues for scan, probe, thumbnail, sprite, HLS, and import jobs. Restart-safe with progress reporting.
4. **HLS streaming** — Videos are transcoded to HLS on demand via ffmpeg. Cached renditions are served by the API.
5. **Stash as import source** — Stash is a migration/import source, not the application schema. Imported data is normalized into Obscura-owned tables.
6. **Typed contracts** — All DTOs, route paths, and job identifiers live in `@obscura/contracts` and are shared across all apps.

## Database

- PostgreSQL 16 via `postgres` driver and `drizzle-orm`.
- Schema defined in `apps/api/src/db/schema.ts`.
- Core entities: scenes, performers, studios, tags, fingerprints, library_roots, settings.
- Run `pnpm --filter @obscura/api db:push` to apply schema changes in development.

## Design System Rules

- Follow the `Dark Control Room` visual direction (see `docs/design-language.md`).
- Five-level surface hierarchy: bg → surface-1 → surface-2 → surface-3 → surface-4.
- Burnished brass accent (#c79b5c) — rare and meaningful, only on active/selected states.
- Three font voices: Geist (headings), Inter (body), JetBrains Mono (utility/metadata).
- Avoid generic SaaS styling and unmodified shadcn defaults.
- Desktop and mobile are both first-class targets.
- Core actions must not depend on hover-only affordances.

## Data & Integration Rules

- Do not embed the legacy Stash schema as the application schema.
- Treat Stash as a migration/import source and conceptual reference.
- Normalize imported hashes and metadata into Obscura-owned tables and contracts.
- Keep provider integrations behind stable adapter interfaces.

## Quality Bar

- TypeScript is required across apps and packages.
- Prefer typed contracts over ad hoc object shapes.
- Add tests with new logic when behavior can regress.
- Keep app boundaries explicit: UI in `apps/web`, transport in `apps/api`, heavy work in `apps/worker`, shared logic in `packages/*`.

## Docker

- Development: `docker compose -f infra/docker/docker-compose.yml up` runs all services with hot reload.
- Production: multi-stage Alpine builds for each service, published to GHCR.
- Images: `ghcr.io/pauljoda/obscura-web`, `obscura-api`, `obscura-worker`.
- ffmpeg is included in api and worker images for video processing.

## CI/CD

- GitHub Actions workflow builds and pushes Docker images on push to `main`.
- Uses Docker Buildx with GitHub Actions cache.
- Images are tagged with `latest` (on main), git SHA, and semver patterns.
- Platform: `linux/amd64`.

## Tooling Expectations

- Avoid destructive git commands unless explicitly requested.
- Keep the repo runnable via Docker Compose.
- Prefer lightweight validation commands before committing.
