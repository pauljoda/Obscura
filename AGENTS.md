# Obscura Repository Contract

## Product

Obscura is a private self-hosted media browser for adult content. It is video-first, but must also support images and galleries as first-class library entities. The product is optimized for a single trusted user on a private LAN and is expected to run in Docker.

## Architecture

- Use a monorepo with `pnpm` workspaces and `turbo`.
- Primary apps:
  - `apps/web` - Next.js App Router client
  - `apps/api` - Fastify HTTP API
  - `apps/worker` - BullMQ background worker
- Primary packages:
  - `packages/ui`
  - `packages/contracts`
  - `packages/config`
  - `packages/media-core`
  - `packages/stash-import`
- Infrastructure lives under `infra/docker`.

## Design System Rules

- Follow the `Dark Control Room` visual direction.
- Avoid generic SaaS styling and unmodified shadcn defaults.
- Use shared design tokens from `packages/ui`.
- Desktop and mobile are both first-class targets.
- Core actions must not depend on hover-only affordances.

## Data And Integration Rules

- Do not embed the legacy stash schema as the application schema.
- Treat stash as a migration/import source and conceptual reference.
- Normalize imported hashes and metadata into Obscura-owned tables and contracts.
- Keep provider integrations behind stable adapter interfaces.

## Versioning

- Follow semantic versioning.
- The root `package.json` version is canonical.
- Git release tags must be `vX.Y.Z`.
- `CHANGELOG.md` must be updated for each release.
- Do not create release tags when version and changelog are out of sync.

## Commit Discipline

- Every meaningful implementation iteration must end in a git commit.
- Use small, reviewable commits with intentional scopes.
- Suggested commit style:
  - `chore: bootstrap workspace`
  - `docs: define repo contract`
  - `feat(web): add media library shell`
  - `feat(api): add health and jobs routes`
  - `fix(worker): stabilize queue startup`
- Do not batch unrelated changes into a single commit.

## Quality Bar

- TypeScript is required across apps and packages.
- Prefer typed contracts over ad hoc object shapes.
- Add tests with new logic when behavior can regress.
- Keep app boundaries explicit: UI concerns stay in `apps/web`, transport and orchestration in `apps/api`, heavy background work in `apps/worker`, reusable domain logic in `packages/*`.

## Tooling Expectations

- Use `apply_patch` for direct file edits.
- Avoid destructive git commands unless explicitly requested.
- Keep the repo runnable via Docker Compose.
- Prefer lightweight validation commands before committing.

