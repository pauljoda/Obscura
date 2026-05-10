import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schema, type AppDb } from "@obscura/db";

const { getCacheRootDir, resolveExistingMediaPath, runProcess, spawn, runtime } =
  vi.hoisted(() => ({
    getCacheRootDir: vi.fn(),
    resolveExistingMediaPath: vi.fn(),
    runProcess: vi.fn(),
    spawn: vi.fn(),
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

vi.mock("node:child_process", () => ({
  default: { spawn },
  spawn,
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
    spawn.mockImplementation(() => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const process = Object.assign(new EventEmitter(), {
        stdout,
        stderr,
        kill: vi.fn(),
      });

      queueMicrotask(() => {
        stdout.write(Buffer.from("fragmented-mp4"));
        stdout.end();
        process.emit("close", 0);
      });

      return process;
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("streams a fragmented mp4 immediately for uncached mkv sources", async () => {
    const { serveVideoSource } = await import("./video-stream");

    const response = await serveVideoSource(createDb(sourcePath), "video-1", null);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "fragmented-mp4",
    );
    const videoProbeArgs = runProcess.mock.calls.find(
      ([command, args]) => command === "ffprobe" && (args as string[]).includes("v:0"),
    )?.[1] as string[] | undefined;
    expect(videoProbeArgs?.filter((arg) => arg === "v:0")).toHaveLength(1);
    expect(videoProbeArgs?.at(-1)).toBe(sourcePath);
    expect(spawn).toHaveBeenCalledWith(
      "ffmpeg",
      expect.arrayContaining([
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-tag:v",
        "hvc1",
        "-movflags",
        "frag_keyframe+empty_moov+default_base_moof",
      ]),
      expect.objectContaining({
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  });

  it("treats bytes=0- as an initial direct request instead of returning 503", async () => {
    const { serveVideoSource } = await import("./video-stream");

    const response = await serveVideoSource(
      createDb(sourcePath),
      "video-1",
      "bytes=0-",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "fragmented-mp4",
    );
    expect(spawn).toHaveBeenCalledTimes(1);
  });
});
