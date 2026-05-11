# Release Update Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an in-app update notification when GitHub has a newer Obscura release than the installed version.

**Architecture:** Put release fetching, version normalization, comparison, and one-day cache behavior in `@obscura/app-core`. Expose that through a SvelteKit `/api/update-check` route, then let the existing sidebar and changelog dialog consume the same status object. UI failures stay quiet.

**Tech Stack:** TypeScript, SvelteKit route handlers, Svelte 5 runes, Vitest, public GitHub releases API.

---

## File Structure

- Create: `packages/app-core/src/release-check.ts`
  - Owns semantic version normalization, latest-release fetching, quiet failure status, and one-day cache.
- Modify: `packages/app-core/src/index.ts`
  - Re-export release-check helpers.
- Create: `packages/app-core/src/release-check.test.ts`
  - Tests comparison, fetch outcomes, failure status, cache, and force refresh.
- Create: `apps/web-svelte/src/routes/api/update-check/+server.ts`
  - Calls `checkForReleaseUpdate` with `APP_VERSION` and `force` query support.
- Create: `apps/web-svelte/src/routes/api/update-check/update-check-route.test.ts`
  - Tests route JSON and force parameter wiring.
- Modify: `apps/web-svelte/src/lib/version.ts`
  - Add client-facing release status types and `fetchReleaseUpdateStatus`.
- Modify: `apps/web-svelte/src/lib/version.test.ts`
  - Keep APP_VERSION test and add API wrapper coverage.
- Modify: `apps/web-svelte/src/lib/components/Sidebar.svelte`
  - Fetch status once on client mount and render accent LED when an update is available.
- Modify: `apps/web-svelte/src/lib/components/ChangelogDialog.svelte`
  - Fetch status on open, show update link above changelog content, and add manual refresh.
- Modify: `CHANGELOG.md`
  - Add user-facing What's New and Added entries.

## Task 1: App-Core Release Status

**Files:**
- Create: `packages/app-core/src/release-check.test.ts`
- Create: `packages/app-core/src/release-check.ts`
- Modify: `packages/app-core/src/index.ts`

- [ ] **Step 1: Write failing release-check tests**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkForReleaseUpdate,
  compareReleaseVersions,
  createReleaseUpdateChecker,
  normalizeReleaseVersion,
} from "./release-check";

describe("release version comparison", () => {
  it("normalizes tags and local dev versions to semver cores", () => {
    expect(normalizeReleaseVersion("v0.23.0")).toBe("0.23.0");
    expect(normalizeReleaseVersion("0.22.1-dev")).toBe("0.22.1");
    expect(normalizeReleaseVersion("  v1.2.3-beta.1 ")).toBe("1.2.3");
    expect(normalizeReleaseVersion("not-a-version")).toBeNull();
  });

  it("compares newer, equal, and older versions", () => {
    expect(compareReleaseVersions("0.23.0", "0.22.1-dev")).toBeGreaterThan(0);
    expect(compareReleaseVersions("v0.22.1", "0.22.1-dev")).toBe(0);
    expect(compareReleaseVersions("0.22.0", "0.22.1-dev")).toBeLessThan(0);
  });
});

describe("checkForReleaseUpdate", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("reports an available update when GitHub latest is newer", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      tag_name: "v0.23.0",
      html_url: "https://github.com/pauljoda/Obscura/releases/tag/v0.23.0",
    })));

    const status = await checkForReleaseUpdate({ localVersion: "0.22.1-dev", fetchImpl });

    expect(status).toMatchObject({
      status: "available",
      localVersion: "0.22.1-dev",
      latestVersion: "0.23.0",
      latestUrl: "https://github.com/pauljoda/Obscura/releases/tag/v0.23.0",
      updateAvailable: true,
      fromCache: false,
    });
  });

  it("does not warn when local dev build is ahead", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      tag_name: "v0.22.0",
      html_url: "https://github.com/pauljoda/Obscura/releases/tag/v0.22.0",
    })));

    const status = await checkForReleaseUpdate({ localVersion: "0.22.1-dev", fetchImpl });

    expect(status.status).toBe("current");
    expect(status.updateAvailable).toBe(false);
  });

  it("returns an unknown status when GitHub cannot be reached", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });

    const status = await checkForReleaseUpdate({ localVersion: "0.22.1-dev", fetchImpl });

    expect(status.status).toBe("unknown");
    expect(status.updateAvailable).toBe(false);
    expect(status.error).toBe("offline");
  });

  it("caches daily checks and bypasses cache when forced", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ tag_name: "v0.23.0", html_url: "https://example.test/1" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tag_name: "v0.24.0", html_url: "https://example.test/2" })));
    const checker = createReleaseUpdateChecker({
      fetchImpl,
      now: () => new Date("2026-05-11T12:00:00.000Z"),
    });

    const first = await checker({ localVersion: "0.22.1-dev" });
    const cached = await checker({ localVersion: "0.22.1-dev" });
    const forced = await checker({ localVersion: "0.22.1-dev", force: true });

    expect(first.latestVersion).toBe("0.23.0");
    expect(cached.fromCache).toBe(true);
    expect(cached.latestVersion).toBe("0.23.0");
    expect(forced.latestVersion).toBe("0.24.0");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run app-core test to verify it fails**

Run: `pnpm --filter @obscura/app-core exec vitest run src/release-check.test.ts`

Expected: FAIL because `./release-check` does not exist.

- [ ] **Step 3: Implement minimal release-check helper**

Create `release-check.ts` with:

```ts
const DEFAULT_RELEASE_URL = "https://api.github.com/repos/pauljoda/Obscura/releases/latest";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type ReleaseUpdateStatusKind = "available" | "current" | "unknown";

export interface ReleaseUpdateStatus {
  status: ReleaseUpdateStatusKind;
  localVersion: string;
  latestVersion: string | null;
  latestUrl: string | null;
  updateAvailable: boolean;
  checkedAt: string;
  fromCache: boolean;
  error?: string;
}

export interface ReleaseUpdateCheckOptions {
  localVersion: string;
  force?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  releaseUrl?: string;
}

interface GithubReleasePayload {
  tag_name?: unknown;
  html_url?: unknown;
}

export function normalizeReleaseVersion(version: string): string | null {
  const match = version.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}` : null;
}

export function compareReleaseVersions(left: string, right: string): number {
  const leftVersion = normalizeReleaseVersion(left);
  const rightVersion = normalizeReleaseVersion(right);
  if (!leftVersion || !rightVersion) return 0;
  const leftParts = leftVersion.split(".").map(Number);
  const rightParts = rightVersion.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    const diff = leftParts[i] - rightParts[i];
    if (diff !== 0) return diff;
  }
  return 0;
}

function unknownStatus(localVersion: string, checkedAt: Date, error: unknown, fromCache = false): ReleaseUpdateStatus {
  return {
    status: "unknown",
    localVersion,
    latestVersion: null,
    latestUrl: null,
    updateAvailable: false,
    checkedAt: checkedAt.toISOString(),
    fromCache,
    error: error instanceof Error ? error.message : "Release check failed",
  };
}

export function createReleaseUpdateChecker(defaults?: Omit<ReleaseUpdateCheckOptions, "localVersion" | "force">) {
  let cached: { timestamp: number; status: ReleaseUpdateStatus } | null = null;

  return async function runCheck(options: Pick<ReleaseUpdateCheckOptions, "localVersion" | "force">) {
    const nowFn = defaults?.now ?? (() => new Date());
    const now = nowFn();
    const fetchImpl = defaults?.fetchImpl ?? fetch;
    const releaseUrl = defaults?.releaseUrl ?? DEFAULT_RELEASE_URL;

    if (!options.force && cached && now.getTime() - cached.timestamp < ONE_DAY_MS) {
      return { ...cached.status, fromCache: true };
    }

    try {
      const response = await fetchImpl(releaseUrl, {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "Obscura update checker",
        },
      });
      if (!response.ok) throw new Error(`GitHub release check failed with ${response.status}`);
      const payload = (await response.json()) as GithubReleasePayload;
      const tag = typeof payload.tag_name === "string" ? payload.tag_name : null;
      const latestUrl = typeof payload.html_url === "string" ? payload.html_url : null;
      const latestVersion = tag ? normalizeReleaseVersion(tag) : null;
      if (!latestVersion || !latestUrl) throw new Error("GitHub release payload was incomplete");
      const updateAvailable = compareReleaseVersions(latestVersion, options.localVersion) > 0;
      const status: ReleaseUpdateStatus = {
        status: updateAvailable ? "available" : "current",
        localVersion: options.localVersion,
        latestVersion,
        latestUrl,
        updateAvailable,
        checkedAt: now.toISOString(),
        fromCache: false,
      };
      cached = { timestamp: now.getTime(), status };
      return status;
    } catch (error) {
      const status = unknownStatus(options.localVersion, now, error);
      cached = { timestamp: now.getTime(), status };
      return status;
    }
  };
}

export const checkForReleaseUpdate = createReleaseUpdateChecker();
```

- [ ] **Step 4: Re-export and verify app-core tests pass**

Add to `packages/app-core/src/index.ts`:

```ts
export * from "./release-check";
```

Run: `pnpm --filter @obscura/app-core exec vitest run src/release-check.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/app-core/src/release-check.ts packages/app-core/src/release-check.test.ts packages/app-core/src/index.ts
git commit -m "feat(core): check latest release status"
```

## Task 2: SvelteKit Update Check API

**Files:**
- Create: `apps/web-svelte/src/routes/api/update-check/+server.ts`
- Create: `apps/web-svelte/src/routes/api/update-check/update-check-route.test.ts`

- [ ] **Step 1: Write failing API route test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkForReleaseUpdate } = vi.hoisted(() => ({
  checkForReleaseUpdate: vi.fn(),
}));

vi.mock("@obscura/app-core", () => ({
  checkForReleaseUpdate,
}));

describe("/api/update-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkForReleaseUpdate.mockResolvedValue({
      status: "available",
      localVersion: "0.22.1-dev",
      latestVersion: "0.23.0",
      latestUrl: "https://github.com/pauljoda/Obscura/releases/tag/v0.23.0",
      updateAvailable: true,
      checkedAt: "2026-05-11T12:00:00.000Z",
      fromCache: false,
    });
  });

  it("returns release update status as JSON", async () => {
    const { GET } = await import("./+server");

    const response = await GET({ url: new URL("http://test/api/update-check") } as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "available", updateAvailable: true });
    expect(checkForReleaseUpdate).toHaveBeenCalledWith({
      localVersion: "0.22.1-dev",
      force: false,
    });
  });

  it("passes force through for manual refresh", async () => {
    const { GET } = await import("./+server");

    await GET({ url: new URL("http://test/api/update-check?force=1") } as never);

    expect(checkForReleaseUpdate).toHaveBeenCalledWith({
      localVersion: "0.22.1-dev",
      force: true,
    });
  });
});
```

- [ ] **Step 2: Run API test to verify it fails**

Run: `pnpm --filter @obscura/web-svelte exec vitest run src/routes/api/update-check/update-check-route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement API route**

```ts
import { checkForReleaseUpdate } from "@obscura/app-core";
import { APP_VERSION } from "$lib/version";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const force = url.searchParams.get("force") === "1";
  const status = await checkForReleaseUpdate({
    localVersion: APP_VERSION,
    force,
  });

  return Response.json(status);
};
```

- [ ] **Step 4: Run API test to verify it passes**

Run: `pnpm --filter @obscura/web-svelte exec vitest run src/routes/api/update-check/update-check-route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/web-svelte/src/routes/api/update-check/+server.ts apps/web-svelte/src/routes/api/update-check/update-check-route.test.ts
git commit -m "feat(web): expose update check route"
```

## Task 3: Client Helper and UI

**Files:**
- Modify: `apps/web-svelte/src/lib/version.ts`
- Modify: `apps/web-svelte/src/lib/version.test.ts`
- Modify: `apps/web-svelte/src/lib/components/Sidebar.svelte`
- Modify: `apps/web-svelte/src/lib/components/ChangelogDialog.svelte`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Write failing client helper tests**

Add to `apps/web-svelte/src/lib/version.test.ts`:

```ts
import { fetchReleaseUpdateStatus } from "./version";

it("fetches release status without forcing by default", async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
    status: "current",
    localVersion: "0.22.1-dev",
    latestVersion: "0.22.1",
    latestUrl: "https://example.test",
    updateAvailable: false,
    checkedAt: "2026-05-11T12:00:00.000Z",
    fromCache: false,
  })));

  const status = await fetchReleaseUpdateStatus(fetchImpl);

  expect(fetchImpl).toHaveBeenCalledWith("/api/update-check");
  expect(status?.status).toBe("current");
});

it("fetches release status with force for manual checks", async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
    status: "available",
    localVersion: "0.22.1-dev",
    latestVersion: "0.23.0",
    latestUrl: "https://example.test",
    updateAvailable: true,
    checkedAt: "2026-05-11T12:00:00.000Z",
    fromCache: false,
  })));

  const status = await fetchReleaseUpdateStatus(fetchImpl, { force: true });

  expect(fetchImpl).toHaveBeenCalledWith("/api/update-check?force=1");
  expect(status?.updateAvailable).toBe(true);
});
```

- [ ] **Step 2: Run helper tests to verify they fail**

Run: `pnpm --filter @obscura/web-svelte exec vitest run src/lib/version.test.ts`

Expected: FAIL because `fetchReleaseUpdateStatus` is not exported.

- [ ] **Step 3: Implement client helper**

Add to `version.ts`:

```ts
export type ReleaseUpdateStatusKind = "available" | "current" | "unknown";

export interface ReleaseUpdateStatus {
  status: ReleaseUpdateStatusKind;
  localVersion: string;
  latestVersion: string | null;
  latestUrl: string | null;
  updateAvailable: boolean;
  checkedAt: string;
  fromCache: boolean;
  error?: string;
}

export async function fetchReleaseUpdateStatus(
  fetchImpl: typeof fetch = fetch,
  options?: { force?: boolean },
): Promise<ReleaseUpdateStatus | null> {
  try {
    const res = await fetchImpl(`/api/update-check${options?.force ? "?force=1" : ""}`);
    if (!res.ok) return null;
    return (await res.json()) as ReleaseUpdateStatus;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Update Svelte components**

In `Sidebar.svelte`, import `fetchReleaseUpdateStatus` and set a local status. Use `$effect` so it runs only on the client, then switch the LED class when `status?.updateAvailable` is true.

In `ChangelogDialog.svelte`, load release status when opening the dialog, add a `RefreshCw` icon button, and render an update link above the changelog blocks when `releaseStatus?.updateAvailable && releaseStatus.latestUrl`.

- [ ] **Step 5: Update changelog**

Add under `### What's New`:

```md
- Obscura now checks GitHub for newer releases and highlights the app version when an update is available, with a direct release link in the changelog dialog.
```

Add under `### Added`:

```md
- Added a best-effort in-app release check that compares the installed version to the latest GitHub release once per day and supports manual refresh from the changelog dialog.
```

- [ ] **Step 6: Run Svelte autofixer and helper tests**

Run:

```bash
npx @sveltejs/mcp svelte-autofixer apps/web-svelte/src/lib/components/Sidebar.svelte --svelte-version 5
npx @sveltejs/mcp svelte-autofixer apps/web-svelte/src/lib/components/ChangelogDialog.svelte --svelte-version 5
pnpm --filter @obscura/web-svelte exec vitest run src/lib/version.test.ts
```

Expected: autofixer reports no blocking Svelte issues and Vitest passes.

- [ ] **Step 7: Commit Task 3**

```bash
git add apps/web-svelte/src/lib/version.ts apps/web-svelte/src/lib/version.test.ts apps/web-svelte/src/lib/components/Sidebar.svelte apps/web-svelte/src/lib/components/ChangelogDialog.svelte CHANGELOG.md
git commit -m "feat(web): surface release update alerts"
```

## Task 4: Final Verification

**Files:**
- No planned source edits unless verification finds defects.

- [ ] **Step 1: Run focused tests**

```bash
pnpm --filter @obscura/app-core exec vitest run src/release-check.test.ts
pnpm --filter @obscura/web-svelte exec vitest run src/routes/api/update-check/update-check-route.test.ts src/lib/version.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run web typecheck**

```bash
pnpm --filter @obscura/web-svelte typecheck
```

Expected: PASS.

- [ ] **Step 3: Start dev server and browser-check changelog**

```bash
pnpm --filter @obscura/web-svelte dev --host 127.0.0.1
```

Open `http://127.0.0.1:8008`, open the changelog dialog, and verify the version row stays visible and the dialog still renders without overlap.

- [ ] **Step 4: Commit verification fixes if needed**

If verification requires fixes, commit only those fixes with:

```bash
git add <fixed-files>
git commit -m "fix(web): stabilize update alert UI"
```
