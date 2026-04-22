# Svelte Full-Stack Architecture Contract

**Date:** 2026-04-21
**Status:** Adopted
**Scope:** Full-stack SvelteKit cutover architecture for Obscura

---

## 1. Purpose

Define the target runtime for the Svelte migration so implementation work can move route family by route family without re-litigating the end state.

This spec is the source of truth for the cutover shape. It does not describe the old Next.js + Fastify topology except where needed to explain compatibility during migration.

## 2. Target Architecture

The target runtime is:

- `apps/web-svelte` as the full-stack SvelteKit application.
- `apps/worker` as a separate long-lived background process.
- `packages/app-core` for application-service and orchestration logic extracted from Fastify handlers.
- `packages/job-runtime` for shared queue, processor, and worker/runtime logic.

The SvelteKit app owns:

- pages
- `/api/*`
- `/assets/*`
- stream endpoints
- admin/system routes

Heavy media jobs stay out of process and continue to run in the worker.

Existing shared packages keep their current ownership boundaries. `packages/contracts`, `packages/db`, `packages/media-core`, and `packages/stash-import` remain the shared foundation underneath the new full-stack Svelte surface rather than being replaced by `packages/app-core`.

## 3. Architecture Decisions

These decisions are fixed for the cutover:

- SvelteKit owns pages + `/api` + `/assets` + stream endpoints.
- Shared domain logic moves to `packages/app-core`.
- Shared queue/runtime logic moves to `packages/job-runtime`.
- Worker remains a separate long-lived process.
- Fastify is a temporary compatibility shell only.
- The cutover is route-family based, not big bang.
- Boot-time DB migration and breaking-change gate checks move to the SvelteKit server bootstrap unless they are later extracted into a dedicated bootstrap path.

## 4. Migration Rules

- Add SvelteKit handlers one route family at a time.
- Keep Fastify only as an oracle and compatibility layer until a route family has matching SvelteKit coverage and parity validation.
- Move framework-neutral logic into shared packages before wiring it into SvelteKit route files.
- Keep ffmpeg-heavy work, retries, and other restart-sensitive media jobs out of request handlers.
- Do not treat the migration as complete until the target route family is served by SvelteKit without depending on Fastify for that slice.

## 5. End State

When the cutover is complete:

- `apps/web-svelte` serves the user interface and all server routes.
- `apps/api` is no longer part of the runtime.
- `apps/worker` continues as the thin background worker over shared job modules.
- Fastify is removed.
- Deployment, dev, and release wiring target only the Svelte stack.
