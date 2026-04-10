import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat, open, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import AdmZip from "adm-zip";

export const supportedFingerprintKinds = [
  "md5",
  "oshash",
  "image-phash",
  "video-phash",
] as const;

export type FingerprintKind = (typeof supportedFingerprintKinds)[number];

export interface LibraryRoot {
  id: string;
  path: string;
  enabled: boolean;
}

export const supportedVideoExtensions = new Set([
  ".mp4",
  ".m4v",
  ".mkv",
  ".mov",
  ".webm",
  ".avi",
  ".wmv",
  ".flv",
  ".ts",
  ".m2ts",
  ".mpg",
  ".mpeg",
]);

interface FfprobeStream {
  codec_name?: string;
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
}

interface FfprobeFormat {
  duration?: string;
  size?: string;
  bit_rate?: string;
  format_name?: string;
}

interface FfprobeResult {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
}

export interface ProbeAudioMetadata {
  codec: string | null;
  sampleRate: number | null;
  channels: number | null;
}

export interface ProbeVideoMetadata {
  filePath: string;
  fileName: string;
  duration: number | null;
  fileSize: number | null;
  bitRate: number | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  codec: string | null;
  container: string | null;
  audio: ProbeAudioMetadata | null;
}

/**
 * Filename patterns that mark generated/preview files we should skip during scan.
 * Matches stems ending with separators followed by these words, e.g.:
 *   scene.preview.mp4, scene-preview.mp4, scene_preview.mp4
 */
const generatedSuffixPattern = /[-._](preview|thumb|sprite|sample)$/i;

export function isVideoFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (!supportedVideoExtensions.has(ext)) return false;

  // Skip generated preview/thumbnail/sample files
  const stem = path.basename(filePath, ext);
  return !generatedSuffixPattern.test(stem);
}

/** Common HTML entities that appear in filenames downloaded from websites. */
const htmlEntities: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&#39;": "'", "&apos;": "'", "&#x27;": "'", "&#x2F;": "/",
  "&nbsp;": " ",
};
const htmlEntityPattern = new RegExp(Object.keys(htmlEntities).join("|"), "gi");

export function fileNameToTitle(filePath: string) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(htmlEntityPattern, (match) => htmlEntities[match.toLowerCase()] ?? match);
}

export async function runProcess(
  command: string,
  args: string[],
  options?: { cwd?: string }
) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `${command} exited with code ${code ?? "unknown"}${
            stderr ? `: ${stderr.trim()}` : ""
          }`
        )
      );
    });
  });
}

export function parseFrameRate(value?: string): number | null {
  if (!value) return null;
  const [numerator, denominator] = value.split("/").map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return Number((numerator / denominator).toFixed(3));
}

export async function probeVideoFile(filePath: string): Promise<ProbeVideoMetadata> {
  const { stdout } = await runProcess("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size,bit_rate,format_name:stream=index,codec_type,codec_name,width,height,avg_frame_rate,sample_rate,channels",
    "-of",
    "json",
    filePath,
  ]);

  const parsed = JSON.parse(stdout) as FfprobeResult;
  const videoStream = parsed.streams?.find((stream) => stream.codec_type === "video");
  const audioStream = parsed.streams?.find((stream) => stream.codec_type === "audio");
  const formatName = parsed.format?.format_name?.split(",")[0] ?? null;
  const extContainer = path.extname(filePath).replace(".", "");
  const container = formatName ?? (extContainer || null);

  return {
    filePath,
    fileName: path.basename(filePath),
    duration: parsed.format?.duration ? Number(parsed.format.duration) : null,
    fileSize: parsed.format?.size ? Number(parsed.format.size) : null,
    bitRate: parsed.format?.bit_rate ? Number(parsed.format.bit_rate) : null,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    frameRate: parseFrameRate(videoStream?.avg_frame_rate),
    codec: videoStream?.codec_name ?? null,
    container,
    audio: audioStream
      ? {
          codec: audioStream.codec_name ?? null,
          sampleRate: audioStream.sample_rate ? Number(audioStream.sample_rate) : null,
          channels: audioStream.channels ?? null,
        }
      : null,
  };
}

export async function discoverVideoFiles(rootPath: string, recursive = true): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    // Skip hidden files/directories (unix-style dot-prefixed: .thumbs, .git, etc.)
    if (entry.name.startsWith(".")) continue;

    const entryPath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      if (recursive) {
        files.push(...(await discoverVideoFiles(entryPath, recursive)));
      }
      continue;
    }

    if (!entry.isFile() || !isVideoFile(entryPath)) {
      continue;
    }

    files.push(entryPath);
  }

  return files.sort((left, right) => left.localeCompare(right));
}

export async function computeMd5(filePath: string) {
  const hash = createHash("md5");

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });

  return hash.digest("hex");
}

function readUInt64LE(buffer: Buffer, offset: number) {
  return buffer.readBigUInt64LE(offset);
}

export async function computeOsHash(filePath: string) {
  const stats = await stat(filePath);
  const chunkSize = 64 * 1024;
  const handle = await open(filePath, "r");

  try {
    const head = Buffer.alloc(chunkSize);
    const tail = Buffer.alloc(chunkSize);

    await handle.read(head, 0, chunkSize, 0);
    await handle.read(tail, 0, chunkSize, Math.max(0, stats.size - chunkSize));

    let hash = BigInt(stats.size);

    for (let index = 0; index < chunkSize; index += 8) {
      hash += readUInt64LE(head, index);
      hash += readUInt64LE(tail, index);
    }

    return (hash & BigInt("0xFFFFFFFFFFFFFFFF")).toString(16).padStart(16, "0");
  } finally {
    await handle.close();
  }
}

function findWorkspaceRoot(startDir: string) {
  let current = path.resolve(startDir);

  while (true) {
    if (
      existsSync(path.join(current, "pnpm-workspace.yaml")) ||
      existsSync(path.join(current, ".git"))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

export function getCacheRootDir() {
  if (process.env.OBSCURA_CACHE_DIR) {
    return path.resolve(process.env.OBSCURA_CACHE_DIR);
  }

  const workspaceRoot = findWorkspaceRoot(process.cwd());
  if (!workspaceRoot) {
    return path.resolve(process.cwd(), ".obscura-cache");
  }

  const sharedCache = path.join(workspaceRoot, ".obscura-cache");
  const legacyWorkerCache = path.join(workspaceRoot, "apps", "worker", ".obscura-cache");
  const legacyApiCache = path.join(workspaceRoot, "apps", "api", ".obscura-cache");

  if (existsSync(sharedCache)) {
    return sharedCache;
  }

  if (existsSync(legacyWorkerCache)) {
    return legacyWorkerCache;
  }

  if (existsSync(legacyApiCache)) {
    return legacyApiCache;
  }

  return sharedCache;
}

export function getGeneratedSceneDir(sceneId: string) {
  return path.join(getCacheRootDir(), "scenes", sceneId);
}

export function getGeneratedPerformerDir(performerId: string) {
  return path.join(getCacheRootDir(), "performers", performerId);
}

export function getGeneratedStudioDir(studioId: string) {
  return path.join(getCacheRootDir(), "studios", studioId);
}

export function getGeneratedTagDir(tagId: string) {
  return path.join(getCacheRootDir(), "tags", tagId);
}

/**
 * Get sidecar file paths for a video file.
 * E.g. `/media/video.mp4` → `/media/video-thumb.jpg`
 */
export function getSidecarPaths(videoFilePath: string) {
  const dir = path.dirname(videoFilePath);
  const stem = path.basename(videoFilePath, path.extname(videoFilePath));

  return {
    thumbnail: path.join(dir, `${stem}-thumb.jpg`),
    cardThumbnail: path.join(dir, `${stem}-card.jpg`),
    preview: path.join(dir, `${stem}-preview.mp4`),
    sprite: path.join(dir, `${stem}-sprite.jpg`),
    trickplayVtt: path.join(dir, `${stem}-trickplay.vtt`),
    nfo: path.join(dir, `${stem}.nfo`),
  };
}

/** Filenames under `getGeneratedSceneDir(sceneId)` for scene video derivatives (matches API asset legacy names). */
export const SCENE_VIDEO_GENERATED_FILENAMES = {
  thumb: "thumbnail.jpg",
  card: "card.jpg",
  sprite: "sprite.jpg",
  preview: "preview.mp4",
  trickplay: "trickplay.vtt",
} as const;

export type SceneVideoGeneratedLayout = "dedicated" | "sidecar";

export interface SceneVideoGeneratedDiskPaths {
  thumb: string;
  card: string;
  preview: string;
  sprite: string;
  trickplay: string;
}

export function sceneVideoGeneratedLayoutFromDedicated(dedicated: boolean): SceneVideoGeneratedLayout {
  return dedicated ? "dedicated" : "sidecar";
}

/**
 * Absolute disk paths for generated scene video assets (thumb, card, preview, sprite, trickplay VTT).
 * Dedicated layout uses `OBSCURA_CACHE_DIR/scenes/<sceneId>/`; sidecar uses names next to the video file.
 */
export function getSceneVideoGeneratedDiskPaths(
  sceneId: string,
  videoFilePath: string,
  layout: SceneVideoGeneratedLayout
): SceneVideoGeneratedDiskPaths {
  if (layout === "dedicated") {
    const base = getGeneratedSceneDir(sceneId);
    return {
      thumb: path.join(base, SCENE_VIDEO_GENERATED_FILENAMES.thumb),
      card: path.join(base, SCENE_VIDEO_GENERATED_FILENAMES.card),
      preview: path.join(base, SCENE_VIDEO_GENERATED_FILENAMES.preview),
      sprite: path.join(base, SCENE_VIDEO_GENERATED_FILENAMES.sprite),
      trickplay: path.join(base, SCENE_VIDEO_GENERATED_FILENAMES.trickplay),
    };
  }

  const sidecar = getSidecarPaths(videoFilePath);
  return {
    thumb: sidecar.thumbnail,
    card: sidecar.cardThumbnail,
    preview: sidecar.preview,
    sprite: sidecar.sprite,
    trickplay: sidecar.trickplayVtt,
  };
}

/** Every absolute path where scene video derivatives may exist (both layouts). */
export function allSceneVideoGeneratedDiskPaths(sceneId: string, videoFilePath: string): string[] {
  const dedicated = getSceneVideoGeneratedDiskPaths(sceneId, videoFilePath, "dedicated");
  const sidecar = getSceneVideoGeneratedDiskPaths(sceneId, videoFilePath, "sidecar");
  return [...new Set([...Object.values(dedicated), ...Object.values(sidecar)])];
}

// ─── NFO metadata ──────────────────────────────────────────────────

export interface NfoMetadata {
  title?: string;
  plot?: string;
  aired?: string;
  studio?: string;
  rating?: number;
  genres?: string[];
  tags?: string[];
  runtime?: number;
  duration?: string;
  url?: string;
}

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Decode standard XML entities that appear in NFO sidecar files. */
function decodeXmlEntities(value: string): string {
  return value
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&amp;/gi, "&"); // must be last
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? decodeXmlEntities(match[1].trim()) : null;
}

function extractAllTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

/**
 * Normalize a raw NFO rating to the 0-100 scale used by the database.
 * Common NFO scales: 0-5 (stars), 0-10 (decimal), 0-100 (percentage).
 * Values above 100 are treated as vote counts and ignored.
 */
export function normalizeNfoRating(raw: number): number | null {
  if (!Number.isFinite(raw) || raw < 0) return null;
  if (raw > 100) return null; // likely a vote count, not a rating
  if (raw <= 5) return Math.round(raw * 20);
  if (raw <= 10) return Math.round(raw * 10);
  return Math.round(raw);
}

export async function readNfo(videoFilePath: string): Promise<NfoMetadata | null> {
  const nfoPath = getSidecarPaths(videoFilePath).nfo;

  if (!existsSync(nfoPath)) {
    return null;
  }

  try {
    const xml = await readFile(nfoPath, "utf8");

    const runtimeStr = extractTag(xml, "runtime");
    const ratingStr = extractTag(xml, "rating");

    return {
      title: extractTag(xml, "title") ?? undefined,
      plot: extractTag(xml, "plot") ?? undefined,
      aired: extractTag(xml, "aired") ?? undefined,
      studio: extractTag(xml, "studio") ?? undefined,
      rating: ratingStr ? Number(ratingStr) : undefined,
      genres: extractAllTags(xml, "genre"),
      tags: extractAllTags(xml, "tag"),
      runtime: runtimeStr ? Number(runtimeStr) : undefined,
      duration: extractTag(xml, "duration") ?? undefined,
      url: extractTag(xml, "url") ?? undefined,
    };
  } catch {
    return null;
  }
}

function formatDurationHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export interface NfoWriteData {
  title: string;
  plot?: string | null;
  date?: string | null;
  studio?: string | null;
  rating?: number | null;
  genres?: string[];
  tags?: string[];
  duration?: number | null;
  url?: string | null;
}

export async function writeNfo(videoFilePath: string, data: NfoWriteData): Promise<void> {
  const nfoPath = getSidecarPaths(videoFilePath).nfo;

  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<episodedetails>`,
    `  <title>${xmlEscape(data.title)}</title>`,
  ];

  const add = (tag: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== "") {
      lines.push(`  <${tag}>${xmlEscape(String(value))}</${tag}>`);
    }
  };

  add("plot", data.plot);
  add("url", data.url);
  add("aired", data.date);
  add("studio", data.studio);

  if (data.rating != null) {
    add("rating", data.rating);
  }

  if (typeof data.duration === "number" && data.duration > 0) {
    add("runtime", Math.round(data.duration / 60));
    add("duration", formatDurationHMS(data.duration));
  }

  if (data.genres) {
    for (const genre of data.genres) {
      add("genre", genre);
    }
  }

  if (data.tags) {
    for (const tag of data.tags) {
      add("tag", tag);
    }
  }

  lines.push(`</episodedetails>`);

  await writeFile(nfoPath, lines.join("\n") + "\n", "utf8");
}

// ─── Image discovery ──────────────────────────────────────────────

export const supportedImageExtensions = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".heic", ".bmp", ".tiff", ".tif",
]);

/** Video/animated formats that can appear as gallery items (animated images, short clips). */
export const supportedAnimatedExtensions = new Set([
  ".webm", ".mp4", ".m4v", ".mkv", ".mov", ".avi", ".wmv", ".flv",
]);

/** All extensions eligible for gallery discovery (static images + animated). */
export const supportedGalleryMediaExtensions = new Set([
  ...supportedImageExtensions,
  ...supportedAnimatedExtensions,
]);

export const supportedZipExtensions = new Set([
  ".zip", ".cbz", ".cbr",
]);

export function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (!supportedGalleryMediaExtensions.has(ext)) return false;

  // Skip generated preview/thumbnail/sample files
  const stem = path.basename(filePath, ext);
  return !generatedSuffixPattern.test(stem);
}

/** Check if a gallery media file is an animated/video format rather than a static image. */
export function isAnimatedFormat(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return supportedAnimatedExtensions.has(ext) || ext === ".gif";
}

export interface ImageDiscoveryResult {
  /** Directories containing at least one image file directly */
  dirs: string[];
  /** All image files found (absolute paths) */
  imageFiles: string[];
  /** All zip/cbz/cbr files found (absolute paths) */
  zipFiles: string[];
}

export async function discoverImageFilesAndDirs(
  rootPath: string,
  recursive = true
): Promise<ImageDiscoveryResult> {
  const dirs: Set<string> = new Set();
  const imageFiles: string[] = [];
  const zipFiles: string[] = [];

  async function walk(dirPath: string) {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files/directories (unix-style dot-prefixed: .thumbs, .git, etc.)
      if (entry.name.startsWith(".")) continue;

      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (recursive) {
          await walk(entryPath);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();

      if (supportedZipExtensions.has(ext)) {
        zipFiles.push(entryPath);
        continue;
      }

      if (isImageFile(entryPath)) {
        imageFiles.push(entryPath);
        dirs.add(dirPath);
      }
    }
  }

  await walk(rootPath);

  return {
    dirs: [...dirs].sort(),
    imageFiles: imageFiles.sort(),
    zipFiles: zipFiles.sort(),
  };
}

export function getGeneratedImageDir(imageId: string) {
  return path.join(getCacheRootDir(), "images", imageId);
}

/**
 * Parse a zip/cbz/cbr file and return sorted member paths for image entries.
 */
export function parseZipImageMembers(zipPath: string): string[] {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  return entries
    .filter((entry) => {
      if (entry.isDirectory) return false;
      const ext = path.extname(entry.entryName).toLowerCase();
      return supportedImageExtensions.has(ext);
    })
    .map((entry) => entry.entryName)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Extract a single member from a zip file as a Buffer.
 */
export function extractZipMember(zipPath: string, memberPath: string): Buffer | null {
  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry(memberPath);
  if (!entry) return null;
  return entry.getData();
}

/**
 * Probe an image file to extract width, height, and format using ffprobe.
 */
export async function probeImageFile(filePath: string): Promise<{
  width: number | null;
  height: number | null;
  format: string | null;
}> {
  try {
    const { stdout } = await runProcess("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height,codec_name",
      "-of", "json",
      filePath,
    ]);

    const parsed = JSON.parse(stdout) as { streams?: Array<{ width?: number; height?: number; codec_name?: string }> };
    const stream = parsed.streams?.[0];

    return {
      width: stream?.width ?? null,
      height: stream?.height ?? null,
      format: stream?.codec_name ?? null,
    };
  } catch {
    return { width: null, height: null, format: null };
  }
}

// ─── Audio discovery ──────────────────────────────────────────────

export const supportedAudioExtensions = new Set([
  ".mp3", ".flac", ".wav", ".ogg", ".aac", ".m4a", ".wma", ".opus",
  ".aiff", ".aif", ".alac", ".ape", ".dsf", ".dff", ".wv",
]);

export function isAudioFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (!supportedAudioExtensions.has(ext)) return false;
  const stem = path.basename(filePath, ext);
  return !generatedSuffixPattern.test(stem);
}

export interface AudioDiscoveryResult {
  /** Directories containing at least one audio file directly */
  dirs: string[];
  /** All audio files found (absolute paths) */
  audioFiles: string[];
}

export async function discoverAudioFilesAndDirs(
  rootPath: string,
  recursive = true,
): Promise<AudioDiscoveryResult> {
  const dirs: Set<string> = new Set();
  const audioFiles: string[] = [];

  async function walk(dirPath: string) {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (recursive) {
          await walk(entryPath);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      if (isAudioFile(entryPath)) {
        audioFiles.push(entryPath);
        dirs.add(dirPath);
      }
    }
  }

  await walk(rootPath);

  return {
    dirs: [...dirs].sort(),
    audioFiles: audioFiles.sort(),
  };
}

// ─── Audio probing ────────────────────────────────────────────────

interface FfprobeFormatTags {
  artist?: string;
  album?: string;
  title?: string;
  track?: string;
  ARTIST?: string;
  ALBUM?: string;
  TITLE?: string;
  TRACK?: string;
}

interface FfprobeAudioResult {
  streams?: FfprobeStream[];
  format?: FfprobeFormat & { tags?: FfprobeFormatTags };
}

export interface ProbeAudioFileMetadata {
  filePath: string;
  fileName: string;
  duration: number | null;
  fileSize: number | null;
  bitRate: number | null;
  sampleRate: number | null;
  channels: number | null;
  codec: string | null;
  container: string | null;
  embeddedArtist: string | null;
  embeddedAlbum: string | null;
  embeddedTitle: string | null;
  trackNumber: number | null;
}

export async function probeAudioFile(filePath: string): Promise<ProbeAudioFileMetadata> {
  const { stdout } = await runProcess("ffprobe", [
    "-v", "error",
    "-show_entries",
    "format=duration,size,bit_rate,format_name:format_tags=artist,album,title,track:stream=codec_name,sample_rate,channels",
    "-of", "json",
    filePath,
  ]);

  const parsed = JSON.parse(stdout) as FfprobeAudioResult;
  const audioStream = parsed.streams?.find((s) => s.codec_name);
  const tags = parsed.format?.tags;
  const formatName = parsed.format?.format_name?.split(",")[0] ?? null;
  const extContainer = path.extname(filePath).replace(".", "").toLowerCase();

  // Tags can be capitalized or lowercase depending on format
  const artist = tags?.artist ?? tags?.ARTIST ?? null;
  const album = tags?.album ?? tags?.ALBUM ?? null;
  const title = tags?.title ?? tags?.TITLE ?? null;
  const trackStr = tags?.track ?? tags?.TRACK ?? null;
  const trackNumber = trackStr ? parseInt(trackStr, 10) : null;

  return {
    filePath,
    fileName: path.basename(filePath),
    duration: parsed.format?.duration ? Number(parsed.format.duration) : null,
    fileSize: parsed.format?.size ? Number(parsed.format.size) : null,
    bitRate: parsed.format?.bit_rate ? Number(parsed.format.bit_rate) : null,
    sampleRate: audioStream?.sample_rate ? Number(audioStream.sample_rate) : null,
    channels: audioStream?.channels ?? null,
    codec: audioStream?.codec_name ?? null,
    container: formatName ?? (extContainer || null),
    embeddedArtist: artist || null,
    embeddedAlbum: album || null,
    embeddedTitle: title || null,
    trackNumber: Number.isFinite(trackNumber) ? trackNumber : null,
  };
}

// ─── Audio waveform generation ────────────────────────────────────

/** Formats natively supported by the audiowaveform binary. */
const audiowaveformNativeFormats = new Set([".mp3", ".wav", ".flac", ".ogg", ".opus"]);

/** Check whether a binary exists on the system PATH. */
async function hasBinary(name: string): Promise<boolean> {
  try {
    await runProcess("which", [name]);
    return true;
  } catch {
    return false;
  }
}

/**
 * ffmpeg-only fallback: decode audio to raw PCM, compute peaks in Node.
 * Produces the same JSON format as audiowaveform: `{ data: number[] }`.
 */
async function generateWaveformWithFfmpeg(
  inputPath: string,
  outputPath: string,
  pixelsPerSecond: number,
): Promise<void> {
  // Get duration first
  const probeResult = await runProcess("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "json",
    inputPath,
  ]);
  const probeParsed = JSON.parse(probeResult.stdout) as { format?: { duration?: string } };
  const duration = Number(probeParsed.format?.duration ?? 0);
  if (duration <= 0) {
    await writeFile(outputPath, JSON.stringify({ data: [] }), "utf8");
    return;
  }

  const totalSamples = Math.ceil(duration * pixelsPerSecond);
  const sampleRate = 8000; // low rate is fine for peaks
  const totalPcmSamples = Math.ceil(duration * sampleRate);
  const samplesPerBucket = Math.max(1, Math.floor(totalPcmSamples / totalSamples));

  // Decode to raw 16-bit signed LE mono PCM
  const pcmResult = await new Promise<Buffer>((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", inputPath,
      "-f", "s16le", "-ac", "1", "-ar", String(sampleRate),
      "pipe:1",
    ], { stdio: ["ignore", "pipe", "ignore"] });

    const chunks: Buffer[] = [];
    ffmpeg.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg waveform decode exited with code ${code}`));
    });
    ffmpeg.on("error", reject);
  });

  // Compute min/max peaks per bucket
  const data: number[] = [];
  const sampleCount = Math.floor(pcmResult.length / 2); // 16-bit = 2 bytes per sample

  for (let bucket = 0; bucket < totalSamples; bucket++) {
    const startSample = bucket * samplesPerBucket;
    const endSample = Math.min(startSample + samplesPerBucket, sampleCount);
    let min = 0;
    let max = 0;

    for (let i = startSample; i < endSample; i++) {
      const sample = pcmResult.readInt16LE(i * 2);
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    data.push(min, max);
  }

  await writeFile(outputPath, JSON.stringify({ data }), "utf8");
}

/**
 * Generate waveform peaks JSON for audio playback visualization.
 *
 * Prefers BBC audiowaveform if installed; falls back to pure ffmpeg + Node
 * PCM peak computation when the binary is not available (e.g. local dev).
 *
 * Output: JSON file with `{ data: number[] }` — array of min/max amplitude pairs.
 */
export async function generateAudioWaveform(
  inputPath: string,
  outputPath: string,
  pixelsPerSecond = 20,
): Promise<void> {
  const useAudiowaveform = await hasBinary("audiowaveform");

  if (!useAudiowaveform) {
    // Fallback: ffmpeg + Node PCM peak computation
    await generateWaveformWithFfmpeg(inputPath, outputPath, pixelsPerSecond);
    return;
  }

  const ext = path.extname(inputPath).toLowerCase();

  if (audiowaveformNativeFormats.has(ext)) {
    await runProcess("audiowaveform", [
      "-i", inputPath,
      "--pixels-per-second", String(pixelsPerSecond),
      "-b", "8",
      "-o", outputPath,
    ]);
  } else {
    // Pipe through ffmpeg for unsupported formats
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath, "-f", "wav", "-ac", "1", "-ar", "16000", "pipe:1",
      ], { stdio: ["ignore", "pipe", "ignore"] });

      const aw = spawn("audiowaveform", [
        "--input-format", "wav",
        "--pixels-per-second", String(pixelsPerSecond),
        "-b", "8",
        "-o", outputPath,
      ], { stdio: ["pipe", "ignore", "pipe"] });

      ffmpeg.stdout.pipe(aw.stdin);

      let awStderr = "";
      aw.stderr.on("data", (chunk) => { awStderr += chunk.toString(); });

      aw.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`audiowaveform exited with code ${code}: ${awStderr}`));
      });

      ffmpeg.on("error", reject);
      aw.on("error", reject);
    });
  }
}

// ─── Audio cache directories ──────────────────────────────────────

export function getGeneratedAudioLibraryDir(libraryId: string) {
  return path.join(getCacheRootDir(), "audio-libraries", libraryId);
}

export function getGeneratedAudioTrackDir(trackId: string) {
  return path.join(getCacheRootDir(), "audio-tracks", trackId);
}
