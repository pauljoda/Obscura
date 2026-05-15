# Architecture

## Runtime Topology

Obscura is organized as a Docker-first monorepo with two primary runtime services:

- `backend` - .NET API, HTTP ingress, EF Core persistence, static frontend host
- `backend-worker` - .NET background process for scan, fingerprint, preview, and import jobs

Supporting services:

- `postgres` - application database and durable job state. No separate queue service is required.

## Responsibility Boundaries

### apps/web-svelte

- user interface
- responsive layout and navigation
- asset browsing, metadata workflows, settings surfaces
- static frontend build consumed by the .NET API host

### apps/backend

- same-origin `/api` transport layer
- request validation and route composition
- EF Core persistence and migrations
- local streaming endpoints
- heavy media work
- long-running or restart-safe tasks
- queue execution, retries, and progress reporting

### packages/media-core

- media discovery primitives
- file fingerprint taxonomy
- frontend/shared media helpers that are not server-owned

### packages/stash-import

- one-time stash bootstrap import
- source mapping, normalization, and audit metadata

### packages/contracts

- frontend compatibility constants and helper types
- server contracts live in `apps/backend/src/Obscura.Contracts`

### packages/ui-svelte

- design tokens
- shared component helpers
- visual language primitives for the Svelte app

## Domain Direction

The application schema is intentionally not a direct copy of stash.

Core entities:

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
