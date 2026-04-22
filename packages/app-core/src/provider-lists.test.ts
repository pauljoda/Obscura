import { describe, expect, it } from "vitest";
import {
  mapInstalledScraperPackages,
  mapStashBoxEndpointList,
} from "./provider-lists";

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

    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0].isNsfw).toBe(true);
    expect(result.endpoints[0].apiKeyPreview).not.toContain("secret-secret-");
    expect(result.endpoints[0].apiKeyPreview.endsWith("cret")).toBe(true);
    expect(result.endpoints[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("fully masks short api keys", () => {
    const result = mapStashBoxEndpointList([
      {
        id: "1",
        name: "X",
        endpoint: "https://x",
        apiKey: "ab",
        enabled: false,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
      },
    ]);
    expect(result.endpoints[0].apiKeyPreview).not.toContain("ab");
  });
});

describe("mapInstalledScraperPackages", () => {
  it("wraps rows in a packages array without mutation", () => {
    const rows = [
      { id: "a", name: "Example", version: "1.0.0" },
      { id: "b", name: "Other", version: "2.0.0" },
    ];
    const result = mapInstalledScraperPackages(rows);
    expect(result).toEqual({ packages: rows });
  });
});

describe("mapInstalledPluginPackages", () => {
  const basePackageRow = {
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
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  };

  it("derives authStatus as missing when required auth fields have no stored values", async () => {
    const { mapInstalledPluginPackages } = await import("./provider-lists");
    const result = mapInstalledPluginPackages({
      packageRows: [
        {
          ...basePackageRow,
          manifestRaw: {
            auth: [{ key: "apiKey", label: "API Key", required: true }],
          },
        },
      ],
      authRows: [],
    });
    expect(result[0].authStatus).toBe("missing");
    expect(result[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("derives authStatus as ok when every required auth field is configured", async () => {
    const { mapInstalledPluginPackages } = await import("./provider-lists");
    const result = mapInstalledPluginPackages({
      packageRows: [
        {
          ...basePackageRow,
          manifestRaw: {
            auth: [
              { key: "apiKey", label: "API Key", required: true },
              { key: "optional", label: "Optional", required: false },
            ],
          },
        },
      ],
      authRows: [{ pluginId: "tmdb", authKey: "apiKey" }],
    });
    expect(result[0].authStatus).toBe("ok");
  });

  it("returns null authStatus when the manifest declares no auth fields", async () => {
    const { mapInstalledPluginPackages } = await import("./provider-lists");
    const result = mapInstalledPluginPackages({
      packageRows: [{ ...basePackageRow, manifestRaw: {} }],
      authRows: [],
    });
    expect(result[0].authStatus).toBeNull();
  });
});
