import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import type { AssetResolverDeps } from "./resolve-asset-request";

function createDeps(
  overrides: Partial<AssetResolverDeps> = {},
): AssetResolverDeps {
  return {
    resolveVideoFilePath: async () => null,
    getMetadataStorageDedicated: async () => true,
    getGalleryCover: async () => ({ found: false, coverImageId: null }),
    getImageRecord: async () => null,
    getCollectionDetail: async () => ({ coverImagePath: null }),
    ...overrides,
  };
}

describe("resolveAssetRequest", () => {
  let cacheDir: string | null = null;

  afterEach(async () => {
    delete process.env.OBSCURA_CACHE_DIR;
    if (cacheDir) {
      await rm(cacheDir, { recursive: true, force: true });
      cacheDir = null;
    }
  });

  it("serves video card assets from sidecar storage", async () => {
    cacheDir = await mkdtemp(path.join(os.tmpdir(), "obscura-assets-"));
    process.env.OBSCURA_CACHE_DIR = cacheDir;

    const mediaDir = path.join(cacheDir, "media");
    await mkdir(mediaDir, { recursive: true });

    const videoPath = path.join(mediaDir, "clip.mp4");
    const cardPath = path.join(mediaDir, "clip-card.jpg");
    await writeFile(videoPath, "video-bytes");
    await writeFile(cardPath, "card-bytes");

    const { resolveAssetRequest } = await import("./resolve-asset-request");
    const response = await resolveAssetRequest(
      createDeps({
        resolveVideoFilePath: async () => videoPath,
        getMetadataStorageDedicated: async () => false,
      }),
      "videos/video-1/card",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/jpeg");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "card-bytes",
    );
  });

  it("serves collection cover assets from the cache directory", async () => {
    cacheDir = await mkdtemp(path.join(os.tmpdir(), "obscura-assets-"));
    process.env.OBSCURA_CACHE_DIR = cacheDir;

    const coverPath = path.join(cacheDir, "collections", "collection-1", "cover.webp");
    await mkdir(path.dirname(coverPath), { recursive: true });
    await writeFile(coverPath, "cover-bytes");

    const { resolveAssetRequest } = await import("./resolve-asset-request");
    const response = await resolveAssetRequest(
      createDeps({
        getCollectionDetail: async () => ({
          coverImagePath: "/assets/collections/collection-1/cover",
        }),
      }),
      "collections/collection-1/cover",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/webp");
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "cover-bytes",
    );
  });

  it("serves audio waveform json assets", async () => {
    cacheDir = await mkdtemp(path.join(os.tmpdir(), "obscura-assets-"));
    process.env.OBSCURA_CACHE_DIR = cacheDir;

    const waveformPath = path.join(
      cacheDir,
      "audio-tracks",
      "track-1",
      "waveform.json",
    );
    await mkdir(path.dirname(waveformPath), { recursive: true });
    await writeFile(waveformPath, JSON.stringify({ peaks: [0, 1, 0] }));

    const { resolveAssetRequest } = await import("./resolve-asset-request");
    const response = await resolveAssetRequest(
      createDeps(),
      "audio-tracks/track-1/waveform.json",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=86400, immutable",
    );
    expect(await response.json()).toEqual({ peaks: [0, 1, 0] });
  });
});
