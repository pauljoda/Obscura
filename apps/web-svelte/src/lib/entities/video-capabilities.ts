import type { VideoSubtitleTrackDto, SubtitleSourceFormat } from "@obscura/contracts";
import type { EntityCapability } from "$lib/api/generated/model";
import type { VideoPlayerMarker } from "$lib/components/VideoPlayer.svelte";
import { getCapability } from "$lib/api/capabilities";
import { v2ApiPath, v2AssetUrl } from "$lib/api/orval-fetch";

export interface VideoPlayerProps {
  src: string;
  directSrc: string;
  codec: string | null;
  poster: string;
  markers: VideoPlayerMarker[];
  duration: number;
  trickplaySprite: string;
  trickplayVtt: string;
  subtitleTracks: VideoSubtitleTrackDto[];
}

export function extractVideoPlayerProps(
  videoId: string,
  capabilities: EntityCapability[],
): VideoPlayerProps {
  const technical = getCapability(capabilities, "technical");
  const images = getCapability(capabilities, "images");
  const files = getCapability(capabilities, "files");
  const markers = getCapability(capabilities, "markers");
  const subtitles = getCapability(capabilities, "subtitles");

  const trickplayFile = files?.items.find((f) => f.role === "trickplay");
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
): VideoSubtitleTrackDto {
  const sourceFormat = (sub.sourceFormat ?? "vtt") as SubtitleSourceFormat;
  const hasAssSource = sourceFormat === "ass" || sourceFormat === "ssa";
  const sourceUrl = hasAssSource
    ? deriveAssSourceUrl(sub.storagePath, sourceFormat)
    : null;

  return {
    id: sub.id,
    videoId,
    language: sub.language,
    label: sub.label,
    format: "vtt",
    source: sub.source as "embedded" | "sidecar" | "upload",
    sourceFormat,
    isDefault: sub.isDefault,
    url: v2AssetUrl(sub.storagePath),
    sourceUrl,
    createdAt: "",
  };
}

function deriveAssSourceUrl(
  vttPath: string,
  sourceFormat: string,
): string | null {
  const assPath = vttPath.replace(/\.vtt$/, `.${sourceFormat}`);
  return assPath !== vttPath ? v2AssetUrl(assPath) : null;
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
  const counters = getCapability(capabilities, "counters");
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
  const cap = capabilities.find((c) => c.kind === "playback") as
    | (EntityCapability & {
        playCount?: number;
        playDurationSeconds?: number;
        resumeSeconds?: number;
        lastPlayedAt?: string | null;
        completedAt?: string | null;
      })
    | undefined;
  if (!cap) return null;
  return {
    playCount: cap.playCount ?? 0,
    playDurationSeconds: cap.playDurationSeconds ?? 0,
    resumeSeconds: cap.resumeSeconds ?? 0,
    lastPlayedAt: cap.lastPlayedAt ?? null,
    completedAt: cap.completedAt ?? null,
  };
}
