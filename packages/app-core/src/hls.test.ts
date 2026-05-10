import os from "node:os";
import path from "node:path";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHlsRenditions } from "@obscura/contracts/media";

const { getCacheRootDir, runProcess, runtime } = vi.hoisted(() => ({
  getCacheRootDir: vi.fn(),
  runProcess: vi.fn(),
  runtime: {
    cacheRoot: "",
  },
}));

vi.mock("@obscura/media-core", () => ({
  getCacheRootDir,
  runProcess,
}));

describe("continuous HLS package generation", () => {
  let tempDir: string;
  let sourcePath: string;

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await mkdtempInOsTmp();
    sourcePath = path.join(tempDir, "episode.mkv");
    runtime.cacheRoot = path.join(tempDir, "cache");
    getCacheRootDir.mockImplementation(() => runtime.cacheRoot);
    await writeFile(sourcePath, "source-bytes");
  });

  afterEach(async () => {
    const { resetHlsTracker } = await import("./hls");
    resetHlsTracker();
    await rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("uses one ffmpeg HLS muxer job with 3 second segments instead of per-segment seeks", async () => {
    runProcess.mockImplementation(async (_command: string, args: string[]) => {
      const indexPath = args.at(-1);
      if (!indexPath) throw new Error("missing index path");
      const cacheDir = path.dirname(path.dirname(indexPath));
      await writeFile(path.join(cacheDir, "master.m3u8"), "#EXTM3U\n");
      return { stdout: "", stderr: "" };
    });

    const { startHlsGeneration } = await import("./hls");

    await startHlsGeneration("video-1", sourcePath, 720);

    const args = runProcess.mock.calls[0]?.[1] as string[];
    expect(args).toEqual(expect.arrayContaining(["-f", "hls"]));
    expect(args).toEqual(expect.arrayContaining(["-hls_time", "3"]));
    expect(args).toEqual(expect.arrayContaining(["-hls_flags", "independent_segments+append_list"]));
    expect(args).not.toContain("-ss");
    expect(args).not.toContain("-t");
  });

  it("keeps status pending until three segments per variant are ready", async () => {
    let releaseBuilder!: () => void;
    const builderReleased = new Promise<void>((resolve) => {
      releaseBuilder = resolve;
    });

    const { getHlsStatus, peekHlsTracker, setHlsBuilder } = await import("./hls");

    setHlsBuilder(async (_videoId, _sourcePath, renditions, cacheDir) => {
      await writeFile(path.join(cacheDir, "master.m3u8"), "#EXTM3U\n");
      await Promise.all(
        renditions.map(async (rendition) => {
          const variantDir = path.join(cacheDir, rendition.name);
          await mkdir(variantDir, { recursive: true });
          await writeFile(path.join(variantDir, "index.m3u8"), "#EXTM3U\n");
          await writeFile(path.join(variantDir, "segment_000.ts"), "segment-0");
        }),
      );
      await builderReleased;
    });

    await expect(getHlsStatus("video-2", sourcePath, 720)).resolves.toMatchObject({
      state: "pending",
    });

    await new Promise((resolve) => setTimeout(resolve, 350));
    await expect(getHlsStatus("video-2", sourcePath, 720)).resolves.toMatchObject({
      state: "pending",
    });

    const cacheDir = path.join(runtime.cacheRoot, "hls", "video-2");
    for (const rendition of getHlsRenditions(720)) {
      await writeFile(path.join(cacheDir, rendition.name, "segment_001.ts"), "segment-1");
      await writeFile(path.join(cacheDir, rendition.name, "segment_002.ts"), "segment-2");
    }

    await vi.waitFor(async () => {
      await expect(getHlsStatus("video-2", sourcePath, 720)).resolves.toMatchObject({
        state: "ready",
      });
    });

    releaseBuilder();
    await peekHlsTracker("video-2")?.promise;
    await expect(stat(path.join(cacheDir, "metadata.json"))).resolves.toMatchObject({
      size: expect.any(Number),
    });
  });

  it("rebuilds stale packages that predate the continuous hls2 cache engine", async () => {
    const cacheDir = path.join(runtime.cacheRoot, "hls", "video-3");
    await mkdir(cacheDir, { recursive: true });
    await writeFile(path.join(cacheDir, "master.m3u8"), "#EXTM3U\n");
    const sourceStats = await stat(sourcePath);
    await writeFile(
      path.join(cacheDir, "metadata.json"),
      JSON.stringify(
        {
          sourcePath,
          sourceSize: sourceStats.size,
          sourceMtimeMs: sourceStats.mtimeMs,
          renditions: [],
        },
        null,
        2,
      ),
    );

    runProcess.mockImplementation(async () => ({ stdout: "", stderr: "" }));

    const { getHlsStatus, startHlsGeneration } = await import("./hls");

    await expect(getHlsStatus("video-3", sourcePath, 720)).resolves.toMatchObject({
      state: "pending",
    });
    await startHlsGeneration("video-3", sourcePath, 720);

    expect(runProcess).toHaveBeenCalled();
  });
});

async function mkdtempInOsTmp(): Promise<string> {
  const { mkdtemp } = await import("node:fs/promises");
  return mkdtemp(path.join(os.tmpdir(), "obscura-hls-"));
}
