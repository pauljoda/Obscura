import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  parityRoutes,
  resolveParityRoutePath,
  type ParityRouteDefinition,
} from "./parity/route-matrix";
import { ensureFixtureLibraryRoot } from "./fixture-library";

const liveBase = process.env.OBSCURA_E2E_WEB_URL ?? "http://127.0.0.1:8008";
const svelteBase = process.env.OBSCURA_E2E_SVELTE_URL ?? "http://127.0.0.1:8009";
const apiBase = process.env.OBSCURA_E2E_API_URL ?? "http://127.0.0.1:4000";
const fixtureTimeoutMs = 60_000;

type VideosResponse = { videos: Array<{ id: string }> };

async function resolveFixtureVideoId(request: APIRequestContext): Promise<string> {
  await ensureFixtureLibraryRoot(request);

  const scanResponse = await request.post(`${apiBase}/jobs/queues/library-scan/run`);
  expect(scanResponse.ok()).toBeTruthy();

  const deadline = Date.now() + fixtureTimeoutMs;
  while (Date.now() < deadline) {
    const response = await request.get(`${apiBase}/videos?limit=1&offset=0`);
    expect(response.ok()).toBeTruthy();

    const body = (await response.json()) as VideosResponse;
    const fixtureId = body.videos[0]?.id;
    if (fixtureId) {
      return fixtureId;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error("Timed out waiting for a fixture video to appear");
}

function pageUrl(baseUrl: string, routePath: string): string {
  return new URL(routePath, baseUrl).toString();
}

function screenshotDiffBudget(route: ParityRouteDefinition): number | undefined {
  switch (route.name) {
    case "video-detail":
      return 500;
    case "settings":
      return 1_500;
    case "jobs":
      return 2_000;
    default:
      return undefined;
  }
}

function shouldCaptureScreenshot(route: ParityRouteDefinition): boolean {
  return route.name !== "dashboard";
}

async function assertRouteLoads(
  page: Page,
  appBaseUrl: string,
  appLabel: "live" | "svelte",
  route: ParityRouteDefinition,
  routePath: string,
) {
  const targetUrl = pageUrl(appBaseUrl, routePath);
  const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

  expect(response, `Expected ${targetUrl} to return a response`).not.toBeNull();
  expect(response?.ok(), `Expected ${targetUrl} to load successfully`).toBeTruthy();
  await expect(page).toHaveURL(targetUrl);
  await expect(page.locator("body")).toBeVisible();

  const title = (await page.title()).trim();
  const heading = page.getByRole("heading", { level: 1 }).first();
  const headingCount = await heading.count();

  expect(
    title.length > 0 || headingCount > 0,
    `Expected ${targetUrl} to expose a document title or primary heading`,
  ).toBeTruthy();
  if (headingCount > 0) {
    await expect(heading).toBeVisible();
  }

  if (!shouldCaptureScreenshot(route)) {
    return;
  }

  const snapshotName = `${appLabel}-${route.name}-${route.path
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "root"}.png`;
  await expect(page).toHaveScreenshot(snapshotName, {
    fullPage: true,
    maxDiffPixels: screenshotDiffBudget(route),
  });
}

test.describe("route parity", () => {
  let fixtureVideoId = "";

  test.beforeAll(async ({ request }) => {
    fixtureVideoId = await resolveFixtureVideoId(request);
  });

  for (const route of parityRoutes) {
    for (const [appLabel, appBaseUrl] of [
      ["live", liveBase],
      ["svelte", svelteBase],
    ] as const) {
      test(`${appLabel} ${route.name} (${route.path})`, async ({ page }) => {
        const routePath = resolveParityRoutePath(route, fixtureVideoId);
        await assertRouteLoads(page, appBaseUrl, appLabel, route, routePath);
      });
    }
  }
});
