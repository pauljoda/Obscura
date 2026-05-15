---
sidebar_position: 4
title: API & Jobs
description: HTTP route conventions and background work ownership.
---

# API & Jobs

The .NET backend owns all server behavior.

## HTTP API

API routes live in `apps/backend/src/Obscura.Api/Endpoints` and are exposed
under `/api/*` or Jellyfin-compatible playback roots such as `/Videos` and
`/Items`.

The Svelte frontend should call the API through:

- generated OpenAPI clients in `apps/web-svelte/src/lib/api/generated`
- hand-written v2 wrappers in `apps/web-svelte/src/lib/api/v2.ts` only when
  generation has not caught up yet

Do not add `apps/web-svelte/src/routes/api` handlers.

## Jobs

Long-running media work belongs in `apps/backend/src/Obscura.Worker` and shared
.NET application/infrastructure services. Job state is represented in the
database through Obscura-owned tables such as `job_runs`.

Do not add a TypeScript worker, pg-boss wrappers, or `@obscura/app-core` queue
helpers.
