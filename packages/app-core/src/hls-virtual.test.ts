import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HlsRendition } from "@obscura/contracts/media";

const { getCacheRootDir, spawn, runtime } = vi.hoisted(() => ({
  getCacheRootDir: vi.fn(),
  spawn: vi.fn(),
  runtime: {
    cacheRoot: "",
  },
}));

vi.mock("@obscura/media-core", () => ({
  getCacheRootDir,
}));

vi.mock("node:child_process", () => ({
  default: { spawn },
  spawn,
}));

const rendition: HlsRendition = {
  name: "720p",
  label: "720p",
  height: 720,
  videoBitrate: "2800k",
  maxRate: "3200k",
  bufferSize: "5600k",
  audioBitrate: "128k",
  crf: 20,
};

describe("virtual HLS segments", () => {
  let tempDir: string;
  let sourcePath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "obscura-hls2-"));
    sourcePath = path.join(tempDir, "episode.mkv");
    runtime.cacheRoot = path.join(tempDir, "cache");
    getCacheRootDir.mockImplementation(() => runtime.cacheRoot);
    await writeFile(sourcePath, "source-bytes");

    spawn.mockImplementation((_command: string, args: string[]) => {
      const stderr = new PassThrough();
      const process = Object.assign(new EventEmitter(), {
        stderr,
        kill: vi.fn(),
      });
      const tmpPath = args.at(-1);

      queueMicrotask(async () => {
        if (tmpPath) {
          await writeFile(tmpPath, `segment-${spawn.mock.calls.length}`);
        }
        process.emit("close", 0);
      });

      return process;
    });
  });

  afterEach(async () => {
    const { resetVirtualHlsInflight } = await import("./hls-virtual");
    resetVirtualHlsInflight();
    await rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("prefetches the next segment after serving the requested segment", async () => {
    const { getSegment } = await import("./hls-virtual");

    const segmentPath = await getSegment("video-1", sourcePath, 18, rendition, 0);

    expect(path.basename(segmentPath)).toBe("seg_00000.ts");
    await vi.waitFor(() => expect(spawn).toHaveBeenCalledTimes(2));

    const spawnArgs = spawn.mock.calls.map((call) => call[1] as string[]);
    expect(spawnArgs[0]).toEqual(expect.arrayContaining(["-ss", "0.000"]));
    expect(spawnArgs[1]).toEqual(expect.arrayContaining(["-ss", "6.000"]));

    const prefetchedPath = path.join(
      runtime.cacheRoot,
      "hls2",
      "video-1",
      rendition.name,
      "seg_00001.ts",
    );
    await expect(stat(prefetchedPath)).resolves.toMatchObject({ size: expect.any(Number) });
  });
});
