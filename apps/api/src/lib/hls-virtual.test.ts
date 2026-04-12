import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { beforeAll, describe, expect, it } from "vitest";

let tempCacheDir: string;
let tempSourceDir: string;

beforeAll(() => {
  tempCacheDir = mkdtempSync(path.join(os.tmpdir(), "obscura-hls2-test-"));
  tempSourceDir = mkdtempSync(path.join(os.tmpdir(), "obscura-hls2-src-"));
  process.env.OBSCURA_CACHE_DIR = tempCacheDir;
});

// Import after env is set so getCacheRootDir picks it up.
const virtualModulePromise = import("./hls-virtual");

describe("hls-virtual playlist fabrication", () => {
  it("segmentCount rounds up partial last segment", async () => {
    const { segmentCount } = await virtualModulePromise;
    expect(segmentCount(0)).toBe(0);
    expect(segmentCount(6)).toBe(1);
    expect(segmentCount(6.5)).toBe(2);
    expect(segmentCount(59)).toBe(10);
    expect(segmentCount(1420.06)).toBe(Math.ceil(1420.06 / 6));
  });

  it("segmentDuration returns SEGMENT_DURATION for normal segments and the remainder for the last", async () => {
    const { segmentDuration, SEGMENT_DURATION } = await virtualModulePromise;
    // 20s total → segments of 6, 6, 6, 2
    expect(segmentDuration(20, 0)).toBe(SEGMENT_DURATION);
    expect(segmentDuration(20, 2)).toBe(SEGMENT_DURATION);
    expect(segmentDuration(20, 3)).toBeCloseTo(2, 3);
  });

  it("buildMasterPlaylist emits one STREAM-INF pointing at the variant", async () => {
    const { buildMasterPlaylist, getVirtualHlsRenditions } = await virtualModulePromise;
    const body = buildMasterPlaylist({
      width: 1920,
      height: 1080,
      renditions: getVirtualHlsRenditions(1080),
    });
    expect(body).toContain("#EXTM3U");
    expect(body.match(/#EXT-X-STREAM-INF:/g)?.length).toBe(6);
    expect(body).toContain("RESOLUTION=1920x1080");
    expect(body).toContain("v/1080p/index.m3u8");
    expect(body).toContain("v/720p/index.m3u8");
    expect(body).toContain("v/180p/index.m3u8");
  });

  it("buildVariantPlaylist lists every segment and terminates with ENDLIST", async () => {
    const { buildVariantPlaylist } = await virtualModulePromise;
    const body = buildVariantPlaylist(25);
    // 25s → 5 segments of 6s, last one of 1s
    expect(body).toContain("#EXT-X-PLAYLIST-TYPE:VOD");
    expect(body).toContain("seg_00000.ts");
    expect(body).toContain("seg_00001.ts");
    expect(body).toContain("seg_00002.ts");
    expect(body).toContain("seg_00003.ts");
    expect(body).toContain("seg_00004.ts");
    expect(body).not.toContain("seg_00005.ts");
    expect(body).toContain("#EXT-X-ENDLIST");
    // Last segment duration should be 1.000 (25 - 4*6 = 1)
    const extInfLines = body.split("\n").filter((l) => l.startsWith("#EXTINF:"));
    expect(extInfLines).toHaveLength(5);
    expect(extInfLines[0]).toBe("#EXTINF:6.000,");
    expect(extInfLines[4]).toBe("#EXTINF:1.000,");
  });

  it("getSegment rejects out-of-range indices", async () => {
    const { getSegment } = await virtualModulePromise;
    const fakeSource = path.join(tempSourceDir, "never-called.mkv");
    const fakeRendition = {
      name: "720p",
      label: "720p",
      height: 720,
      videoBitrate: "2800k",
      maxRate: "3200k",
      bufferSize: "5600k",
      audioBitrate: "160k",
      crf: 19,
    };
    await expect(getSegment("scene-x", fakeSource, 20, fakeRendition, -1)).rejects.toThrow(
      /out of range/,
    );
    // 20s → 4 segments (0..3) → index 4 is past the end
    await expect(getSegment("scene-x", fakeSource, 20, fakeRendition, 4)).rejects.toThrow(
      /out of range/,
    );
  });

  it("cleans up", async () => {
    await rm(tempCacheDir, { recursive: true, force: true });
    await rm(tempSourceDir, { recursive: true, force: true });
  });
});
