import { spawn } from "node:child_process";
import path from "node:path";

export const MEDIA_SCENES_DIR = path.resolve(
  import.meta.dirname,
  "../../../../apps/web/public/media/scenes"
);

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

export interface HlsRendition {
  name: string;
  label: string;
  height: number;
  videoBitrate: string;
  maxRate: string;
  bufferSize: string;
  audioBitrate: string;
  crf: number;
}

const HLS_RENDITION_PRESETS: HlsRendition[] = [
  {
    name: "1080p",
    label: "1080p",
    height: 1080,
    videoBitrate: "5200k",
    maxRate: "5600k",
    bufferSize: "10400k",
    audioBitrate: "160k",
    crf: 18,
  },
  {
    name: "720p",
    label: "720p",
    height: 720,
    videoBitrate: "2800k",
    maxRate: "3200k",
    bufferSize: "5600k",
    audioBitrate: "160k",
    crf: 19,
  },
  {
    name: "480p",
    label: "480p",
    height: 480,
    videoBitrate: "1400k",
    maxRate: "1600k",
    bufferSize: "2800k",
    audioBitrate: "128k",
    crf: 20,
  },
  {
    name: "360p",
    label: "360p",
    height: 360,
    videoBitrate: "850k",
    maxRate: "950k",
    bufferSize: "1700k",
    audioBitrate: "128k",
    crf: 21,
  },
  {
    name: "240p",
    label: "240p",
    height: 240,
    videoBitrate: "450k",
    maxRate: "520k",
    bufferSize: "900k",
    audioBitrate: "96k",
    crf: 22,
  },
  {
    name: "180p",
    label: "180p",
    height: 180,
    videoBitrate: "320k",
    maxRate: "360k",
    bufferSize: "640k",
    audioBitrate: "96k",
    crf: 23,
  },
];

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

export function getHlsRenditions(sourceHeight: number | null): HlsRendition[] {
  const height = sourceHeight ?? 720;
  const renditions = HLS_RENDITION_PRESETS.filter((preset) => preset.height <= height);

  if (renditions.length > 0) {
    return renditions;
  }

  return [
    {
      name: `${height}p`,
      label: `${height}p`,
      height,
      videoBitrate: "320k",
      maxRate: "360k",
      bufferSize: "640k",
      audioBitrate: "96k",
      crf: 23,
    },
  ];
}
