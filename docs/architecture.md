# Architecture

## Runtime Topology

Obscura is organized as a Docker-first monorepo with three primary services:

- `web` - Next.js App Router frontend
- `api` - Fastify service exposing typed HTTP endpoints
- `worker` - background process for scan, fingerprint, preview, and import jobs

Supporting services:

- `postgres` - application database
- `redis` - queue coordination and worker state

## Responsibility Boundaries

### apps/web

- user interface
- responsive layout and navigation
- asset browsing, metadata workflows, settings surfaces
- server state consumption through typed contracts

### apps/api

- transport layer
- request validation and route composition
- orchestration of writes, reads, and job scheduling
- health, diagnostics, and admin endpoints

### apps/worker

- heavy media work
- long-running or restart-safe tasks
- queue execution, retries, and progress reporting

### packages/media-core

- media discovery primitives
- file fingerprint taxonomy
- future scan and normalization logic shared by API and worker

### packages/stash-import

- one-time stash bootstrap import
- source mapping, normalization, and audit metadata

### packages/contracts

- route constants
- DTOs and transport contracts
- shared job and queue identifiers

### packages/ui

- design tokens
- shared component helpers
- visual language primitives and future shadcn wrappers

## Domain Direction

The application schema is intentionally not a direct copy of stash.

Planned core entities:

- `Asset`
- `FileVariant`
- `Gallery`
- `Performer`
- `Studio`
- `Tag`
- `Collection`
- `Fingerprint`
- `SourceMatch`
- `JobRun`
- `LibraryRoot`

Key rules:

- `Asset` is the primary library record.
- Physical files should remain modelable independently from canonical asset identity.
- Imported stash data is normalized into Obscura-owned records.
- Provider provenance must be persisted for auditability and future provider expansion.

## Queue Direction

Initial queue families:

- `library-scan`
- `media-probe`
- `fingerprint`
- `preview`
- `metadata-import`

Queues must be durable, restart-safe, and visible in the UI.

