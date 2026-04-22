# Svelte Migration Next Slices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the remaining Svelte warning noise, then move the next low-risk backend read paths into `apps/web-svelte` so the Svelte app can bootstrap more of itself locally while Fastify remains available as the comparison oracle.

**Architecture:** Keep Fastify and Svelte running side by side, but stop duplicating behavior. Shared server logic should live in `packages/app-core`, shared DB runtime concerns should move into `packages/db`, and both Fastify routes and Svelte `+server.ts` handlers should call the same helpers. Migrate read-only shell/config/provider routes first; leave write-heavy routes, assets, and streaming for later.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Vitest, Drizzle, PostgreSQL, Fastify 5, Playwright, pnpm workspaces.

---

## Current State Snapshot

- Route parity is already `35/35` between `apps/web` and `apps/web-svelte`.
- Browser parity harness exists and passes for the stable route set.
- The Svelte warning backlog is down to `22 warnings, 0 errors` after commit `8e39edf`.
- The Svelte app already owns these local endpoints:
  - `/api/changelog`
  - `/api/client-info`
  - `/api/system/status`
  - `/api/system/breaking-gate/accept`
- Shared logic already extracted into `packages/app-core`:
  - `src/changelog.ts`
  - `src/network.ts`
  - `src/breaking-gate.ts`
- Fastify is still the source of truth for almost every DB-backed route family.
- The biggest remaining Svelte bootstrap dependencies are:
  - `GET /settings/library`
  - `GET /scrapers/packages`
  - `GET /plugins/packages`
  - `GET /stashbox-endpoints`
- The current worktree is clean except for untracked `.cursor/`, which must remain untouched.

## Why This Order

1. **Warnings first:** the remaining `svelte-check` output is still noisy enough to hide real regressions during backend migration. Clean that up before expanding server-side code.
2. **Shared DB runtime before bigger API slices:** Svelte cannot own meaningful DB-backed endpoints cleanly until it has a first-class server-side DB entry point that does not reach into `apps/api` internals.
3. **Read-only shell/config routes before mutations:** these routes are easier to compare, lower blast radius, and let the Svelte app start behaving like a real standalone app without risking data writes.
4. **Provider list routes before jobs/media routes:** settings, plugins, and identify screens depend on these read models, but they do not involve queue mutations, file I/O, ffmpeg, or streaming behavior.
5. **Keep Fastify alive until each route family proves parity:** Svelte should gain ownership one slice at a time; Fastify remains the control version until the cutover phase.

## File Structure

### New files

- `packages/db/src/runtime.ts` — shared DB runtime helpers for creating/reusing typed Drizzle + postgres clients outside `apps/api`.
- `packages/db/src/runtime.test.ts` — unit tests for runtime reconfigure/close behavior using fake clients.
- `packages/app-core/src/library-config.ts` — shared read model for settings/library config payloads.
- `packages/app-core/src/library-config.test.ts` — unit tests for the shared library-config loader.
- `packages/app-core/src/provider-lists.ts` — shared read models for installed scrapers, installed plugins, and StashBox endpoints.
- `packages/app-core/src/provider-lists.test.ts` — unit tests for the provider list mappers and auth-status derivation.
- `apps/web-svelte/src/lib/server/db.ts` — Svelte server-side entry point to the shared DB runtime.
- `apps/web-svelte/src/lib/server/library-storage.ts` — Svelte-local storage stats helper for settings/library payloads.
- `apps/web-svelte/src/routes/api/settings/library/+server.ts` — local Svelte replacement for `GET /settings/library`.
- `apps/web-svelte/src/routes/api/scrapers/packages/+server.ts` — local Svelte replacement for `GET /scrapers/packages`.
- `apps/web-svelte/src/routes/api/plugins/packages/+server.ts` — local Svelte replacement for `GET /plugins/packages`.
- `apps/web-svelte/src/routes/api/stashbox-endpoints/+server.ts` — local Svelte replacement for `GET /stashbox-endpoints`.
- `apps/web-svelte/src/lib/components/FilterPresetDropdown.test.ts` — regression test for dropdown overlay semantics.
- `apps/web-svelte/src/lib/components/SubtitleSettingsPanel.test.ts` — regression test for dialog semantics in the subtitle settings panel.

### Modified files

- `packages/db/src/index.ts` — export shared runtime helpers.
- `apps/api/src/db/index.ts` — switch API DB bootstrap to the shared runtime implementation.
- `packages/app-core/src/index.ts` — export new shared read-model helpers.
- `apps/api/src/routes/settings.ts` — delegate library config read path into `packages/app-core`.
- `apps/api/src/routes/scrapers.ts` — delegate installed scraper listing into `packages/app-core`.
- `apps/api/src/routes/plugins.ts` — delegate installed plugin listing into `packages/app-core`.
- `apps/api/src/routes/stashbox.ts` — delegate StashBox endpoint listing into `packages/app-core`.
- `apps/web-svelte/src/lib/server/system.ts` — switch read helpers from Fastify URLs to local `/api/*` routes as slices migrate.
- `apps/web-svelte/src/lib/server/library-storage.ts` — keep storage-stat logic local to Svelte instead of reaching into `apps/api`.
- `apps/web-svelte/src/routes/+layout.server.ts` — stop calling Fastify for library config once the local route exists.
- `apps/web-svelte/src/routes/settings/+page.server.ts` — consume the local settings/library and scraper endpoints.
- `apps/web-svelte/src/lib/components/FilmStrip.svelte` — fix non-reactive drag state warning.
- `apps/web-svelte/src/lib/components/FilterPresetDropdown.svelte` — fix overlay semantics warning.
- `apps/web-svelte/src/lib/components/FilterBar.svelte` — fix overlay semantics warning.
- `apps/web-svelte/src/lib/components/SubtitleSettingsPanel.svelte` — fix dialog/container semantics warning.
- `apps/web-svelte/src/lib/components/settings/WatchedLibrariesSection.svelte` — fix label/control association warning.
- `apps/web-svelte/src/lib/components/settings/QualitySlider.svelte` — fix state-capture warning.
- `apps/web-svelte/src/lib/components/VideoPlayer.svelte` — fix state-capture warning.
- `apps/web-svelte/src/routes/audio/[id]/+page.svelte`
- `apps/web-svelte/src/routes/audio/tracks/[id]/+page.svelte`
- `apps/web-svelte/src/routes/collections/[id]/+page.svelte`
- `apps/web-svelte/src/routes/galleries/[id]/+page.svelte`
- `apps/web-svelte/src/routes/images/[id]/+page.svelte`
- `apps/web-svelte/src/routes/performers/[id]/+page.svelte`
- `apps/web-svelte/src/routes/resolve/review/+page.svelte`
- `apps/web-svelte/src/routes/studios/[id]/+page.svelte`
- `apps/web-svelte/src/routes/tags/[id]/+page.svelte`
- `apps/web-svelte/src/routes/videos/[id]/+page.svelte` — fix remaining `$props()` capture warnings by using `$derived(...)` or reactive locals instead of one-time aliases.
- `CHANGELOG.md` — add one `Unreleased` entry per implementation commit.

## Non-Goals For This Plan

- Do not migrate queue mutation routes (`/jobs/*`) yet.
- Do not migrate media asset or streaming routes (`/assets/*`, `/video-stream/*`, `/audio-stream/*`) yet.
- Do not remove any Fastify route in this plan.
- Do not change Docker/dev wiring in this plan.

### Task 1: Burn Down The High-Signal Svelte Warnings

**Files:**
- Create: `apps/web-svelte/src/lib/components/FilterPresetDropdown.test.ts`
- Create: `apps/web-svelte/src/lib/components/SubtitleSettingsPanel.test.ts`
- Modify: `apps/web-svelte/src/lib/components/FilmStrip.svelte`
- Modify: `apps/web-svelte/src/lib/components/FilterPresetDropdown.svelte`
- Modify: `apps/web-svelte/src/lib/components/FilterBar.svelte`
- Modify: `apps/web-svelte/src/lib/components/SubtitleSettingsPanel.svelte`
- Modify: `apps/web-svelte/src/lib/components/settings/WatchedLibrariesSection.svelte`
- Modify: `apps/web-svelte/src/lib/components/settings/QualitySlider.svelte`
- Modify: `apps/web-svelte/src/lib/components/VideoPlayer.svelte`
- Modify: `apps/web-svelte/src/routes/audio/[id]/+page.svelte`
- Modify: `apps/web-svelte/src/routes/audio/tracks/[id]/+page.svelte`
- Modify: `apps/web-svelte/src/routes/collections/[id]/+page.svelte`
- Modify: `apps/web-svelte/src/routes/galleries/[id]/+page.svelte`
- Modify: `apps/web-svelte/src/routes/images/[id]/+page.svelte`
- Modify: `apps/web-svelte/src/routes/performers/[id]/+page.svelte`
- Modify: `apps/web-svelte/src/routes/resolve/review/+page.svelte`
- Modify: `apps/web-svelte/src/routes/studios/[id]/+page.svelte`
- Modify: `apps/web-svelte/src/routes/tags/[id]/+page.svelte`
- Modify: `apps/web-svelte/src/routes/videos/[id]/+page.svelte`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Write the failing accessibility regression tests**

```ts
// apps/web-svelte/src/lib/components/FilterPresetDropdown.test.ts
import { render, screen } from "@testing-library/svelte";
import FilterPresetDropdown from "./FilterPresetDropdown.svelte";

it("renders the dismiss overlay as a button instead of a generic div", () => {
  render(FilterPresetDropdown, {
    props: {
      open: true,
      presets: [],
      activePresetId: null,
      onSelect: () => {},
      onDelete: () => {},
      onRename: () => {},
    },
  });

  expect(
    screen.getByRole("button", { name: /close preset menu/i }),
  ).toBeInTheDocument();
});
```

```ts
// apps/web-svelte/src/lib/components/SubtitleSettingsPanel.test.ts
import { render, screen } from "@testing-library/svelte";
import SubtitleSettingsPanel from "./SubtitleSettingsPanel.svelte";

it("exposes subtitle settings as a dialog", () => {
  render(SubtitleSettingsPanel, {
    props: {
      appearance: {
        style: "stylized",
        fontScale: 1,
        positionPercent: 92,
        opacity: 1,
      },
      hasLocalOverride: false,
      onClose: () => {},
      onChange: () => {},
      onReset: () => {},
    },
  });

  expect(
    screen.getByRole("dialog", { name: /subtitle style/i }),
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail on the current warning-producing markup**

Run:

```bash
pnpm --filter @obscura/web-svelte test:unit -- src/lib/components/FilterPresetDropdown.test.ts src/lib/components/SubtitleSettingsPanel.test.ts
```

Expected: FAIL because the current overlay is a clickable `<div>` and the subtitle panel has no dialog role.

- [ ] **Step 3: Write the minimal implementation to remove the targeted warnings**

```svelte
<!-- apps/web-svelte/src/lib/components/FilterPresetDropdown.svelte -->
<button
  type="button"
  class="fixed inset-0 z-40"
  aria-label="Close preset menu"
  onclick={() => (open = false)}
></button>
```

```svelte
<!-- apps/web-svelte/src/lib/components/SubtitleSettingsPanel.svelte -->
<div
  role="dialog"
  aria-modal="true"
  aria-label="Subtitle style"
  class="absolute right-0 top-0 bottom-0 z-20 w-[min(22rem,85%)] player-dropdown flex flex-col"
  onclick={(e) => e.stopPropagation()}
>
```

```svelte
<!-- apps/web-svelte/src/lib/components/FilmStrip.svelte -->
let dragging = $state(false);
```

```ts
// apps/web-svelte/src/lib/components/settings/QualitySlider.svelte
const inputId = $derived(`quality-slider-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
```

```ts
// example route-page fix pattern
let { data } = $props();
const video = $derived(data.video);
```

Also apply the same pattern everywhere a route page currently captures `data` once into a plain local (`const x = data.foo`) and everywhere the warning is about autofocus or label association.

- [ ] **Step 4: Re-run unit tests and typecheck**

Run:

```bash
pnpm --filter @obscura/web-svelte test:unit -- src/lib/components/FilterPresetDropdown.test.ts src/lib/components/SubtitleSettingsPanel.test.ts
pnpm --filter @obscura/web-svelte typecheck
```

Expected:

- the two new tests PASS
- `svelte-check` reports `0 errors`
- warning count is lower than the current `22`, with the click-handler/dialog/label warnings removed

- [ ] **Step 5: Commit**

```bash
git add apps/web-svelte/src/lib/components/FilterPresetDropdown.test.ts apps/web-svelte/src/lib/components/SubtitleSettingsPanel.test.ts apps/web-svelte/src/lib/components/FilmStrip.svelte apps/web-svelte/src/lib/components/FilterPresetDropdown.svelte apps/web-svelte/src/lib/components/FilterBar.svelte apps/web-svelte/src/lib/components/SubtitleSettingsPanel.svelte apps/web-svelte/src/lib/components/settings/WatchedLibrariesSection.svelte apps/web-svelte/src/lib/components/settings/QualitySlider.svelte apps/web-svelte/src/lib/components/VideoPlayer.svelte apps/web-svelte/src/routes/audio/[id]/+page.svelte apps/web-svelte/src/routes/audio/tracks/[id]/+page.svelte apps/web-svelte/src/routes/collections/[id]/+page.svelte apps/web-svelte/src/routes/galleries/[id]/+page.svelte apps/web-svelte/src/routes/images/[id]/+page.svelte apps/web-svelte/src/routes/performers/[id]/+page.svelte apps/web-svelte/src/routes/resolve/review/+page.svelte apps/web-svelte/src/routes/studios/[id]/+page.svelte apps/web-svelte/src/routes/tags/[id]/+page.svelte apps/web-svelte/src/routes/videos/[id]/+page.svelte CHANGELOG.md
git commit -m "fix(web-svelte): trim migration warning backlog"
```

### Task 2: Extract A Shared DB Runtime For Fastify And Svelte

**Files:**
- Create: `packages/db/src/runtime.ts`
- Create: `packages/db/src/runtime.test.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `apps/api/src/db/index.ts`
- Create: `apps/web-svelte/src/lib/server/db.ts`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Write the failing DB runtime tests**

```ts
// packages/db/src/runtime.test.ts
import { describe, expect, it, vi } from "vitest";
import { createDbRuntime } from "./runtime";

describe("createDbRuntime", () => {
  it("reuses the existing state when the connection string does not change", async () => {
    const end = vi.fn();
    const runtime = createDbRuntime({
      createQueryClient: vi.fn(() => ({ end })),
      createDatabase: vi.fn((client) => ({ client })),
    });

    await runtime.configure("postgres://one");
    const first = runtime.getDatabase();
    await runtime.configure("postgres://one");
    const second = runtime.getDatabase();

    expect(second).toBe(first);
    expect(end).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the DB runtime tests and verify they fail because the helper does not exist yet**

Run:

```bash
pnpm test:unit -- packages/db/src/runtime.test.ts
```

Expected: FAIL with module-not-found or missing export errors for `createDbRuntime`.

- [ ] **Step 3: Write the shared runtime helper and wire both apps to it**

```ts
// packages/db/src/runtime.ts
export function createDbRuntime<TQueryClient, TDatabase>(deps: {
  createQueryClient: (connectionString: string) => TQueryClient;
  createDatabase: (client: TQueryClient) => TDatabase;
  closeQueryClient?: (client: TQueryClient) => Promise<void>;
}) {
  let state: { connectionString: string; client: TQueryClient; db: TDatabase } | null = null;

  return {
    async configure(connectionString: string) {
      if (state?.connectionString === connectionString) return;
      const previous = state;
      const client = deps.createQueryClient(connectionString);
      const db = deps.createDatabase(client);
      state = { connectionString, client, db };
      if (previous && deps.closeQueryClient) {
        await deps.closeQueryClient(previous.client);
      }
    },
    getDatabase() {
      if (!state) throw new Error("DB runtime not configured");
      return state.db;
    },
    getClient() {
      if (!state) throw new Error("DB runtime not configured");
      return state.client;
    },
  };
}
```

```ts
// apps/web-svelte/src/lib/server/db.ts
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { createDbRuntime, schema } from "@obscura/db";
import { env } from "$env/dynamic/private";

const runtime = createDbRuntime({
  createQueryClient: (url) => postgres(url),
  createDatabase: (client) => drizzle(client, { schema }),
  closeQueryClient: (client) => client.end({ timeout: 5 }),
});

const DEFAULT_DATABASE_URL = "postgres://obscura:obscura@localhost:5432/obscura";

export async function getWebDb() {
  await runtime.configure(env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
  return runtime.getDatabase();
}
```

- [ ] **Step 4: Re-run DB runtime tests and both app typechecks**

Run:

```bash
pnpm test:unit -- packages/db/src/runtime.test.ts
pnpm --filter @obscura/api typecheck
pnpm --filter @obscura/web-svelte typecheck
```

Expected: PASS, `0 errors`, and no new warnings beyond the current baseline.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/runtime.ts packages/db/src/runtime.test.ts packages/db/src/index.ts apps/api/src/db/index.ts apps/web-svelte/src/lib/server/db.ts CHANGELOG.md
git commit -m "feat(db): share runtime between api and svelte"
```

### Task 3: Move `GET /settings/library` Into Shared Core And A Local Svelte Route

**Files:**
- Create: `packages/app-core/src/library-config.ts`
- Create: `packages/app-core/src/library-config.test.ts`
- Modify: `packages/app-core/src/index.ts`
- Modify: `apps/api/src/routes/settings.ts`
- Create: `apps/web-svelte/src/routes/api/settings/library/+server.ts`
- Modify: `apps/web-svelte/src/lib/server/system.ts`
- Modify: `apps/web-svelte/src/routes/+layout.server.ts`
- Modify: `apps/web-svelte/src/routes/settings/+page.server.ts`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Write the failing shared-library-config tests**

```ts
// packages/app-core/src/library-config.test.ts
import { describe, expect, it, vi } from "vitest";
import { loadLibraryConfig } from "./library-config";

describe("loadLibraryConfig", () => {
  it("returns settings, ordered roots, and storage stats in one payload", async () => {
    const payload = await loadLibraryConfig({
      ensureSettings: vi.fn(async () => ({ id: "settings-1", nsfwLanAutoEnable: true })),
      loadRoots: vi.fn(async () => [{ id: "root-1", path: "/media/A" }]),
      loadStorage: vi.fn(async () => ({ totalBytes: 42 })),
    });

    expect(payload.settings.id).toBe("settings-1");
    expect(payload.roots).toHaveLength(1);
    expect(payload.storage.totalBytes).toBe(42);
  });
});
```

- [ ] **Step 2: Run the library-config tests and verify they fail because the shared loader does not exist yet**

Run:

```bash
pnpm test:unit -- packages/app-core/src/library-config.test.ts
```

Expected: FAIL with missing module/export errors for `loadLibraryConfig`.

- [ ] **Step 3: Implement the shared loader and switch both Fastify and Svelte to it**

```ts
// packages/app-core/src/library-config.ts
export async function loadLibraryConfig(deps: {
  ensureSettings: () => Promise<unknown>;
  loadRoots: () => Promise<unknown[]>;
  loadStorage: () => Promise<unknown>;
}) {
  const [settings, roots, storage] = await Promise.all([
    deps.ensureSettings(),
    deps.loadRoots(),
    deps.loadStorage(),
  ]);

  return { settings, roots, storage };
}
```

```ts
// apps/web-svelte/src/routes/api/settings/library/+server.ts
import { json, type RequestHandler } from "@sveltejs/kit";
import { loadLibraryConfig } from "@obscura/app-core";
import { schema } from "@obscura/db";
import { asc } from "drizzle-orm";
import { getWebDb } from "$lib/server/db";
import { getStorageStats } from "$lib/server/library-storage";

export const GET: RequestHandler = async () => {
  const db = await getWebDb();

  const payload = await loadLibraryConfig({
    ensureSettings: async () => {
      const [existing] = await db.select().from(schema.librarySettings).limit(1);
      if (existing) return existing;
      const [created] = await db.insert(schema.librarySettings).values({}).returning();
      return created;
    },
    loadRoots: () => db.select().from(schema.libraryRoots).orderBy(asc(schema.libraryRoots.path)),
    loadStorage: () => getStorageStats(),
  });

  return json(payload);
};
```

```ts
// apps/web-svelte/src/lib/server/system.ts
export async function fetchLibraryConfig(options?: { fetch?: typeof fetch }) {
  const f = options?.fetch ?? fetch;
  const res = await f("/api/settings/library");
  if (!res.ok) throw new Error(`settings library ${res.status}`);
  return res.json();
}
```

**Important:** do not keep any direct `INTERNAL_API_URL` call for library config after this task.

- [ ] **Step 4: Re-run unit tests, then typecheck both servers**

Run:

```bash
pnpm test:unit -- packages/app-core/src/library-config.test.ts
pnpm --filter @obscura/api typecheck
pnpm --filter @obscura/web-svelte typecheck
```

Expected: PASS, with `+layout.server.ts` and `settings/+page.server.ts` now reading local Svelte endpoints for library config.

- [ ] **Step 5: Commit**

```bash
git add packages/app-core/src/library-config.ts packages/app-core/src/library-config.test.ts packages/app-core/src/index.ts apps/api/src/routes/settings.ts apps/web-svelte/src/routes/api/settings/library/+server.ts apps/web-svelte/src/lib/server/system.ts apps/web-svelte/src/routes/+layout.server.ts apps/web-svelte/src/routes/settings/+page.server.ts CHANGELOG.md
git commit -m "feat(web-svelte): localize library config route"
```

### Task 4: Move Installed Scraper And StashBox Read Lists Into Shared Core And Local Svelte Routes

**Files:**
- Create: `packages/app-core/src/provider-lists.ts`
- Create: `packages/app-core/src/provider-lists.test.ts`
- Modify: `packages/app-core/src/index.ts`
- Modify: `apps/api/src/routes/scrapers.ts`
- Modify: `apps/api/src/routes/stashbox.ts`
- Create: `apps/web-svelte/src/routes/api/scrapers/packages/+server.ts`
- Create: `apps/web-svelte/src/routes/api/stashbox-endpoints/+server.ts`
- Modify: `apps/web-svelte/src/lib/server/system.ts`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Write the failing provider-list tests**

```ts
// packages/app-core/src/provider-lists.test.ts
import { describe, expect, it } from "vitest";
import { mapStashBoxEndpointList } from "./provider-lists";

describe("mapStashBoxEndpointList", () => {
  it("marks every stashbox endpoint as nsfw and masks api keys", () => {
    const result = mapStashBoxEndpointList([
      {
        id: "1",
        name: "FansDB",
        endpoint: "https://fansdb.cc/graphql",
        apiKey: "secret-secret-secret",
        enabled: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
      },
    ]);

    expect(result.endpoints[0].isNsfw).toBe(true);
    expect(result.endpoints[0].apiKeyPreview).toMatch(/\*+/);
  });
});
```

- [ ] **Step 2: Run the provider-list tests and verify they fail because the shared mapper does not exist yet**

Run:

```bash
pnpm test:unit -- packages/app-core/src/provider-lists.test.ts
```

Expected: FAIL with missing module/export errors for `mapStashBoxEndpointList`.

- [ ] **Step 3: Implement shared provider list mappers and wire Fastify/Svelte to them**

```ts
// packages/app-core/src/provider-lists.ts
export function mapInstalledScraperPackages(rows: Array<any>) {
  return { packages: rows };
}

export function mapStashBoxEndpointList(rows: Array<any>) {
  return {
    endpoints: rows.map((r) => ({
      id: r.id,
      name: r.name,
      endpoint: r.endpoint,
      apiKeyPreview: `${"*".repeat(Math.max(0, r.apiKey.length - 4))}${r.apiKey.slice(-4)}`,
      enabled: r.enabled,
      isNsfw: true,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}
```

```ts
// apps/web-svelte/src/routes/api/scrapers/packages/+server.ts
import { json, type RequestHandler } from "@sveltejs/kit";
import { mapInstalledScraperPackages } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { schema } from "@obscura/db";
import { desc } from "drizzle-orm";

export const GET: RequestHandler = async () => {
  const db = await getWebDb();
  const rows = await db.select().from(schema.scraperPackages).orderBy(desc(schema.scraperPackages.createdAt));
  return json(mapInstalledScraperPackages(rows));
};
```

- [ ] **Step 4: Re-run provider-list tests and the Svelte/API typechecks**

Run:

```bash
pnpm test:unit -- packages/app-core/src/provider-lists.test.ts
pnpm --filter @obscura/api typecheck
pnpm --filter @obscura/web-svelte typecheck
```

Expected: PASS, with `fetchInstalledScrapers()` and `fetchStashBoxEndpointsServer()` now able to use local routes.

- [ ] **Step 5: Commit**

```bash
git add packages/app-core/src/provider-lists.ts packages/app-core/src/provider-lists.test.ts packages/app-core/src/index.ts apps/api/src/routes/scrapers.ts apps/api/src/routes/stashbox.ts apps/web-svelte/src/routes/api/scrapers/packages/+server.ts apps/web-svelte/src/routes/api/stashbox-endpoints/+server.ts apps/web-svelte/src/lib/server/system.ts CHANGELOG.md
git commit -m "feat(web-svelte): localize provider list routes"
```

### Task 5: Move Installed Plugin Read Models Into Shared Core And The Local Svelte API

**Files:**
- Modify: `packages/app-core/src/provider-lists.ts`
- Modify: `packages/app-core/src/provider-lists.test.ts`
- Modify: `apps/api/src/routes/plugins.ts`
- Create: `apps/web-svelte/src/routes/api/plugins/packages/+server.ts`
- Modify: `apps/web-svelte/src/lib/server/system.ts`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Extend the failing provider-list tests for plugin auth status**

```ts
it("derives plugin auth status from required auth fields", () => {
  const result = mapInstalledPluginPackages({
    packageRows: [
      {
        id: "pkg-1",
        pluginId: "tmdb",
        name: "TMDB",
        version: "1.0.0",
        runtime: "typescript",
        installPath: "/tmp/tmdb",
        sha256: null,
        isNsfw: false,
        capabilities: {},
        enabled: true,
        sourceIndex: "obscura-community",
        manifestRaw: { auth: [{ key: "apiKey", label: "API Key", required: true }] },
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
      },
    ],
    authRows: [],
  });

  expect(result.packages[0].authStatus).toBe("missing");
});
```

- [ ] **Step 2: Run the provider-list tests and verify the new plugin assertion fails**

Run:

```bash
pnpm test:unit -- packages/app-core/src/provider-lists.test.ts
```

Expected: FAIL because `mapInstalledPluginPackages` does not exist yet.

- [ ] **Step 3: Implement the shared plugin mapper and add the local Svelte route**

```ts
// packages/app-core/src/provider-lists.ts
export function mapInstalledPluginPackages(input: {
  packageRows: Array<any>;
  authRows: Array<{ pluginId: string; authKey: string }>;
}) {
  const authByPlugin = new Map<string, Set<string>>();
  for (const row of input.authRows) {
    const set = authByPlugin.get(row.pluginId) ?? new Set<string>();
    set.add(row.authKey);
    authByPlugin.set(row.pluginId, set);
  }

  return {
    packages: input.packageRows.map((row) => {
      const manifest = row.manifestRaw as Record<string, unknown> | null;
      const authFields = Array.isArray(manifest?.auth) ? manifest.auth : undefined;
      const configured = authByPlugin.get(row.pluginId) ?? new Set<string>();
      const authStatus =
        authFields && authFields.length > 0
          ? authFields.filter((f: any) => f.required).every((f: any) => configured.has(f.key))
            ? "ok"
            : "missing"
          : null;

      return {
        id: row.id,
        pluginId: row.pluginId,
        name: row.name,
        version: row.version,
        runtime: row.runtime,
        installPath: row.installPath,
        sha256: row.sha256,
        isNsfw: row.isNsfw,
        capabilities: row.capabilities ?? {},
        enabled: row.enabled,
        sourceIndex: row.sourceIndex,
        authStatus,
        authFields,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    }),
  };
}
```

```ts
// apps/web-svelte/src/routes/api/plugins/packages/+server.ts
import { json, type RequestHandler } from "@sveltejs/kit";
import { mapInstalledPluginPackages } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { schema } from "@obscura/db";

export const GET: RequestHandler = async () => {
  const db = await getWebDb();
  const [packageRows, authRows] = await Promise.all([
    db.select().from(schema.pluginPackages).orderBy(schema.pluginPackages.name),
    db.select().from(schema.pluginAuth),
  ]);

  return json(mapInstalledPluginPackages({ packageRows, authRows }));
};
```

- [ ] **Step 4: Re-run the provider tests plus typecheck**

Run:

```bash
pnpm test:unit -- packages/app-core/src/provider-lists.test.ts
pnpm --filter @obscura/api typecheck
pnpm --filter @obscura/web-svelte typecheck
```

Expected: PASS, and `fetchInstalledPlugins()` can switch to the local Svelte route without changing the payload shape.

- [ ] **Step 5: Commit**

```bash
git add packages/app-core/src/provider-lists.ts packages/app-core/src/provider-lists.test.ts apps/api/src/routes/plugins.ts apps/web-svelte/src/routes/api/plugins/packages/+server.ts apps/web-svelte/src/lib/server/system.ts CHANGELOG.md
git commit -m "feat(web-svelte): localize plugin package route"
```

## Exit Criteria For This Plan

This plan is complete when all of the following are true:

- `pnpm --filter @obscura/web-svelte typecheck` reports `0 errors` and a warning count lower than the current `22`.
- Svelte owns these local read routes:
  - `/api/changelog`
  - `/api/client-info`
  - `/api/system/status`
  - `/api/system/breaking-gate/accept`
  - `/api/settings/library`
  - `/api/scrapers/packages`
  - `/api/plugins/packages`
  - `/api/stashbox-endpoints`
- `apps/web-svelte/src/routes/+layout.server.ts` no longer needs Fastify for shell bootstrap state other than still-unmigrated slices.
- Fastify and Svelte still return equivalent payload shapes for the migrated routes.
- Fastify still exists and remains runnable beside Svelte for manual comparison.

## Broader Roadmap After This Plan

After these slices land, the order should stay the same:

1. settings writes and other low-risk config mutations
2. jobs read models
3. entity read families (`studios`, `performers`, `tags`, `search`, then media detail lists)
4. mutation families
5. asset and stream handlers
6. Docker/dev cutover
7. delete `apps/web` and `apps/api`

The key rule is unchanged: do not migrate a riskier slice while an easier read-only dependency still points at Fastify.

## Self-Review

- **Spec coverage:** this plan covers the current migration state, the next warning cleanup tranche, the next shared-runtime extraction, and the next Svelte-owned API slices that remove shell/settings/provider dependencies on Fastify.
- **Placeholder scan:** no `TODO`, `TBD`, or “similar to above” placeholders remain.
- **Type consistency:** all route and helper names match the current repo naming (`settings/library`, `scrapers/packages`, `plugins/packages`, `stashbox-endpoints`, `@obscura/app-core`, `@obscura/db`).

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-22-svelte-migration-next-slices.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
