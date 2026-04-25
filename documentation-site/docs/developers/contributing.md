---
sidebar_position: 7
title: Contributing
description: Local setup, the commit + changelog policy, and how releases are cut.
---

# Contributing

This page covers what to know before opening a PR: how to run things locally, what commits look like, and how releases get cut.

## Local development

### Prerequisites

- **Node.js 20+** (or 22 — both work).
- **pnpm** 10+ (`corepack enable` is the easiest path).
- **Docker** for the Postgres container.
- **ffmpeg**, **audiowaveform**, and the `obscura-phash` Go binary on `PATH` if you want to exercise media work outside Docker. The unified Docker image bundles these so most work happens in the container.

### Two ways to run

**The container way** (recommended for most changes):

```bash
docker compose -f infra/docker/docker-compose.yml up
```

This brings up Postgres, the SvelteKit web app, and the worker with hot reload. Web is at http://localhost:8008.

**The local way** (when you're iterating fast on the SvelteKit app):

```bash
# 1. Start Postgres (or any Postgres you control)
docker run --rm -d --name obscura-pg \
  -e POSTGRES_USER=obscura -e POSTGRES_PASSWORD=obscura -e POSTGRES_DB=obscura \
  -p 5432:5432 postgres:16-alpine

# 2. Set the env
export DATABASE_URL=postgres://obscura:obscura@localhost:5432/obscura

# 3. Migrate
pnpm --filter @obscura/db db:migrate

# 4. Run web + worker in parallel
pnpm dev
```

Web is at http://localhost:8008; the worker logs to the same terminal via turbo's interleaved output.

### Useful filters

```bash
pnpm --filter @obscura/web-svelte dev    # web only
pnpm --filter @obscura/worker dev        # worker only
pnpm --filter @obscura/db db:generate    # diff schema → new SQL migration
pnpm --filter @obscura/db db:migrate     # apply pending migrations
pnpm docs:dev                            # this site
```

## The commit policy

The CLAUDE.md "Commit & Changelog Policy" is the source of truth; the highlights:

- **Commit after every set of changes.** Don't batch; small reviewable commits are the norm.
- **Update `CHANGELOG.md` with every commit** under `## [Unreleased]`, grouped by Keep a Changelog sections (`Added` / `Changed` / `Fixed` / `Removed` / `Docs`).
- **Don't bump `package.json` versions on regular commits.** The Release workflow does that.

Suggested commit style:

```text
chore: bootstrap workspace
docs: define repo contract
feat(web): add media library shell
feat(api): add health and jobs routes
fix(worker): stabilize queue startup
```

`chore(release): …` is reserved for the Release workflow. Don't write one by hand.

### Changelog rules

Every release section (including `## [Unreleased]`) **must** start with a `### What's New` block aimed at users — non-technical, 1–2 sentences per bullet, only user-visible changes (features, major fixes, behavioral changes the user would notice).

The standard sections (`### Added` / `### Changed` / `### Fixed` / `### Removed` / `### Docs`) follow with the detailed dev-facing entries. If your change has user-visible impact, add a What's New bullet **and** a detailed entry. Internal refactors only get the detailed entry.

Entries should be written for users of the app:

- **Good:** "Subtitles now auto-enable when a preferred-language track is found on play."
- **Bad:** "Refactor `subtitleAutoEnable()` to read settings via the new resolver helper."

## Versioning

Obscura follows [SemVer](https://semver.org/) and [Keep a Changelog](https://keepachangelog.com/).

| Bump | Means |
| --- | --- |
| **MAJOR** | Breaking API, schema needs manual migration, config format changed. |
| **MINOR** | New features, new endpoints, new UI views. |
| **PATCH** | Bug fixes, UI tweaks, dep updates, docs. |

Between releases, `package.json` carries a pre-release marker (`0.21.0-dev`), meaning "the next release will be at least 0.21.0". Dev Docker images are tagged `dev` and `<version>-<short-sha>`.

Release versions are plain `X.Y.Z`. They always have a matching `## [X.Y.Z] - YYYY-MM-DD` heading in `CHANGELOG.md`. Git tags are `vX.Y.Z`.

The Dockerfile runs `pnpm release:check` on every build, and `pnpm release:check --release` on release builds (via the `RELEASE_STRICT=1` build arg). That check enforces a `CHANGELOG.md` heading exists for the current `package.json` version.

## How a release happens

Releases are cut server-side by the GitHub Actions **Release** workflow. Don't hand-edit versions, hand-edit CHANGELOG release headings, or push release tags manually.

1. Make sure `main` is green and `## [Unreleased]` has the entries you want shipped — these become the GitHub Release body verbatim.
2. Open the repo on GitHub → **Actions** → **Release** → **Run workflow**.
3. Pick the bump (`patch` / `minor` / `major`) or paste an explicit `X.Y.Z`.
4. The workflow:
   1. Runs `scripts/release/cut.mjs --phase release` on `main`. Bumps every `package.json` to `X.Y.Z`. Converts `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` and writes `RELEASE_NOTES.md`.
   2. Creates commit `chore(release): vX.Y.Z` and tag `vX.Y.Z`.
   3. Runs `scripts/release/cut.mjs --phase post` to bump every `package.json` to `X.Y.(Z+1)-dev` and commits `chore(release): begin vX.Y.(Z+1)-dev cycle`.
   4. Pushes both commits and the tag.
   5. Checks out the release tag and builds the unified Docker image with `RELEASE_STRICT=1`. Pushes to GHCR as `latest`, `X.Y.Z`, `X.Y`, and `X`.
   6. Creates a GitHub Release for `vX.Y.Z` with `RELEASE_NOTES.md` as the body.
5. The dev-image workflow skips `chore(release):` commits, so the release commit and post-bump commit don't double-trigger a dev build.

If the release workflow fails partway through, the tag may already exist. Delete the tag (`git push --delete origin vX.Y.Z`) before retrying — only do this when you're certain the release image and GitHub Release have not been published.

## CI/CD

Two automation surfaces, both in `.github/workflows/`:

- **`publish-dev.yml`** — runs on every push to `main` (except `chore(release):` commits). Builds the unified image with `RELEASE_STRICT=0`, publishes:
  - `dev` — the latest `main` commit
  - `sha-<short>` — pinned per commit
  - `<version>-<short>` — e.g. `0.21.0-abc1234`, where `<version>` is the current `-dev` marker
- **`release.yml`** — manual `workflow_dispatch` only. The flow described above.
- **`validate.yml`** — runs lint, typecheck, unit tests, integration tests on PR + push to `main` + nightly. Optional smoke e2e.
- **`documentation-site.yml`** — builds and deploys this site to GitHub Pages.

`latest` always resolves to the most recent released version. `dev` is bleeding edge with rollback safety via `sha-` tags.

## Style and quality

- **TypeScript across apps and packages.** No JS in new code.
- **Prefer typed contracts** in `@obscura/contracts` over ad-hoc object shapes.
- **Add tests with new logic** when behavior can regress. Unit tests for pure functions, integration tests for DB-dependent paths.
- **Keep app boundaries explicit:** UI + HTTP in `apps/web-svelte`, heavy work in `apps/worker`, shared logic in `packages/*`.
- **Don't introduce abstractions beyond what the task requires.** A bug fix doesn't need surrounding cleanup. Three similar lines is better than a premature abstraction.
- **Don't add error handling for scenarios that can't happen.** Trust internal code; only validate at system boundaries.

## Git hygiene

- **Avoid destructive git commands** unless explicitly necessary.
- **Don't skip hooks** with `--no-verify`.
- **Don't amend published commits.** Add a follow-up commit instead.
- **Open a PR** for non-trivial work; let CI run before merging.

## Reading order

If you're new and want to make a small change, this order tends to work:

1. Run it locally with Docker compose. Click around. Open dev tools.
2. Read [Architecture](./architecture.md) and [Monorepo Layout](./monorepo.md).
3. Find a `+server.ts` or processor that does something close to your task.
4. Trace the call chain: handler → app-core → db.
5. Make the change. Add a test. Update CHANGELOG. Commit.
