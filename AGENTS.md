# Obscura Repository Contract

## Commit & Changelog Policy

- **You MUST ALWAYS commit after every set of changes.** Do not wait for the user to ask — commit immediately when a logical unit of work is complete.
- Every meaningful implementation iteration must end in a git commit.
- Use small, reviewable commits with intentional scopes.
- **With every commit you MUST also** add an entry under `## [Unreleased]` in `CHANGELOG.md`, grouped by the Keep a Changelog sections (`Added` / `Changed` / `Fixed` / `Removed` / `Docs`).
- **Do NOT bump `package.json` versions on regular commits.** The version only changes when a release is cut by the Release workflow. Between releases, the root `package.json` carries a pre-release marker such as `0.14.0-dev`, and all workspace packages mirror it.
- Follow [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).
- Suggested commit style:
  - `chore: bootstrap workspace`
  - `docs: define repo contract`
  - `feat(web): add media library shell`
  - `feat(api): add health and jobs routes`
  - `fix(worker): stabilize queue startup`
- Do not batch unrelated changes into a single commit.
- `chore(release): …` commits are reserved for the Release workflow. Never create them by hand.

### Versioning

- The root `package.json` version is the single source of truth. All workspace `package.json` files must match it exactly.
- Between releases, the version is `X.Y.Z-dev` (for example `0.14.0-dev`), meaning "the next release will be at least `X.Y.Z`". Dev Docker images are tagged `ghcr.io/pauljoda/obscura:dev` and `…:<version>-<short-sha>`.
- Release versions are plain `X.Y.Z` with no suffix. They always have a matching `## [X.Y.Z] - YYYY-MM-DD` heading in `CHANGELOG.md`.
- Git release tags are `vX.Y.Z`.
- The Dockerfile runs `pnpm release:check` on every build, and `pnpm release:check --release` on release builds (via the `RELEASE_STRICT=1` build arg), which enforces that a versioned CHANGELOG heading matches `package.json`.
- **MAJOR**: Breaking API changes, DB schema changes requiring manual migration, config format changes.
- **MINOR**: New features, new API endpoints, new UI views.
- **PATCH**: Bug fixes, UI tweaks, dependency updates, docs.

### How to publish a release

Releases are cut server-side by the GitHub Actions `Release` workflow. Do not hand-edit versions, hand-edit CHANGELOG release headings, or push release tags manually.

1. Make sure `main` is green, all the changes you want in the release are merged, and `## [Unreleased]` in `CHANGELOG.md` is populated with human-readable entries — these become the GitHub Release body verbatim.
2. Open the repository on GitHub → **Actions** → **Release** → **Run workflow**.
3. Pick the bump level (`patch` / `minor` / `major`) or paste an explicit `X.Y.Z` version (overrides the bump).
4. The workflow will:
   1. Run `scripts/release/cut.mjs --phase release` on main, which bumps every `package.json` to `X.Y.Z`, converts `## [Unreleased]` into `## [X.Y.Z] - YYYY-MM-DD` (leaving a fresh empty `## [Unreleased]` above it), and writes `RELEASE_NOTES.md`.
   2. Create commit `chore(release): vX.Y.Z` and tag `vX.Y.Z`.
   3. Run `scripts/release/cut.mjs --phase post`, which bumps every `package.json` to the next dev marker (`X.Y.(Z+1)-dev`) and commits `chore(release): begin vX.Y.(Z+1)-dev cycle`.
   4. Push both commits to `main` and push the tag.
   5. Check out the release tag and build the unified Docker image with `RELEASE_STRICT=1`, pushing it to GHCR as `latest`, `X.Y.Z`, `X.Y`, and `X`.
   6. Create a GitHub Release for `vX.Y.Z` with `RELEASE_NOTES.md` as the body.
5. The `Build Dev Image` workflow is wired to skip any commit whose message starts with `chore(release):`, so the release commit and post-release dev-bump commit do not double-trigger a dev build.
6. If the release workflow fails partway through, the tag may already exist. Delete the tag (`git push --delete origin vX.Y.Z`) before retrying. Only do this when you're certain the release image and GitHub Release have not been published.

### Release notes discipline

- Entries under `## [Unreleased]` should be written for users of the app, not for the diff reader. Explain user-visible behavior and why it changed.
- Group by `### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Docs`.
- Use past tense and lead with the user-visible change (`"Subtitles now…"`), not the implementation detail.

## Product

Obscura is a private self-hosted media browser. It is video-first, but supports images and galleries as first-class library entities. Optimized for a single trusted user on a private LAN, deployed via Docker.

## Project Structure

```
apps/web/          — Next.js 15 App Router frontend (port 8008)
apps/api/          — Fastify 5 HTTP API (port 4000)
apps/worker/       — pg-boss background worker

packages/ui/       — Design tokens, shared components (shadcn/ui base)
packages/contracts/ — Typed DTOs, route constants, job identifiers
packages/db/       — Shared Drizzle schema and database utilities
packages/media-core/ — File discovery, fingerprint, scan primitives
packages/stash-import/ — Stash migration adapter

infra/docker/      — Dockerfiles and dev compose stack
scripts/release/   — Version validation tooling
docs/              — Architecture and design language docs
```

## Architecture

- Monorepo with `pnpm` workspaces and `turbo`.
- Three services: web (Next.js), api (Fastify), worker (pg-boss).
- PostgreSQL 16 is the sole stateful dependency — used for both application data and the job queue.
- All services share typed contracts via `@obscura/contracts`.

## Key Architectural Decisions

1. **Separate services** — UI, API, and worker run as independent processes. This keeps concerns isolated and allows independent scaling.
2. **PostgreSQL + Drizzle ORM** — Typed schema with push-based migrations during development, SQL migration files for production.
3. **pg-boss job queue** — Postgres-backed job queues for scan, probe, thumbnail, sprite, HLS, and import jobs. Job state is mirrored into the `job_runs` table, which is the single source of truth for the Operations dashboard. No Redis.
4. **HLS streaming** — Videos are transcoded to HLS on demand via ffmpeg. Cached renditions are served by the API.
5. **Stash as import source** — Stash is a migration/import source, not the application schema. Imported data is normalized into Obscura-owned tables.
6. **Typed contracts** — All DTOs, route paths, and job identifiers live in `@obscura/contracts` and are shared across all apps.

## Database

- PostgreSQL 16 via `postgres` driver and `drizzle-orm`.
- Schema defined in `apps/api/src/db/schema.ts`.
- Core entities: scenes, performers, studios, tags, fingerprints, library_roots, settings.
- **Versioned migrations, not `push`, ship in releases.** Migration SQL files live under `apps/api/drizzle/` and are applied by `apps/api/src/db/migrate.ts` (runs from both `pnpm --filter @obscura/api db:migrate` and the production Docker entrypoint). Each file records a row in `drizzle.__drizzle_migrations` so migrations apply exactly once per database.
- **Adding a schema change:**
  1. Edit `apps/api/src/db/schema.ts`.
  2. Run `pnpm --filter @obscura/api db:generate` to produce a new `drizzle/NNNN_<name>.sql` file.
  3. **Open the file and read it.** drizzle-kit is conservative but will emit destructive SQL (drops, column renames seen as drop+add) when it can't tell your intent — fix it by hand before committing.
  4. Commit both the `.sql` file and the updated `drizzle/meta/_journal.json` alongside the schema edit.
  5. Apply locally with `pnpm --filter @obscura/api db:migrate` and verify data is intact.
- **Never run `db:push` against a deployment you care about.** It bypasses the migration ledger, applies every inferred diff in one shot, and — with `--force` — has no veto for destructive drops. `db:push` is only appropriate for throwaway/fresh dev databases. The production Docker entrypoint used to run `drizzle-kit push --force` on every boot and nearly wiped real data on an upgrade — that's why this repo now ships migrations instead.
- **Legacy install bridge.** `apps/api/src/db/migrate.ts` detects deployments that were originally provisioned with `drizzle-kit push` (core tables exist, `drizzle.__drizzle_migrations` does not). For those it applies a small set of pre-baseline deltas specific to this release, then seeds every journal entry into `__drizzle_migrations` so the migrator treats the existing schema as the baseline and only runs *new* migrations added on top. If you need to ship a pre-baseline delta in a future release, add it to the `hasCore && !hasMigrationsTable` block **and** a corresponding new migration file — existing installs hit the bridge; fresh installs hit the migration.

## Design System Rules

- Follow the `Dark Room` visual direction (see `docs/design-language.md`).
- **Sharp corners everywhere** — `border-radius: 0` on all elements, no exceptions.
- **Material base + glass overlay** — solid dark surfaces as the ground layer; glass (`backdrop-filter: blur` + semi-transparent fill) for floating and interactive elements.
- Five-level material surface hierarchy: bg → surface-1 → surface-2 → surface-3 → surface-4. Three glass layers: glass-1 → glass-2 → glass-3.
- Brass accent (`#c49a5a`) — used only on active/selected states. Always expressed with glow (`box-shadow` blur), never flat. Accent gradients for fills.
- **Mobile first** — design and build for mobile layout first. Desktop is an expansion, not a fallback.
- Three font voices: Geist (headings), Inter (body), JetBrains Mono (utility/metadata).
- Glow and animation express state — selection, focus, and activity use `glow-pulse` or full glow `box-shadow`. No static color-only state changes.
- Avoid generic SaaS styling and unmodified shadcn defaults.
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
- Production: single unified image (`ghcr.io/pauljoda/obscura`) bundles PostgreSQL, nginx, ffmpeg, and all three services.
- Per-service Dockerfiles remain in `infra/docker/` for development; the unified build uses `infra/docker/unified.Dockerfile`.
- nginx reverse proxy on port 8008 routes `/api/*` to Fastify (4000) and everything else to Next.js (3000) internally.
- Volumes: `/data` (database, cache, thumbnails) and `/media` (user media library).

## CI/CD

Two GitHub Actions workflows manage the image lifecycle:

- **`.github/workflows/publish-dev.yml`** (`Build Dev Image`) — runs on every push to `main` (except `chore(release):` commits). Builds the unified image with `RELEASE_STRICT=0` and publishes it to `ghcr.io/pauljoda/obscura` as:
  - `dev` — always the latest commit on `main`
  - `sha-<short-sha>` — pinned per commit, for rollback
  - `<version>-<short-sha>` — e.g. `0.14.0-abc1234`, where `<version>` is the current `-dev` marker in `package.json`
- **`.github/workflows/release.yml`** (`Release`) — manual `workflow_dispatch` only. Bumps the version, rewrites the CHANGELOG, commits + tags, builds the release image with `RELEASE_STRICT=1`, pushes it as `latest`, `X.Y.Z`, `X.Y`, and `X`, and creates a GitHub Release with the extracted changelog section as the body. See **How to publish a release** above.

`latest` always resolves to the most recent released version. Users who want the bleeding edge should pin `dev`. Users who want a known-good build from a specific commit should pin `sha-<short-sha>`.

- Uses Docker Buildx with GitHub Actions cache.
- Platform: `linux/amd64`.

## Tooling Expectations

- Avoid destructive git commands unless explicitly requested.
- Keep the repo runnable via Docker Compose.
- Prefer lightweight validation commands before committing.
