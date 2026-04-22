import { expect, type APIRequestContext } from "@playwright/test";
import { access } from "node:fs/promises";
import path from "node:path";

const apiBase = process.env.OBSCURA_E2E_API_URL ?? "http://127.0.0.1:4000";
const configuredFixtureRoot = process.env.OBSCURA_E2E_LIBRARY_ROOT?.trim() || null;
const repoFixtureRoot = path.resolve(process.cwd(), "apps/web/public/media/scenes");

export interface LibraryRoot {
  id: string;
  path: string;
}

interface LibraryRootsResponse {
  roots: Array<
    LibraryRoot & {
      enabled?: boolean;
      scanMovies?: boolean;
      scanSeries?: boolean;
    }
  >;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listVideoRoots(request: APIRequestContext): Promise<LibraryRoot[]> {
  const response = await request.get(`${apiBase}/libraries?scanVideos=true&enabled=true`);
  expect(response.ok()).toBeTruthy();

  const body = (await response.json()) as LibraryRootsResponse;
  return body.roots.map((root) => ({ id: root.id, path: root.path }));
}

async function createLibraryRoot(request: APIRequestContext, fixtureRoot: string): Promise<LibraryRoot> {
  const created = await request.post(`${apiBase}/libraries`, {
    data: {
      path: fixtureRoot,
      label: "Fixture Videos",
      enabled: true,
      recursive: true,
      scanVideos: true,
      scanImages: false,
      scanAudio: false,
    },
  });

  expect(created.ok()).toBeTruthy();
  return (await created.json()) as LibraryRoot;
}

export async function ensureFixtureLibraryRoot(request: APIRequestContext): Promise<LibraryRoot> {
  const existingRoots = await listVideoRoots(request);

  if (configuredFixtureRoot) {
    const configuredMatch = existingRoots.find((root) => root.path === configuredFixtureRoot);
    if (configuredMatch) {
      return configuredMatch;
    }

    if (!(await pathExists(configuredFixtureRoot))) {
      throw new Error(
        `OBSCURA_E2E_LIBRARY_ROOT does not exist: ${configuredFixtureRoot}. ` +
          "Point it at a readable local video fixture directory.",
      );
    }

    return createLibraryRoot(request, configuredFixtureRoot);
  }

  const repoMatch = existingRoots.find((root) => root.path === repoFixtureRoot);
  if (repoMatch) {
    return repoMatch;
  }

  if (await pathExists(repoFixtureRoot)) {
    return createLibraryRoot(request, repoFixtureRoot);
  }

  const reusableRoot = existingRoots[0];
  if (reusableRoot) {
    return reusableRoot;
  }

  throw new Error(
    "No enabled video library root is available for E2E tests. " +
      "Set OBSCURA_E2E_LIBRARY_ROOT to a readable local fixture directory.",
  );
}
