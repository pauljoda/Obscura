export const DEFAULT_DEV_V2_API_BASE = "http://127.0.0.1:8010/api";

export interface V2ApiEnvironment {
  PUBLIC_API_URL?: string;
  PUBLIC_V2_API_URL?: string;
}

export interface V2UpgradeGateShellStatus {
  gateId: string;
  accepted: boolean;
  awaitingBreakingConsent: boolean;
}

export interface V2LegacyVideoImportResult {
  seriesImported: number;
  videosImported: number;
  peopleImported: number;
  tagsImported: number;
  studiosImported: number;
  linksImported: number;
}

export interface V2LegacyMediaImportResult {
  imagesImported: number;
  galleriesImported: number;
  booksImported: number;
  audioLibrariesImported: number;
  audioTracksImported: number;
  collectionsImported: number;
  linksImported: number;
}

export interface V2FreshStartPrepareResult {
  backupPath: string;
  preservedLibraryRoots: number;
  preservedSettings: boolean;
  mediaReset: boolean;
  videoImport: V2LegacyVideoImportResult | null;
  mediaImport: V2LegacyMediaImportResult | null;
}

type ServerFetch = (input: string, init?: RequestInit) => Promise<Response>;

export function resolveV2ApiBase(env: V2ApiEnvironment, isDev: boolean): string {
  const configured = env.PUBLIC_V2_API_URL || env.PUBLIC_API_URL;
  if (configured && (configured !== "/api" || !isDev)) {
    return configured.replace(/\/$/, "");
  }

  return isDev ? DEFAULT_DEV_V2_API_BASE : "/api";
}

function v2Url(apiBase: string, path: string): string {
  const trimmedBase = apiBase.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
}

async function fetchV2(
  fetcher: ServerFetch,
  apiBase: string,
  path: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetcher(v2Url(apiBase, path), init);
  } catch (err) {
    throw new Error(
      `Unable to reach the .NET v2 backend at ${apiBase}. Start or restart it with pnpm dev:backend, then retry this action.`,
      { cause: err },
    );
  }
}

async function readJson<T>(response: Response, action: string): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `${action} failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function toShellStatus(status: { gateId: string; accepted: boolean }): V2UpgradeGateShellStatus {
  return {
    gateId: status.gateId,
    accepted: status.accepted,
    awaitingBreakingConsent: !status.accepted,
  };
}

export async function readV2UpgradeGate(
  fetcher: ServerFetch,
  apiBase: string,
): Promise<V2UpgradeGateShellStatus> {
  const response = await fetchV2(fetcher, apiBase, "/system/v2-upgrade-gate", {
    method: "GET",
  });
  return toShellStatus(await readJson<{ gateId: string; accepted: boolean }>(response, "v2 gate status"));
}

export async function promptV2UpgradeGate(
  fetcher: ServerFetch,
  apiBase: string,
): Promise<V2UpgradeGateShellStatus> {
  const response = await fetchV2(fetcher, apiBase, "/system/v2-upgrade-gate/prompt", {
    method: "POST",
  });
  return toShellStatus(await readJson<{ gateId: string; accepted: boolean }>(response, "v2 gate prompt"));
}

export async function acceptAndPrepareV2Upgrade(
  fetcher: ServerFetch,
  apiBase: string,
): Promise<{
  gate: V2UpgradeGateShellStatus;
  prepared: V2FreshStartPrepareResult;
}> {
  const gateResponse = await fetchV2(fetcher, apiBase, "/system/v2-upgrade-gate/accept", {
    method: "POST",
  });
  const gate = toShellStatus(
    await readJson<{ gateId: string; accepted: boolean }>(gateResponse, "v2 gate accept"),
  );
  const prepareResponse = await fetchV2(fetcher, apiBase, "/system/v2-fresh-start/prepare", {
    method: "POST",
  });

  return {
    gate,
    prepared: await readJson<V2FreshStartPrepareResult>(
      prepareResponse,
      "v2 fresh-start prepare",
    ),
  };
}
