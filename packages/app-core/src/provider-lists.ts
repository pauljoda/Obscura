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
