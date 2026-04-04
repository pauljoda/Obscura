import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCacheRootDir } from "@obscura/media-core";
import { getHlsRenditions, runProcess, type HlsRendition } from "./media";

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

const HLS_CACHE_DIR = path.join(getCacheRootDir(), "hls");

const generationLocks = new Map<string, Promise<HlsPackage>>();

function getSceneCacheDir(sceneId: string) {
  return path.join(HLS_CACHE_DIR, sceneId);
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

export async function ensureHlsPackage(
  sceneId: string,
  sourcePath: string,
  sourceHeight: number | null
) {
  const existing = generationLocks.get(sceneId);
  if (existing) {
    return existing;
  }

  const pending = buildHlsPackage(sceneId, sourcePath, sourceHeight).finally(() => {
    generationLocks.delete(sceneId);
  });

  generationLocks.set(sceneId, pending);
  return pending;
}
