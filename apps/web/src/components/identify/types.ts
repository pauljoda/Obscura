/**
 * Extended type definitions for the universal identification system.
 * Complements the existing scrape/types.ts with new entity tabs.
 */

import type {
  SceneFolderListItemDto,
  GalleryListItemDto,
  ImageListItemDto,
  AudioLibraryListItemDto,
  AudioTrackListItemDto,
} from "@obscura/contracts";

// ─── Tab type ──────────────────────────────────────────────────────

export type IdentifyTab =
  | "scenes"
  | "video-folders"
  | "galleries"
  | "images"
  | "audio-libraries"
  | "audio-tracks"
  | "performers"
  | "studios"
  | "tags"
  | "phashes";

// ─── Field definitions per entity type ─────────────────────────────

export const VIDEO_FOLDER_FIELDS = [
  "title",
  "date",
  "details",
  "url",
  "studio",
  "image",
  "seasonNumber",
] as const;
export type VideoFolderField = (typeof VIDEO_FOLDER_FIELDS)[number];

export const GALLERY_FIELDS = [
  "title",
  "date",
  "details",
  "url",
  "studio",
  "performers",
  "tags",
  "image",
] as const;
export type GalleryField = (typeof GALLERY_FIELDS)[number];

export const IMAGE_FIELDS = [
  "title",
  "date",
  "details",
  "url",
  "tags",
] as const;
export type ImageField = (typeof IMAGE_FIELDS)[number];

export const AUDIO_LIBRARY_FIELDS = [
  "title",
  "date",
  "details",
  "url",
  "studio",
  "performers",
  "image",
] as const;
export type AudioLibraryField = (typeof AUDIO_LIBRARY_FIELDS)[number];

export const AUDIO_TRACK_FIELDS = [
  "title",
  "date",
  "details",
  "url",
  "performers",
  "tags",
  "trackNumber",
] as const;
export type AudioTrackField = (typeof AUDIO_TRACK_FIELDS)[number];

// ─── Row status ────────────────────────────────────────────────────

export type RowStatus =
  | "pending"
  | "scraping"
  | "found"
  | "no-result"
  | "error"
  | "accepted"
  | "rejected";

// ─── Row types per entity ──────────────────────────────────────────

export interface VideoFolderRow {
  folder: SceneFolderListItemDto;
  status: RowStatus;
  result?: NormalizedFolderIdentifyResult;
  /** The scrape_result DB row ID, used for accept/reject */
  scrapeResultId?: string;
  error?: string;
  matchedProvider?: string;
  selectedFields: Set<VideoFolderField>;
  wizardStep: "idle" | "picking-series" | "mapping-episodes" | "confirmed";
  seriesCandidates?: SeriesCandidate[];
  selectedSeriesId?: string;
  episodeMappings?: UIEpisodeMapping[];
}

export interface GalleryRow {
  gallery: GalleryListItemDto;
  status: RowStatus;
  result?: NormalizedGalleryIdentifyResult;
  error?: string;
  matchedProvider?: string;
  selectedFields: Set<GalleryField>;
}

export interface ImageRow {
  image: ImageListItemDto;
  status: RowStatus;
  result?: NormalizedImageIdentifyResult;
  error?: string;
  matchedProvider?: string;
  selectedFields: Set<ImageField>;
}

export interface AudioLibraryRow {
  library: AudioLibraryListItemDto;
  status: RowStatus;
  result?: NormalizedAudioLibraryIdentifyResult;
  error?: string;
  matchedProvider?: string;
  selectedFields: Set<AudioLibraryField>;
}

export interface AudioTrackRow {
  track: AudioTrackListItemDto;
  status: RowStatus;
  result?: NormalizedAudioTrackIdentifyResult;
  error?: string;
  matchedProvider?: string;
  selectedFields: Set<AudioTrackField>;
}

// ─── Normalized result types (from plugins) ────────────────────────

export interface NormalizedFolderIdentifyResult {
  name: string | null;
  details: string | null;
  date: string | null;
  imageUrl: string | null;
  backdropUrl: string | null;
  studioName: string | null;
  tagNames: string[];
  urls: string[];
  seriesExternalId?: string;
  seasonNumber?: number;
  totalEpisodes?: number;
}

export interface NormalizedGalleryIdentifyResult {
  title: string | null;
  date: string | null;
  details: string | null;
  urls: string[];
  studioName: string | null;
  performerNames: string[];
  tagNames: string[];
  imageUrl: string | null;
}

export interface NormalizedImageIdentifyResult {
  title: string | null;
  date: string | null;
  details: string | null;
  urls: string[];
  tagNames: string[];
}

export interface NormalizedAudioLibraryIdentifyResult {
  name: string | null;
  artist: string | null;
  details: string | null;
  date: string | null;
  imageUrl: string | null;
  urls: string[];
}

export interface NormalizedAudioTrackIdentifyResult {
  title: string | null;
  artist: string | null;
  album: string | null;
  trackNumber: number | null;
  date: string | null;
  details: string | null;
  imageUrl: string | null;
  urls: string[];
  tagNames: string[];
}

// ─── Series identification ─────────────────────────────────────────

export interface SeriesCandidate {
  externalId: string;
  title: string;
  year?: string;
  network?: string;
  overview?: string;
  posterUrl?: string;
  seasonCount?: number;
  episodeCount?: number;
}

export interface UIEpisodeMapping {
  sceneId: string;
  sceneTitle: string;
  filename: string;
  episodeTitle?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  airDate?: string;
  accepted: boolean;
}

// ─── Provider with NSFW awareness ──────────────────────────────────

export interface IdentifyProvider {
  id: string;
  name: string;
  type: "scraper" | "stashbox" | "plugin";
  isNsfw: boolean;
  capabilities: Record<string, boolean>;
}
