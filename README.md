# Obscura

Obscura is a private, self-hosted media browser for adult content. It is optimized for video libraries, with first-class support for images and galleries, and is designed for private LAN use through Docker.

## Stack

- `Next.js` for the web client
- `Fastify` for the API
- `BullMQ` workers for long-running media jobs
- `PostgreSQL` for application data
- `Redis` for queue coordination
- `pnpm` workspaces + `turbo` for monorepo orchestration

## Workspace Layout

- `apps/web` - Next.js UI
- `apps/api` - HTTP API
- `apps/worker` - queue workers
- `packages/ui` - design system tokens and shared UI helpers
- `packages/contracts` - shared DTOs and API contracts
- `packages/config` - shared TypeScript and lint config
- `packages/media-core` - media scanning and metadata primitives
- `packages/stash-import` - stash bootstrap import pipeline
- `infra/docker` - Dockerfiles and compose files

## Getting Started

This repo is scaffolded for Docker-first development. Dependency installation and runtime bootstrapping are intentionally not executed automatically in this initial foundation commit.

Planned local workflow:

1. `pnpm install`
2. `docker compose up --build`
3. `pnpm dev`

## Versioning

Obscura follows semantic versioning. The root `package.json` version is the canonical app version and must stay aligned with release tags and `CHANGELOG.md`.

