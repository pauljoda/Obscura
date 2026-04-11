import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCacheRootDir } from "@obscura/media-core";
import {
  getHlsRenditions,
  type HlsPackageState,
  type HlsRendition,
  type HlsStatus,
} from "@obscura/contracts/media";
import { runProcess } from "./media";

export interface HlsPackage {
  outputDir: string;
  masterManifestPath: string;
  renditions: HlsRendition[];
}

interface HlsCacheMetadata {
  sourcePath: string;
  sourceSize: number;
  sourceMtimeMs: number;
  renditions: HlsRendition[];
}

function getHlsCacheDir() {
  return path.join(getCacheRootDir(), "hls");
}

export interface HlsTrackerEntry {
  state: HlsPackageState;
  renditions: HlsRendition[];
  error?: string;
  promise?: Promise<HlsPackage>;
}

const trackerState = new Map<string, HlsTrackerEntry>();

function getSceneCacheDir(sceneId: string) {
  return path.join(getHlsCacheDir(), sceneId);
}

async function readMetadata(cacheDir: string) {
  const metadataPath = path.join(cacheDir, "metadata.json");
  if (!existsSync(metadataPath)) {
    return null;
  }

  const raw = await readFile(metadataPath, "utf8");
  return JSON.parse(raw) as HlsCacheMetadata;
}

async function isPackageFresh(
  cacheDir: string,
  sourcePath: string,
  renditions: HlsRendition[]
) {
  const metadata = await readMetadata(cacheDir);
  if (!metadata) {
    return false;
  }

  const sourceStats = await stat(sourcePath);
  const masterManifestPath = path.join(cacheDir, "master.m3u8");

  return (
    metadata.sourcePath === sourcePath &&
    metadata.sourceSize === sourceStats.size &&
    metadata.sourceMtimeMs === sourceStats.mtimeMs &&
    JSON.stringify(metadata.renditions) === JSON.stringify(renditions) &&
    existsSync(masterManifestPath)
  );
}

export type HlsBuilder = (
  sceneId: string,
  sourcePath: string,
  renditions: HlsRendition[],
  cacheDir: string
) => Promise<void>;

async function ffmpegHlsBuilder(
  _sceneId: string,
  sourcePath: string,
  renditions: HlsRendition[],
  cacheDir: string
): Promise<void> {
  const variantCount = renditions.length;
  const splitTargets = Array.from({ length: variantCount }, (_, index) => `[v${index}]`).join("");
  const filterSegments = renditions.map((rendition, index) => {
    return `[v${index}]scale=w=-2:h=${rendition.height}:force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p[v${index}out]`;
  });

  const filterComplex = [`[0:v]split=${variantCount}${splitTargets}`, ...filterSegments].join(";");

  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostats",
    "-i",
    sourcePath,
    "-filter_complex",
    filterComplex,
  ];

  for (let index = 0; index < variantCount; index += 1) {
    args.push("-map", `[v${index}out]`, "-map", "0:a:0?");
  }

  renditions.forEach((rendition, index) => {
    args.push(
      `-c:v:${index}`,
      "libx264",
      `-preset:v:${index}`,
      "slow",
      `-profile:v:${index}`,
      "high",
      `-pix_fmt:v:${index}`,
      "yuv420p",
      `-sc_threshold:v:${index}`,
      "0",
      `-g:v:${index}`,
      "48",
      `-keyint_min:v:${index}`,
      "48",
      `-crf:v:${index}`,
      String(rendition.crf),
      `-b:v:${index}`,
      rendition.videoBitrate,
      `-maxrate:v:${index}`,
      rendition.maxRate,
      `-bufsize:v:${index}`,
      rendition.bufferSize,
      `-c:a:${index}`,
      "aac",
      `-b:a:${index}`,
      rendition.audioBitrate,
      `-ar:a:${index}`,
      "48000",
      `-ac:a:${index}`,
      "2"
    );
  });

  const varStreamMap = renditions
    .map((rendition, index) => `v:${index},a:${index},name:${rendition.name}`)
    .join(" ");

  args.push(
    "-f",
    "hls",
    "-hls_playlist_type",
    "vod",
    "-hls_time",
    "6",
    "-hls_flags",
    "independent_segments",
    "-master_pl_name",
    "master.m3u8",
    "-var_stream_map",
    varStreamMap,
    "-hls_segment_filename",
    path.join(cacheDir, "%v", "segment_%03d.ts"),
    path.join(cacheDir, "%v", "index.m3u8")
  );

  await runProcess("ffmpeg", args);
}

let activeBuilder: HlsBuilder = ffmpegHlsBuilder;

/** Swap the HLS builder implementation — for tests. */
export function setHlsBuilder(builder: HlsBuilder) {
  activeBuilder = builder;
}

/** Reset tracker state — for tests. */
export function resetHlsTracker() {
  trackerState.clear();
}

async function buildHlsPackage(
  sceneId: string,
  sourcePath: string,
  sourceHeight: number | null
): Promise<HlsPackage> {
  const cacheDir = getSceneCacheDir(sceneId);
  const renditions = getHlsRenditions(sourceHeight);
  const masterManifestPath = path.join(cacheDir, "master.m3u8");

  if (await isPackageFresh(cacheDir, sourcePath, renditions)) {
    return { outputDir: cacheDir, masterManifestPath, renditions };
  }

  await rm(cacheDir, { recursive: true, force: true });
  await mkdir(cacheDir, { recursive: true });

  await activeBuilder(sceneId, sourcePath, renditions, cacheDir);

  const sourceStats = await stat(sourcePath);
  const metadata: HlsCacheMetadata = {
    sourcePath,
    sourceSize: sourceStats.size,
    sourceMtimeMs: sourceStats.mtimeMs,
    renditions,
  };

  await writeFile(
    path.join(cacheDir, "metadata.json"),
    JSON.stringify(metadata, null, 2),
    "utf8"
  );

  return { outputDir: cacheDir, masterManifestPath, renditions };
}

/**
 * Non-blocking: reports current tracker + disk state and — if the package is
 * neither ready nor in progress — kicks off generation in the background.
 * Never awaits the build. Routes should call this and respond immediately.
 */
export async function getHlsStatus(
  sceneId: string,
  sourcePath: string,
  sourceHeight: number | null
): Promise<HlsStatus> {
  const renditions = getHlsRenditions(sourceHeight);
  const cacheDir = getSceneCacheDir(sceneId);

  const existing = trackerState.get(sceneId);
  if (existing && existing.state === "pending") {
    return { state: "pending", renditions };
  }

  // Disk may have been populated by a previous process — probe cheaply.
  if (await isPackageFresh(cacheDir, sourcePath, renditions)) {
    trackerState.set(sceneId, { state: "ready", renditions });
    return { state: "ready", renditions };
  }

  if (existing && existing.state === "error") {
    return { state: "error", renditions, error: existing.error };
  }

  // Nothing on disk and no active build — start one in the background.
  startHlsGeneration(sceneId, sourcePath, sourceHeight);
  return { state: "pending", renditions };
}

/**
 * Fire-and-forget build. Multiple callers share a single promise via the
 * tracker so concurrent requests coalesce to one ffmpeg invocation.
 */
export function startHlsGeneration(
  sceneId: string,
  sourcePath: string,
  sourceHeight: number | null
): Promise<HlsPackage> {
  const existing = trackerState.get(sceneId);
  if (existing?.promise && existing.state === "pending") {
    return existing.promise;
  }

  const renditions = getHlsRenditions(sourceHeight);
  const promise = buildHlsPackage(sceneId, sourcePath, sourceHeight)
    .then((pkg) => {
      trackerState.set(sceneId, { state: "ready", renditions: pkg.renditions });
      return pkg;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      trackerState.set(sceneId, { state: "error", renditions, error: message });
      throw error;
    });

  trackerState.set(sceneId, { state: "pending", renditions, promise });
  return promise;
}

/**
 * Legacy blocking call: awaits until the package is ready. Kept for callers
 * (e.g. direct consumers) that really do need to wait. HTTP routes should
 * prefer getHlsStatus + 503 so clients can poll.
 */
export async function ensureHlsPackage(
  sceneId: string,
  sourcePath: string,
  sourceHeight: number | null
): Promise<HlsPackage> {
  const existing = trackerState.get(sceneId);
  if (existing?.promise && existing.state === "pending") {
    return existing.promise;
  }

  if (existing?.state === "ready") {
    const cacheDir = getSceneCacheDir(sceneId);
    const renditions = getHlsRenditions(sourceHeight);
    if (await isPackageFresh(cacheDir, sourcePath, renditions)) {
      return {
        outputDir: cacheDir,
        masterManifestPath: path.join(cacheDir, "master.m3u8"),
        renditions,
      };
    }
  }

  return startHlsGeneration(sceneId, sourcePath, sourceHeight);
}

/** Read tracker state without side effects — for tests and diagnostics. */
export function peekHlsTracker(sceneId: string): HlsTrackerEntry | undefined {
  return trackerState.get(sceneId);
}
