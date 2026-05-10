import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
      if (command === "ffmpeg") {
        const outPath = args.at(-1);
        if (!outPath) throw new Error("missing ffmpeg output path");
        await mkdir(path.dirname(outPath), { recursive: true });
        await writeFile(outPath, "prepared-mp4-with-audio");
        return { stdout: "", stderr: "" };
      }
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

  it("prepares a seekable mp4 cache before serving uncached mkv sources", async () => {
    const { serveVideoSource } = await import("./video-stream");

    const response = await serveVideoSource(createDb(sourcePath), "video-1", null);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-length")).toBe(String("prepared-mp4-with-audio".length));
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "prepared-mp4-with-audio",
    );
    const videoProbeArgs = runProcess.mock.calls.find(
      ([command, args]) => command === "ffprobe" && (args as string[]).includes("v:0"),
    )?.[1] as string[] | undefined;
    expect(videoProbeArgs?.filter((arg) => arg === "v:0")).toHaveLength(1);
    expect(videoProbeArgs?.at(-1)).toBe(sourcePath);
    expect(runProcess).toHaveBeenCalledWith(
      "ffmpeg",
      expect.arrayContaining([
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-tag:v",
        "hvc1",
        "-movflags",
        "+faststart",
      ]),
    );
  });

  it("serves direct scrubs from the prepared mp4 cache with byte ranges", async () => {
    const { serveVideoSource } = await import("./video-stream");

    await serveVideoSource(createDb(sourcePath), "video-1", null);
    const response = await serveVideoSource(createDb(sourcePath), "video-1", "bytes=9-11");

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-range")).toBe("bytes 9-11/23");
    expect(response.headers.get("content-length")).toBe("3");
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "mp4",
    );
    expect(runProcess.mock.calls.filter(([command]) => command === "ffmpeg")).toHaveLength(1);
  });
});
