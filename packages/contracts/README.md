# @obscura/contracts

This TypeScript package is a legacy migration bridge for the v2 .NET backend work.

It still owns queue identifiers, media helpers, plugin normalizer shapes, and DTOs used by the current SvelteKit/API/worker path. Do not delete DTO groups from this package until the matching route or UI surface has moved to the .NET OpenAPI contract and the Orval-generated client under `apps/web-svelte/src/lib/api/generated`.

New .NET API request and response shapes should be added to `apps/backend/src/Obscura.Contracts` so OpenAPI and Orval remain the public contract source for migrated v2 surfaces.
