import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schema, type AppDb } from "@obscura/db";

const { getCacheRootDir, resolveExistingMediaPath, runProcess, runtime } =
  vi.hoisted(() => ({
    getCacheRootDir: vi.fn(),
    resolveExistingMediaPath: vi.fn(),
    runProcess: vi.fn(),
    runtime: {
      cacheRoot: "",
    },
  }));

vi.mock("@obscura/media-core", () => ({
  getCacheRootDir,
  resolveExistingMediaPath,
  runProcess,
}));

vi.mock("@obscura/app-core", () => ({
  buildMasterPlaylist: vi.fn(),
  buildVariantPlaylist: vi.fn(),
  getHlsStatus: vi.fn(),
  getSegment: vi.fn(),
  getVirtualHlsRenditions: vi.fn(),
  peekHlsTracker: vi.fn(),
  segmentCount: vi.fn(),
  startHlsGeneration: vi.fn(),
}));

function createDb(filePath: string): AppDb {
  return {
    select() {
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                async limit() {
                  if (table === schema.videoEpisodes) {
                    return [
                      {
                        id: "video-1",
                        filePath,
                        duration: null,
                        width: null,
                        height: null,
                        codec: null,
                      },
                    ];
                  }
                  return [];
                },
              };
            },
          };
        },
      };
    },
  } as unknown as AppDb;
}

describe("serveVideoSource", () => {
  let tempDir: string;
  let sourcePath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "obscura-video-stream-"));
    sourcePath = path.join(tempDir, "episode.mkv");
    await writeFile(sourcePath, "source-bytes");

    runtime.cacheRoot = path.join(tempDir, "cache");
    getCacheRootDir.mockImplementation(() => runtime.cacheRoot);
    resolveExistingMediaPath.mockImplementation((filePath: string | undefined) => filePath ?? null);
    runProcess.mockImplementation(async (command: string, args: string[]) => {
      if (command !== "ffprobe") {
        throw new Error(`Unexpected command: ${command}`);
      }
      if (args.includes("v:0")) {
        return { stdout: "hevc,\n", stderr: "" };
      }
      if (args.includes("a:0")) {
        return { stdout: "eac3\n", stderr: "" };
      }
      if (args.includes("format=format_name")) {
        return { stdout: "mov,mp4\n", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("rejects non-native containers from Direct instead of preparing a hidden remux", async () => {
    const { serveVideoSource } = await import("./video-stream");

    const response = await serveVideoSource(createDb(sourcePath), "video-1", null);

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      error: "Direct playback is not available for this container",
    });
    expect(runProcess).not.toHaveBeenCalled();
  });

  it("serves native direct files with byte ranges", async () => {
    const { serveVideoSource } = await import("./video-stream");
    const mp4Path = path.join(tempDir, "episode.mp4");
    await writeFile(mp4Path, "native-mp4-with-audio");

    const response = await serveVideoSource(createDb(mp4Path), "video-1", "bytes=7-9");

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-range")).toBe("bytes 7-9/21");
    expect(response.headers.get("content-length")).toBe("3");
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "mp4",
    );
    expect(runProcess).not.toHaveBeenCalled();
  });
});
