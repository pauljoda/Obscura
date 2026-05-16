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

- **Every release section (including `## [Unreleased]`) MUST begin with a `### What's New` block** before the standard Keep a Changelog groups. This is a plain-language summary of user-visible highlights — written so a non-technical user can scan it and know what changed. Keep each bullet to 1–2 sentences. Only include features, major fixes, or behavioral changes a user would notice; skip internal refactors, code cleanup, and dependency bumps.
- When adding a changelog entry during development: if the change is a new feature, a significant UI change, or a notable bug fix, **also add or update a bullet in `### What's New`**. Minor internal changes (refactors, code splits, dev tooling) only go in the standard sections below.
- The standard Keep a Changelog sections (`### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Docs`) follow after `### What's New` and contain the full detailed entries as before.
- Entries should be written for users of the app, not for the diff reader. Explain user-visible behavior and why it changed.
- Use past tense and lead with the user-visible change (`"Subtitles now…"`), not the implementation detail.

## Product

Obscura is a private self-hosted media browser. It is video-first, but supports images and galleries as first-class library entities. Optimized for a single trusted user on a private LAN, deployed via Docker.

## Project Structure

```
apps/web-svelte/   — Svelte frontend only. Built as static assets and served by the .NET API.
apps/backend/      — .NET API, application/domain/infrastructure layers, EF Core persistence, and .NET worker.

packages/contracts/ — Frontend TypeScript constants and compatibility DTOs while surfaces migrate to generated .NET OpenAPI types
packages/media-core/ — File discovery, fingerprint, scan primitives
packages/plugins/  — Plugin runtime helpers and contracts
packages/stash-import/ — Stash migration adapter
packages/ui-svelte/ — Shared Svelte design tokens and UI primitives

infra/docker/      — Dockerfiles and dev compose stack
scripts/release/   — Version validation tooling
docs/              — Architecture and design language docs
```

## Architecture

- Monorepo with `pnpm` workspaces and `turbo`.
- Runtime processes: .NET API/HTTP ingress, static Svelte frontend assets, and the .NET worker.
- PostgreSQL 16 is the sole stateful dependency — used for application data and queue/job state.
- Public HTTP contracts live in the .NET backend and are consumed by the generated Svelte client under `apps/web-svelte/src/lib/api/generated`.

## Key Architectural Decisions

1. **.NET API + static Svelte UI** — The .NET API owns all HTTP endpoints, persistence, and server orchestration. Svelte is a frontend client only.
2. **PostgreSQL + EF Core** — Typed schema and versioned migrations are managed from `apps/backend/src/Obscura.Infrastructure/Persistence`.
3. **.NET background worker** — Long-running scan, probe, thumbnail, sprite, HLS, and import work runs in `apps/backend/src/Obscura.Worker`. Job state is mirrored into the `job_runs` table, which is the single source of truth for the Operations dashboard. No Redis and no TypeScript worker.
4. **HLS streaming** — Videos are transcoded to HLS on demand via ffmpeg. Cached renditions are served by the .NET API.
5. **Stash as import source** — Stash is a migration/import source, not the application schema. Imported data is normalized into Obscura-owned tables.
6. **Typed contracts** — .NET contracts are the server source of truth. The frontend should prefer generated OpenAPI types; `@obscura/contracts` is frontend compatibility only.

## Database

- PostgreSQL 16 via EF Core/Npgsql in the .NET backend.
- Schema is defined by EF Core entity mappings in `apps/backend/src/Obscura.Infrastructure/Persistence`.
- Core entities: videos (series/seasons/episodes/movies), performers, studios, tags, fingerprints, library_roots, settings.
- **Versioned EF Core migrations ship in releases.** Migration files live under `apps/backend/src/Obscura.Infrastructure/Persistence/Migrations` and are applied by the .NET runtime on startup.
- **Adding a schema change:**
  1. Edit the EF Core entity/model mapping.
  2. Generate an EF migration from `apps/backend`.
  3. **Open the migration and read it.** Fix destructive or accidental operations before committing.
  4. Commit the migration, model snapshot, entity/mapping changes, tests, and changelog entry together.
  5. Apply locally by restarting the .NET API or worker and verify.
- **Never reintroduce Drizzle, SvelteKit `/api` routes, or a TypeScript worker.**

### Breaking-change policy

Obscura is pre-1.0. We do not maintain a staging/finalize data-migration framework or a push-era legacy-install bridge. When a schema change would destroy user data (e.g. dropping a populated table), do this instead:

1. Ship the change as a normal EF Core migration with explicit, reviewed SQL when needed.
2. Call out the break in `CHANGELOG.md` under `### What's New` — describe what breaks, what the user should do (usually "rescan your library roots"), and why.
3. If the data loss is severe enough that we want explicit consent before it happens, add a single-purpose one-time break-gate in the .NET backend and surface consent through the Svelte UI. Don't abstract this into a framework — copy the existing pattern if a future break needs it, or delete the old gate when it's no longer relevant.

No bridges, no staging tables, no legacy-schema snapshots. Early users expect breakage; make it loud and move on.

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

- TypeScript is required in the Svelte frontend and TypeScript packages; C# is required for all server, persistence, and worker logic.
- Prefer typed contracts over ad hoc object shapes.
- When making layout, interaction, or styling changes, first look for the base component that owns the pattern and prefer changing that component unless the behavior is truly specific to one route. Core components such as `EntityThumbnail`, `EntityGrid`, and `EntityDetail` should carry shared behavior; route-specific needs should be evaluated as configurable hooks, props, snippets, or composition points on the base component so other pages can reuse the same customization path.
- Public classes, records, interfaces, and non-trivial public methods should have rich documentation comments that explain the domain meaning, parameters, return values, and important behavior. Prefer C# XML documentation comments for .NET code so IDEs surface the intent while editing.
- Add tests with new logic when behavior can regress.
- Keep app boundaries explicit: UI in `apps/web-svelte`, HTTP/persistence/worker logic in `apps/backend`, and frontend-only shared utilities in `packages/*`.

## Docker

- Development: `docker compose -f infra/docker/docker-compose.yml up` runs Vite, the .NET API, the .NET worker, and PostgreSQL with hot reload.
- Production: single unified image (`ghcr.io/pauljoda/obscura`) bundles PostgreSQL, ffmpeg, the built Svelte frontend, the .NET API, and the .NET worker.
- Per-service Dockerfiles remain in `infra/docker/` for development; the unified build uses `infra/docker/unified.Dockerfile`.
- The .NET API listens on port 8008, serves same-origin `/api/*` routes, and serves the built Svelte assets.
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

- Local dev stack restarts must use the canonical VS Code workflow. Do not start a second API, worker, or Vite instance on an alternate port for live verification. When the running stack needs to be refreshed, first tell the user that the dev stack is being rebooted, run `pnpm dev:kill` (equivalent VS Code task: `Obscura: Kill Orphans`) to clear orphaned .NET/Vite/Docusaurus processes and dev ports, then launch the VS Code compound `Obscura: Full Stack` (preLaunch task: `Obscura: Full Prebuild`; configurations: `Obscura: API` and `Obscura: Worker`). Use `Obscura: Full Stack + Chrome` only when browser launch is explicitly useful.
- Avoid destructive git commands unless explicitly requested.
- Keep the repo runnable via Docker Compose.
- Prefer lightweight validation commands before committing.
