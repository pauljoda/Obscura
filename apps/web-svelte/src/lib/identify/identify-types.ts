/**
 * Extended type definitions for the universal identification system.
 */

import type {
  VideoSeriesListItemDto,
  ImageCandidate,
  BookListItemDto,
  GalleryListItemDto,
  ImageListItemDto,
  AudioLibraryListItemDto,
  AudioTrackListItemDto,
} from "@obscura/contracts";

export type IdentifyTab =
  | "videos"
  | "video-series"
  | "books"
  | "galleries"
  | "images"
  | "audio-libraries"
  | "audio-tracks"
  | "performers"
  | "studios"
  | "tags"
  | "phashes";

export const VIDEO_SERIES_FIELDS = [
  "title",
  "date",
  "details",
  "url",
  "studio",
  "image",
  "seasonCount",
] as const;
export type VideoSeriesField = (typeof VIDEO_SERIES_FIELDS)[number];

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

export const BOOK_FIELDS = [
  "title",
  "date",
  "details",
  "url",
  "studio",
  "performers",
  "tags",
  "image",
] as const;
export type BookField = (typeof BOOK_FIELDS)[number];

export const IMAGE_FIELDS = ["title", "date", "details", "url", "tags"] as const;
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

export type RowStatus =
  | "pending"
  | "scraping"
  | "found"
  | "no-result"
  | "error"
  | "accepted"
  | "rejected";

export interface VideoSeriesRow {
  series: VideoSeriesListItemDto;
  status: RowStatus;
  result?: NormalizedSeriesIdentifyResult;
  scrapeResultId?: string;
  error?: string;
  matchedProvider?: string;
  selectedFields: Set<VideoSeriesField>;
  wizardStep: "idle" | "picking-series" | "mapping-episodes" | "confirmed";
  seriesCandidates?: SeriesCandidate[];
  selectedSeriesId?: string;
  episodeMappings?: UIEpisodeMapping[];
}

export interface GalleryRow {
  gallery: GalleryListItemDto;
  status: RowStatus;
  result?: NormalizedGalleryIdentifyResult;
  scrapeResultId?: string;
  error?: string;
  matchedProvider?: string;
  selectedFields: Set<GalleryField>;
}

export interface BookRow {
  book: BookListItemDto;
  status: RowStatus;
  result?: NormalizedBookIdentifyResult;
  scrapeResultId?: string;
  error?: string;
  matchedProvider?: string;
  selectedFields: Set<BookField>;
}

export interface NormalizedGalleryCandidate {
  externalIds: Record<string, string>;
  title: string;
  year?: number | null;
  overview?: string | null;
  posterUrl?: string | null;
  language?: string | null;
  contentRating?: string | null;
  source?: string | null;
  popularity?: number | null;
}

export type NormalizedBookCandidate = NormalizedGalleryCandidate;

export interface ImageRow {
  image: ImageListItemDto;
  status: RowStatus;
  result?: NormalizedImageIdentifyResult;
  scrapeResultId?: string;
  error?: string;
  matchedProvider?: string;
  selectedFields: Set<ImageField>;
}

export interface AudioLibraryRow {
  library: AudioLibraryListItemDto;
  status: RowStatus;
  result?: NormalizedAudioLibraryIdentifyResult;
  scrapeResultId?: string;
  error?: string;
  matchedProvider?: string;
  selectedFields: Set<AudioLibraryField>;
}

export interface AudioTrackRow {
  track: AudioTrackListItemDto;
  status: RowStatus;
  result?: NormalizedAudioTrackIdentifyResult;
  scrapeResultId?: string;
  error?: string;
  matchedProvider?: string;
  selectedFields: Set<AudioTrackField>;
}

export interface NormalizedSeriesIdentifyResult {
  name: string | null;
  details: string | null;
  date: string | null;
  imageUrl: string | null;
  backdropUrl: string | null;
  studioName: string | null;
  tagNames: string[];
  urls: string[];
  seriesExternalId?: string;
  seasonCount?: number;
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
  externalIds?: Record<string, string>;
  candidates?: NormalizedGalleryCandidate[];
  isNsfw?: boolean;
}

export interface NormalizedBookIdentifyResult {
  title: string | null;
  date: string | null;
  details: string | null;
  urls: string[];
  studioName: string | null;
  performerNames: string[];
  tagNames: string[];
  imageUrl: string | null;
  chapterImageUrl?: string | null;
  chapterNumber?: number | null;
  imageCandidates?: ImageCandidate[];
  chapterImageCandidates?: ImageCandidate[];
  externalIds?: Record<string, string>;
  candidates?: NormalizedBookCandidate[];
  isNsfw?: boolean;
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
  videoId: string;
  videoTitle: string;
  filename: string;
  episodeTitle?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  airDate?: string;
  accepted: boolean;
}

export interface IdentifyProvider {
  id: string;
  name: string;
  type: "scraper" | "stashbox" | "plugin";
  isNsfw: boolean;
  capabilities: Record<string, boolean>;
}
