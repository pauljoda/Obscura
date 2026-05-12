# .NET Domain Boundary Cleanup

## Goal

The v2 backend should feel like a C# application at its core, not an API-contract projection layer. The Domain project owns the durable Obscura concepts: entities, capabilities, media-specific aggregates, and the interfaces that describe how application code uses them. Contracts remain the public API shape used by OpenAPI and Orval.

## Architecture

`Obscura.Domain` becomes the source of truth for in-process types:

- `Entities` contains `Entity`, `EntityKind`, `EntityReference`, and paged entity results.
- `Capabilities` contains reusable behaviors and value shapes such as ratings, tags, credits, images, links, files, markers, subtitles, and flags.
- `Media` contains media-oriented aggregates such as `Video`, `VideoSeries`, `Gallery`, `AudioLibrary`, and `Collection`.
- `Interfaces` contains stable app-facing contracts such as `IEntityCatalog`, `IRatingService`, and `IVideoLibrary`.

`Obscura.Application` holds use-case request and command objects. This keeps command language out of API DTOs while leaving room for fuller services as more workflows move from TypeScript to C#.

`Obscura.Contracts` remains external-facing only. ASP.NET endpoints map Domain objects into Contracts, and Orval generates Svelte types from those contracts.

## Data Flow

Infrastructure reads PostgreSQL rows and projects them into Domain objects. API endpoints depend on Domain interfaces, call those services, and translate the result into Contracts at the boundary.

This preserves a clean path:

`Postgres -> Infrastructure rows -> Domain model -> API contract -> Orval/Svelte`

The reverse path follows the same rule for writes:

`Svelte request -> API contract -> application/domain command -> Infrastructure write -> Domain result -> API contract`

## Testing

Existing API and projection tests should continue to verify endpoint contracts. Domain mapping should be covered by the current integration-style endpoint tests first, with focused unit tests added as domain behavior grows beyond simple projection.
