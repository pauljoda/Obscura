const DEFAULT_RELEASE_URL = "https://api.github.com/repos/pauljoda/Obscura/releases/latest";
const DEFAULT_RELEASE_REDIRECT_URL = "https://github.com/pauljoda/Obscura/releases/latest";
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

interface CachedReleaseStatus {
  timestamp: number;
  status: ReleaseUpdateStatus;
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Release check failed";
}

function unknownStatus(localVersion: string, checkedAt: Date, error: unknown): ReleaseUpdateStatus {
  return {
    status: "unknown",
    localVersion,
    latestVersion: null,
    latestUrl: null,
    updateAvailable: false,
    checkedAt: checkedAt.toISOString(),
    fromCache: false,
    error: errorMessage(error),
  };
}

function statusFromRelease(localVersion: string, checkedAt: Date, latestVersion: string, latestUrl: string) {
  const updateAvailable = compareReleaseVersions(latestVersion, localVersion) > 0;

  return {
    status: updateAvailable ? "available" : "current",
    localVersion,
    latestVersion,
    latestUrl,
    updateAvailable,
    checkedAt: checkedAt.toISOString(),
    fromCache: false,
  } satisfies ReleaseUpdateStatus;
}

function versionFromReleaseUrl(url: string): string | null {
  const tag = url.match(/\/releases\/tag\/([^/?#]+)/)?.[1];
  return tag ? normalizeReleaseVersion(decodeURIComponent(tag)) : null;
}

async function fetchLatestReleaseFromRedirect(
  fetchImpl: typeof fetch,
  localVersion: string,
  checkedAt: Date,
): Promise<ReleaseUpdateStatus | null> {
  const response = await fetchImpl(DEFAULT_RELEASE_REDIRECT_URL, {
    method: "HEAD",
    headers: {
      "user-agent": "Obscura update checker",
    },
  });

  if (!response.ok) return null;

  const latestUrl = response.url;
  const latestVersion = versionFromReleaseUrl(latestUrl);
  if (!latestVersion) return null;

  return statusFromRelease(localVersion, checkedAt, latestVersion, latestUrl);
}

async function runReleaseUpdateCheck(options: Required<Pick<ReleaseUpdateCheckOptions, "localVersion">> &
  Pick<ReleaseUpdateCheckOptions, "fetchImpl" | "now" | "releaseUrl">): Promise<ReleaseUpdateStatus> {
  const now = options.now?.() ?? new Date();
  const fetchImpl = options.fetchImpl ?? fetch;
  const releaseUrl = options.releaseUrl ?? DEFAULT_RELEASE_URL;

  try {
    const response = await fetchImpl(releaseUrl, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "Obscura update checker",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub release check failed with ${response.status}`);
    }

    const payload = (await response.json()) as GithubReleasePayload;
    const tagName = typeof payload.tag_name === "string" ? payload.tag_name : null;
    const latestUrl = typeof payload.html_url === "string" ? payload.html_url : null;
    const latestVersion = tagName ? normalizeReleaseVersion(tagName) : null;

    if (!latestVersion || !latestUrl) {
      throw new Error("GitHub release payload was incomplete");
    }

    return statusFromRelease(options.localVersion, now, latestVersion, latestUrl);
  } catch (error) {
    const fallbackStatus = await fetchLatestReleaseFromRedirect(fetchImpl, options.localVersion, now).catch(
      () => null,
    );
    if (fallbackStatus) return fallbackStatus;

    return unknownStatus(options.localVersion, now, error);
  }
}

export function createReleaseUpdateChecker(
  defaults?: Pick<ReleaseUpdateCheckOptions, "fetchImpl" | "now" | "releaseUrl">,
) {
  let cached: CachedReleaseStatus | null = null;

  return async function runCheck(options: Pick<ReleaseUpdateCheckOptions, "localVersion" | "force">) {
    const now = defaults?.now?.() ?? new Date();

    if (!options.force && cached && now.getTime() - cached.timestamp < ONE_DAY_MS) {
      return { ...cached.status, fromCache: true };
    }

    const status = await runReleaseUpdateCheck({
      localVersion: options.localVersion,
      fetchImpl: defaults?.fetchImpl,
      now: () => now,
      releaseUrl: defaults?.releaseUrl,
    });

    cached = {
      timestamp: now.getTime(),
      status,
    };

    return status;
  };
}

const defaultChecker = createReleaseUpdateChecker();

export async function checkForReleaseUpdate(options: ReleaseUpdateCheckOptions): Promise<ReleaseUpdateStatus> {
  if (options.fetchImpl || options.now || options.releaseUrl) {
    return runReleaseUpdateCheck(options);
  }

  return defaultChecker(options);
}
