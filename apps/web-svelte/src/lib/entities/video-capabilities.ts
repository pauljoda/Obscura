import type { EntityCapability } from "$lib/api/generated/model";
import type { VideoPlayerMarker } from "$lib/components/VideoPlayer.svelte";
import { getCapability } from "$lib/api/capabilities";
import { v2ApiPath, v2AssetUrl } from "$lib/api/orval-fetch";
import type {
  SubtitleSource,
  SubtitleSourceFormat,
  VideoSubtitleTrack,
} from "$lib/player/subtitle-types";
import { CAPABILITY_KIND, ENTITY_FILE_ROLE } from "./v2-codes";

export interface VideoPlayerProps {
  src: string;
  directSrc: string;
  codec: string | null;
  poster: string;
  markers: VideoPlayerMarker[];
  duration: number;
  trickplaySprite: string;
  trickplayVtt: string;
  subtitleTracks: VideoSubtitleTrack[];
}

export function extractVideoPlayerProps(
  videoId: string,
  capabilities: EntityCapability[],
): VideoPlayerProps {
  const technical = getCapability(capabilities, CAPABILITY_KIND.technical);
  const images = getCapability(capabilities, CAPABILITY_KIND.images);
  const files = getCapability(capabilities, CAPABILITY_KIND.files);
  const markers = getCapability(capabilities, CAPABILITY_KIND.markers);
  const subtitles = getCapability(capabilities, CAPABILITY_KIND.subtitles);

  const trickplayFile = files?.items.find((f) => f.role === ENTITY_FILE_ROLE.trickplay);
  const trickplayVttUrl = trickplayFile ? v2AssetUrl(trickplayFile.path) : "";
  const spriteUrl = trickplayVttUrl
    ? v2AssetUrl(`/assets/videos/${videoId}/sprite.jpg`)
    : "";

  return {
    src: v2ApiPath(`/videos/${videoId}/hls/master.m3u8`),
    directSrc: v2ApiPath(`/videos/${videoId}/stream`),
    codec: technical?.codec ?? null,
    poster: v2AssetUrl(images?.thumbnailUrl) || "",
    markers: (markers?.items ?? []).map((m) => ({
      id: m.id,
      time: Number(m.seconds),
      title: m.title,
    })),
    duration: parseDotnetTimeSpan(technical?.duration),
    trickplaySprite: spriteUrl,
    trickplayVtt: trickplayVttUrl,
    subtitleTracks: (subtitles?.items ?? []).map((s) =>
      mapEntitySubtitle(videoId, s),
    ),
  };
}

function mapEntitySubtitle(
  videoId: string,
  sub: {
    id: string;
    language: string;
    label: string | null;
    format: string;
    source: string;
    storagePath: string;
    sourceFormat: string | null;
    sourcePath: string | null;
    isDefault: boolean;
  },
): VideoSubtitleTrack {
  const sourceFormat = parseSubtitleSourceFormat(sub.sourceFormat);
  const sourceUrl = isServedAssetPath(sub.sourcePath) ? v2AssetUrl(sub.sourcePath) : null;

  return {
    id: sub.id,
    videoId,
    language: sub.language,
    label: sub.label,
    format: "vtt",
    source: parseSubtitleSource(sub.source),
    sourceFormat,
    isDefault: sub.isDefault,
    url: v2AssetUrl(sub.storagePath),
    sourceUrl,
    createdAt: "",
  };
}

function parseSubtitleSource(value: string): SubtitleSource {
  switch (value) {
    case "manual":
    case "embedded":
    case "generated":
    case "provider":
    case "upload":
    case "sidecar":
      return value;
    default:
      return "manual";
  }
}

function parseSubtitleSourceFormat(
  value: string | null | undefined,
): SubtitleSourceFormat {
  switch (value) {
    case "srt":
    case "ass":
    case "ssa":
    case "vtt":
      return value;
    default:
      return "vtt";
  }
}

function isServedAssetPath(value: string | null | undefined): value is string {
  return value?.startsWith("/assets/") === true;
}

function parseDotnetTimeSpan(value: string | null | undefined): number {
  if (!value) return 0;
  const match = value.match(
    /^-?(?:(\d+)\.)?(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/,
  );
  if (!match) return 0;
  const days = match[1] ? parseInt(match[1], 10) : 0;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  const seconds = parseInt(match[4], 10);
  const frac = match[5] ? parseFloat(`0.${match[5]}`) : 0;
  return days * 86400 + hours * 3600 + minutes * 60 + seconds + frac;
}

export function getCounterValue(
  capabilities: EntityCapability[],
  code: string,
): number {
  const counters = getCapability(capabilities, CAPABILITY_KIND.counters);
  const counter = counters?.items.find((c) => c.code === code);
  return counter ? Number(counter.value) : 0;
}

export interface PlaybackState {
  playCount: number;
  playDurationSeconds: number;
  resumeSeconds: number;
  lastPlayedAt: string | null;
  completedAt: string | null;
}

export function getPlaybackState(
  capabilities: EntityCapability[],
): PlaybackState | null {
  const cap = getCapability(capabilities, CAPABILITY_KIND.progress);
  if (!cap) return null;
  const resumeSeconds = cap.unit === "seconds" ? Number(cap.index) : 0;
  return {
    playCount: 0,
    playDurationSeconds: 0,
    resumeSeconds: Number.isFinite(resumeSeconds) ? resumeSeconds : 0,
    lastPlayedAt: cap.updatedAt,
    completedAt: cap.completedAt ?? null,
  };
}
