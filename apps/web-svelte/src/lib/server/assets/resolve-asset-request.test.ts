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
  let previousCwd: string | null = null;

  afterEach(async () => {
    delete process.env.OBSCURA_CACHE_DIR;
    if (previousCwd) {
      process.chdir(previousCwd);
      previousCwd = null;
    }
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
      "private, max-age=31536000, immutable",
    );
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "card-bytes",
    );
  });

  it("serves cached video thumbnails from the legacy worker cache after cutover", async () => {
    cacheDir = await mkdtemp(path.join(os.tmpdir(), "obscura-assets-"));
    previousCwd = process.cwd();
    process.chdir(cacheDir);
    await writeFile(path.join(cacheDir, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");

    const legacyThumbPath = path.join(
      cacheDir,
      "apps",
      "worker",
      ".obscura-cache",
      "videos",
      "video-1",
      "thumbnail.jpg",
    );
    await mkdir(path.dirname(legacyThumbPath), { recursive: true });
    await writeFile(legacyThumbPath, "legacy-thumb-bytes");

    const mediaDir = path.join(cacheDir, "media");
    await mkdir(mediaDir, { recursive: true });
    const videoPath = path.join(mediaDir, "clip.mp4");
    await writeFile(videoPath, "video-bytes");

    const { resolveAssetRequest } = await import("./resolve-asset-request");
    const response = await resolveAssetRequest(
      createDeps({
        resolveVideoFilePath: async () => videoPath,
        getMetadataStorageDedicated: async () => true,
      }),
      "videos/video-1/thumb",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/jpeg");
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "legacy-thumb-bytes",
    );
  });

  it("serves legacy scene asset URLs from the old scene cache", async () => {
    cacheDir = await mkdtemp(path.join(os.tmpdir(), "obscura-assets-"));
    process.env.OBSCURA_CACHE_DIR = cacheDir;

    const legacyCardPath = path.join(
      cacheDir,
      "scenes",
      "video-1",
      "card.jpg",
    );
    await mkdir(path.dirname(legacyCardPath), { recursive: true });
    await writeFile(legacyCardPath, "legacy-card-bytes");

    const mediaDir = path.join(cacheDir, "media");
    await mkdir(mediaDir, { recursive: true });
    const videoPath = path.join(mediaDir, "clip.mp4");
    await writeFile(videoPath, "video-bytes");

    const { resolveAssetRequest } = await import("./resolve-asset-request");
    const response = await resolveAssetRequest(
      createDeps({
        resolveVideoFilePath: async () => videoPath,
        getMetadataStorageDedicated: async () => true,
      }),
      "scenes/video-1/card",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/jpeg");
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "legacy-card-bytes",
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
    expect(response.headers.get("cache-control")).toBe(
      "private, max-age=300, stale-while-revalidate=86400",
    );
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "cover-bytes",
    );
  });

  it("prefers custom collection cover uploads over generated covers", async () => {
    cacheDir = await mkdtemp(path.join(os.tmpdir(), "obscura-assets-"));
    process.env.OBSCURA_CACHE_DIR = cacheDir;

    const dir = path.join(cacheDir, "collections", "collection-1");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "cover.webp"), "generated-cover");
    await writeFile(path.join(dir, "cover-custom.jpg"), "custom-cover");

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
    expect(response.headers.get("content-type")).toContain("image/jpeg");
    expect(response.headers.get("cache-control")).toBe(
      "private, max-age=300, stale-while-revalidate=86400",
    );
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "custom-cover",
    );
  });

  it("serves image previews with byte-range support for Safari", async () => {
    cacheDir = await mkdtemp(path.join(os.tmpdir(), "obscura-assets-"));
    process.env.OBSCURA_CACHE_DIR = cacheDir;

    const previewPath = path.join(cacheDir, "images", "image-1", "preview.mp4");
    await mkdir(path.dirname(previewPath), { recursive: true });
    const previewBytes = Buffer.from("0123456789abcdef");
    await writeFile(previewPath, previewBytes);

    const { resolveAssetRequest } = await import("./resolve-asset-request");

    const fullResponse = await resolveAssetRequest(
      createDeps(),
      "images/image-1/preview",
    );
    expect(fullResponse.status).toBe(200);
    expect(fullResponse.headers.get("content-type")).toBe("video/mp4");
    expect(fullResponse.headers.get("accept-ranges")).toBe("bytes");
    expect(fullResponse.headers.get("content-length")).toBe(
      String(previewBytes.length),
    );

    const rangeResponse = await resolveAssetRequest(
      createDeps(),
      "images/image-1/preview",
      "bytes=0-3",
    );
    expect(rangeResponse.status).toBe(206);
    expect(rangeResponse.headers.get("content-type")).toBe("video/mp4");
    expect(rangeResponse.headers.get("content-range")).toBe(
      `bytes 0-3/${previewBytes.length}`,
    );
    expect(rangeResponse.headers.get("content-length")).toBe("4");
    expect(rangeResponse.headers.get("accept-ranges")).toBe("bytes");
    expect(Buffer.from(await rangeResponse.arrayBuffer()).toString("utf8")).toBe(
      "0123",
    );

    const invalidRange = await resolveAssetRequest(
      createDeps(),
      "images/image-1/preview",
      "bytes=999-1000",
    );
    expect(invalidRange.status).toBe(416);
    expect(invalidRange.headers.get("content-range")).toBe(
      `bytes */${previewBytes.length}`,
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
      "private, max-age=86400, immutable",
    );
    expect(await response.json()).toEqual({ peaks: [0, 1, 0] });
  });
});
