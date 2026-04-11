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
  /** True while ffmpeg is still encoding, even after we've flipped to `ready`. */
  isEncodeActive: boolean;
  error?: string;
  promise?: Promise<HlsPackage>;
}

const trackerState = new Map<string, HlsTrackerEntry>();

function log(sceneId: string, message: string) {
  // eslint-disable-next-line no-console
  console.log(`[hls ${sceneId.slice(0, 8)}] ${message}`);
}

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
  sceneId: string,
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
      // `veryfast` encodes ~10x faster than `slow` for roughly the same
      // bitrate ceiling — good enough for on-demand HLS where the user is
      // waiting on first-frame. Quality is still bounded by the CRF.
      `-preset:v:${index}`,
      "veryfast",
      `-profile:v:${index}`,
      "main",
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
    // EVENT means segments append to the playlist and ENDLIST is written
    // on completion — letting the player start mid-encode and re-poll the
    // playlist for new segments as ffmpeg writes them.
    "-hls_playlist_type",
    "event",
    "-hls_list_size",
    "0",
    "-hls_time",
    "6",
    "-hls_flags",
    "independent_segments+append_list",
    "-master_pl_name",
    "master.m3u8",
    "-var_stream_map",
    varStreamMap,
    "-hls_segment_filename",
    path.join(cacheDir, "%v", "segment_%03d.ts"),
    path.join(cacheDir, "%v", "index.m3u8")
  );

  log(sceneId, `ffmpeg start (${variantCount} renditions, preset=veryfast)`);
  await runProcess("ffmpeg", args);
  log(sceneId, "ffmpeg exit ok");
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

/**
 * Polls the cache dir until the master playlist and at least one segment
 * per variant exist — the moment the package becomes playable. Returns
 * false on timeout or when the abort flag flips.
 */
async function waitForPartialHlsPackage(
  cacheDir: string,
  renditions: HlsRendition[],
  isAborted: () => boolean,
  timeoutMs = 5 * 60 * 1000
): Promise<boolean> {
  const masterPath = path.join(cacheDir, "master.m3u8");
  const firstSegments = renditions.map((r) => path.join(cacheDir, r.name, "segment_000.ts"));

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isAborted()) return false;
    if (existsSync(masterPath) && firstSegments.every((p) => existsSync(p))) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
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
  if (existing && existing.state === "ready") {
    return { state: "ready", renditions: existing.renditions };
  }
  if (existing && existing.state === "pending") {
    return { state: "pending", renditions };
  }

  // Disk may have been populated by a previous process — probe cheaply.
  if (await isPackageFresh(cacheDir, sourcePath, renditions)) {
    trackerState.set(sceneId, { state: "ready", renditions, isEncodeActive: false });
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
 * tracker so concurrent requests coalesce to one ffmpeg invocation. The
 * tracker flips to `ready` as soon as master.m3u8 and the first segment of
 * each variant exist on disk — letting the player start playing while
 * ffmpeg continues writing later segments in the background.
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
  if (existing?.promise && existing.state === "ready" && existing.isEncodeActive) {
    return existing.promise;
  }

  const renditions = getHlsRenditions(sourceHeight);
  const cacheDir = getSceneCacheDir(sceneId);

  let watcherAborted = false;
  const markReadyEarly = () => {
    const current = trackerState.get(sceneId);
    if (!current || current.state === "error") return;
    if (current.state === "ready") return;
    trackerState.set(sceneId, {
      ...current,
      state: "ready",
      renditions,
      isEncodeActive: true,
    });
    log(sceneId, "partial package ready (master + first segments) — playback can start");
  };

  void (async () => {
    const found = await waitForPartialHlsPackage(cacheDir, renditions, () => watcherAborted);
    if (found) markReadyEarly();
  })();

  log(sceneId, "build kicked off");
  const promise = buildHlsPackage(sceneId, sourcePath, sourceHeight)
    .then((pkg) => {
      watcherAborted = true;
      trackerState.set(sceneId, {
        state: "ready",
        renditions: pkg.renditions,
        isEncodeActive: false,
      });
      log(sceneId, "encode complete, package fully ready");
      return pkg;
    })
    .catch((error: unknown) => {
      watcherAborted = true;
      const message = error instanceof Error ? error.message : String(error);
      const current = trackerState.get(sceneId);
      if (current?.state === "ready") {
        // Already playing from a partial package — keep serving what exists
        // but mark the encode as dead so the segment route can 404 instead
        // of 503 on missing files.
        trackerState.set(sceneId, { ...current, isEncodeActive: false });
        log(sceneId, `encode failed after partial ready: ${message}`);
      } else {
        trackerState.set(sceneId, {
          state: "error",
          renditions,
          isEncodeActive: false,
          error: message,
        });
        log(sceneId, `encode failed: ${message}`);
      }
      throw error;
    });

  trackerState.set(sceneId, {
    state: "pending",
    renditions,
    isEncodeActive: true,
    promise,
  });
  return promise;
}

/**
 * Legacy blocking call: awaits until the package is fully ready. Kept for
 * callers that really do need to wait. HTTP routes should prefer
 * getHlsStatus + 503 so clients can poll.
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

  if (existing?.state === "ready" && !existing.isEncodeActive) {
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
