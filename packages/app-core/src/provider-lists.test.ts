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
