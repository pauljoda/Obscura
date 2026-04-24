export interface StashBoxEndpointRow {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StashBoxEndpointEntry {
  id: string;
  name: string;
  endpoint: string;
  apiKeyPreview: string;
  enabled: boolean;
  isNsfw: true;
  createdAt: string;
  updatedAt: string;
}

function maskApiKey(key: string): string {
  if (key.length <= 4) return "••••";
  return "••••" + key.slice(-4);
}

export function mapStashBoxEndpointList(
  rows: readonly StashBoxEndpointRow[],
): { endpoints: StashBoxEndpointEntry[] } {
  return {
    endpoints: rows.map((r) => ({
      id: r.id,
      name: r.name,
      endpoint: r.endpoint,
      apiKeyPreview: maskApiKey(r.apiKey),
      enabled: r.enabled,
      // StashBox is a porn-metadata exchange protocol; every endpoint
      // reachable via this interface is NSFW so SFW mode can hide them
      // everywhere they show up as a metadata source.
      isNsfw: true as const,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

export function mapInstalledScraperPackages<T>(rows: readonly T[]): { packages: T[] } {
  return { packages: [...rows] };
}

export interface PluginAuthField {
  key: string;
  label: string;
  required: boolean;
  url?: string;
}

export interface InstalledPluginPackageRow {
  id: string;
  pluginId: string;
  name: string;
  version: string;
  runtime: string;
  installPath: string;
  sha256: string | null;
  isNsfw: boolean;
  capabilities: Record<string, boolean> | null;
  enabled: boolean;
  sourceIndex: string | null;
  manifestRaw: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstalledPluginPackageEntry {
  id: string;
  pluginId: string;
  name: string;
  version: string;
  runtime: string;
  installPath: string;
  sha256: string | null;
  isNsfw: boolean;
  capabilities: Record<string, boolean>;
  enabled: boolean;
  sourceIndex: string | null;
  authStatus: "ok" | "missing" | null;
  authFields?: PluginAuthField[];
  createdAt: string;
  updatedAt: string;
}

export interface MapInstalledPluginPackagesInput {
  packageRows: readonly InstalledPluginPackageRow[];
  authRows: ReadonlyArray<{ pluginId: string; authKey: string }>;
}

export function mapInstalledPluginPackages(
  input: MapInstalledPluginPackagesInput,
): InstalledPluginPackageEntry[] {
  const authByPlugin = new Map<string, Set<string>>();
  for (const row of input.authRows) {
    const set = authByPlugin.get(row.pluginId) ?? new Set<string>();
    set.add(row.authKey);
    authByPlugin.set(row.pluginId, set);
  }

  return input.packageRows.map((row) => {
    const manifest =
      row.manifestRaw && typeof row.manifestRaw === "object"
        ? (row.manifestRaw as Record<string, unknown>)
        : null;
    const rawAuth = manifest?.auth;
    const authFields = Array.isArray(rawAuth)
      ? (rawAuth as PluginAuthField[])
      : undefined;

    let authStatus: "ok" | "missing" | null = null;
    if (authFields && authFields.length > 0) {
      const configured = authByPlugin.get(row.pluginId) ?? new Set<string>();
      const allRequired = authFields
        .filter((f) => f.required)
        .every((f) => configured.has(f.key));
      authStatus = allRequired ? "ok" : "missing";
    }

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
  });
}
