import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runProcess } from "@obscura/media-core";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("continuous HLS audio packets", () => {
  let tempDir: string;
  let previousCacheDir: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "obscura-hls-audio-"));
    previousCacheDir = process.env.OBSCURA_CACHE_DIR;
    process.env.OBSCURA_CACHE_DIR = path.join(tempDir, "cache");
  });

  afterEach(async () => {
    const { resetHlsTracker } = await import("./hls");
    resetHlsTracker();
    if (previousCacheDir === undefined) {
      delete process.env.OBSCURA_CACHE_DIR;
    } else {
      process.env.OBSCURA_CACHE_DIR = previousCacheDir;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  (hasFfmpeg ? it : it.skip)(
    "keeps adjacent AAC packet boundaries continuous across generated segments",
    async () => {
      const sourcePath = path.join(tempDir, "synthetic.mp4");
      await runProcess("ffmpeg", [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=160x90:rate=24:duration=10",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:sample_rate=48000:duration=10",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        sourcePath,
      ]);

      const { startHlsGeneration } = await import("./hls");
      await startHlsGeneration("synthetic", sourcePath, 180);

      const first = await readAudioPacketBounds(
        path.join(process.env.OBSCURA_CACHE_DIR!, "hls", "synthetic", "180p", "segment_000.ts"),
      );
      const second = await readAudioPacketBounds(
        path.join(process.env.OBSCURA_CACHE_DIR!, "hls", "synthetic", "180p", "segment_001.ts"),
      );
      const third = await readAudioPacketBounds(
        path.join(process.env.OBSCURA_CACHE_DIR!, "hls", "synthetic", "180p", "segment_002.ts"),
      );

      expect(Math.abs(first.end - second.start)).toBeLessThanOrEqual(0.08);
      expect(Math.abs(second.end - third.start)).toBeLessThanOrEqual(0.08);
    },
    30_000,
  );
});

async function readAudioPacketBounds(filePath: string): Promise<{ start: number; end: number }> {
  const { stdout } = await runProcess("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "packet=pts_time,duration_time",
    "-of",
    "csv=p=0",
    filePath,
  ]);
  const packets = stdout
    .trim()
    .split("\n")
    .map((line) => {
      const [pts, duration] = line.split(",").map((value) => Number.parseFloat(value));
      return { pts, duration };
    })
    .filter((packet) => Number.isFinite(packet.pts) && Number.isFinite(packet.duration));
  if (packets.length === 0) {
    throw new Error(`No audio packets found in ${filePath}`);
  }
  const first = packets[0]!;
  const last = packets.at(-1)!;
  return {
    start: first.pts,
    end: last.pts + last.duration,
  };
}
