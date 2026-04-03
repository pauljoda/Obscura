import path from "node:path";
import {
  probeVideoFile,
  runProcess,
  type ProbeVideoMetadata,
} from "@obscura/media-core";

export const MEDIA_SCENES_DIR = path.resolve(
  import.meta.dirname,
  "../../../../apps/web/public/media/scenes"
);

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

export { probeVideoFile, runProcess, type ProbeVideoMetadata };
