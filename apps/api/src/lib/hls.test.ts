import { mkdtempSync, writeFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

let tempCacheDir: string;
let tempSourceDir: string;

beforeAll(() => {
  tempCacheDir = mkdtempSync(path.join(os.tmpdir(), "obscura-hls-test-"));
  tempSourceDir = mkdtempSync(path.join(os.tmpdir(), "obscura-hls-src-"));
  process.env.OBSCURA_CACHE_DIR = tempCacheDir;
});

// Import AFTER env is set so getCacheRootDir picks it up.
const hlsModulePromise = import("./hls");

function makeSource(name: string, content = "fake video bytes") {
  const p = path.join(tempSourceDir, name);
  writeFileSync(p, content);
  return p;
}

async function stubBuilderWritesManifest() {
  const { setHlsBuilder } = await hlsModulePromise;
  setHlsBuilder(async (_sceneId, _sourcePath, renditions, cacheDir) => {
    const masterLines = ["#EXTM3U", "#EXT-X-VERSION:3"];
    for (const r of renditions) {
      const variantDir = path.join(cacheDir, r.name);
      await mkdir(variantDir, { recursive: true });
      await writeFile(path.join(variantDir, "index.m3u8"), "#EXTM3U\n");
      masterLines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${r.videoBitrate.replace("k", "000")},RESOLUTION=x${r.height}`,
        `${r.name}/index.m3u8`,
      );
    }
    await writeFile(path.join(cacheDir, "master.m3u8"), masterLines.join("\n"));
  });
}

async function stubBuilderFails(error = "ffmpeg exploded") {
  const { setHlsBuilder } = await hlsModulePromise;
  setHlsBuilder(async () => {
    throw new Error(error);
  });
}

async function stubBuilderPending() {
  const { setHlsBuilder } = await hlsModulePromise;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  setHlsBuilder(async (_sceneId, _sourcePath, renditions, cacheDir) => {
    await gate;
    const masterLines = ["#EXTM3U"];
    for (const r of renditions) {
      const variantDir = path.join(cacheDir, r.name);
      await mkdir(variantDir, { recursive: true });
      await writeFile(path.join(variantDir, "index.m3u8"), "#EXTM3U\n");
      masterLines.push(`${r.name}/index.m3u8`);
    }
    await writeFile(path.join(cacheDir, "master.m3u8"), masterLines.join("\n"));
  });
  return release;
}

beforeEach(async () => {
  const { resetHlsTracker } = await hlsModulePromise;
  resetHlsTracker();
  // Clean per-test cache dir contents
  await rm(tempCacheDir, { recursive: true, force: true });
  await mkdir(tempCacheDir, { recursive: true });
});

afterEach(async () => {
  const { setHlsBuilder } = await hlsModulePromise;
  // No-op between tests to prevent bleed
  setHlsBuilder(async () => {});
});

describe("getHlsStatus", () => {
  it("reports pending and kicks off a background build on first call", async () => {
    const { getHlsStatus, peekHlsTracker } = await hlsModulePromise;
    const release = await stubBuilderPending();

    const source = makeSource("first.mp4");
    const status = await getHlsStatus("scene-1", source, 720);

    expect(status.state).toBe("pending");
    expect(status.renditions.map((r) => r.name)).toEqual([
      "720p",
      "480p",
      "360p",
      "240p",
      "180p",
    ]);

    const entry = peekHlsTracker("scene-1");
    expect(entry?.state).toBe("pending");

    release();
    await entry?.promise;

    expect(peekHlsTracker("scene-1")?.state).toBe("ready");
  });

  it("returns ready without rebuilding when the disk cache is fresh", async () => {
    const { getHlsStatus, resetHlsTracker, startHlsGeneration, setHlsBuilder } =
      await hlsModulePromise;
    await stubBuilderWritesManifest();

    const source = makeSource("fresh.mp4");
    await startHlsGeneration("scene-fresh", source, 720);
    // Wait until build resolves
    await peekAndWait("scene-fresh");

    // Simulate a fresh process — tracker cleared, but files still on disk.
    resetHlsTracker();
    let builderCalls = 0;
    setHlsBuilder(async () => {
      builderCalls += 1;
    });

    const status = await getHlsStatus("scene-fresh", source, 720);
    expect(status.state).toBe("ready");
    expect(builderCalls).toBe(0);
  });

  it("surfaces errors from the builder and does not hang future callers", async () => {
    const { getHlsStatus, startHlsGeneration } = await hlsModulePromise;
    await stubBuilderFails("no ffmpeg");

    const source = makeSource("bad.mp4");
    await expect(
      startHlsGeneration("scene-bad", source, 720),
    ).rejects.toThrow("no ffmpeg");

    const status = await getHlsStatus("scene-bad", source, 720);
    expect(status.state).toBe("error");
    expect(status.error).toContain("no ffmpeg");
  });

  it("coalesces concurrent callers into a single build", async () => {
    const { startHlsGeneration, setHlsBuilder } = await hlsModulePromise;

    let builderCalls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setHlsBuilder(async (_sceneId, _sourcePath, renditions, cacheDir) => {
      builderCalls += 1;
      await gate;
      await writeFile(path.join(cacheDir, "master.m3u8"), "#EXTM3U");
      for (const r of renditions) {
        const variantDir = path.join(cacheDir, r.name);
        await mkdir(variantDir, { recursive: true });
        await writeFile(path.join(variantDir, "index.m3u8"), "#EXTM3U\n");
      }
    });

    const source = makeSource("concurrent.mp4");
    const p1 = startHlsGeneration("scene-concurrent", source, 720);
    const p2 = startHlsGeneration("scene-concurrent", source, 720);
    const p3 = startHlsGeneration("scene-concurrent", source, 720);

    expect(p1).toBe(p2);
    expect(p2).toBe(p3);

    release();
    await Promise.all([p1, p2, p3]);
    expect(builderCalls).toBe(1);
  });

  it("flips to ready as soon as master.m3u8 and first segments exist, before ffmpeg finishes", async () => {
    const { peekHlsTracker, startHlsGeneration, setHlsBuilder } = await hlsModulePromise;

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Builder writes the "partial" package up front, then blocks on a gate
    // simulating ffmpeg still encoding later segments.
    setHlsBuilder(async (_sceneId, _sourcePath, renditions, cacheDir) => {
      for (const r of renditions) {
        const variantDir = path.join(cacheDir, r.name);
        await mkdir(variantDir, { recursive: true });
        await writeFile(path.join(variantDir, "index.m3u8"), "#EXTM3U\n");
        await writeFile(path.join(variantDir, "segment_000.ts"), "fake-ts-bytes");
      }
      await writeFile(path.join(cacheDir, "master.m3u8"), "#EXTM3U\n");
      await gate;
      // Once released, pretend ffmpeg wrote later segments too.
      for (const r of renditions) {
        await writeFile(path.join(cacheDir, r.name, "segment_001.ts"), "fake-ts-bytes");
      }
    });

    const source = makeSource("partial-ready.mp4");
    const promise = startHlsGeneration("scene-partial", source, 480);

    // Poll for early-ready for up to ~2s. The watcher flips the tracker
    // on its own polling cadence (250ms).
    let earlyReady = false;
    for (let i = 0; i < 20; i += 1) {
      const entry = peekHlsTracker("scene-partial");
      if (entry?.state === "ready" && entry.isEncodeActive) {
        earlyReady = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(earlyReady).toBe(true);

    release();
    await promise;
    const entry = peekHlsTracker("scene-partial");
    expect(entry?.state).toBe("ready");
    expect(entry?.isEncodeActive).toBe(false);
  });

  it("includes rendition list even while pending so clients can seed the quality menu", async () => {
    const { getHlsStatus } = await hlsModulePromise;
    await stubBuilderPending();

    const source = makeSource("pending-renditions.mp4");
    const status = await getHlsStatus("scene-pending-r", source, 1080);

    expect(status.state).toBe("pending");
    expect(status.renditions).toHaveLength(6);
    expect(status.renditions[0]?.name).toBe("1080p");
  });
});

async function peekAndWait(sceneId: string) {
  const { peekHlsTracker } = await hlsModulePromise;
  const entry = peekHlsTracker(sceneId);
  if (entry?.promise) {
    await entry.promise.catch(() => {});
  }
}
