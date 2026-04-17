/**
 * Re-export DTOs from @obscura/contracts under their local aliases.
 *
 * Frontend code imports types from here (or directly from @obscura/contracts).
 * The canonical definitions live in packages/contracts/src/index.ts.
 */
import type {
  GalleryDetailDto,
  GalleryListItemDto,
  ImageDetailDto,
  ImageListItemDto,
  JobRunDto,
  JobsDashboardDto,
  LibraryBrowseDto,
  LibraryRootDto,
  LibrarySettingsDto,
  NormalizedPerformerResult,
  NormalizedSceneScrapeResultDto,
  NormalizedStudioScrapeResultDto,
  NormalizedTagScrapeResultDto,
  PerformerDetailDto,
  PerformerListItemDto,
  VideoDetailDto,
  VideoSeriesDetailDto,
  VideoSeriesListItemDto,
  VideoListItemDto,
  VideoMarkerDto,
  VideoStatsDto,
  VideoSubtitleTrackDto,
  ScrapeResultDto,
  ScraperPackageDto,
  StashBoxEndpointDto,
  StashBoxStudioResultDto,
  StashBoxTagResultDto,
  StashIdEntryDto,
  StorageStatsDto,
  StudioDetailDto,
  StudioListItemDto,
  StudioChildRefDto,
  StudioParentRefDto,
  SubtitleCueDto,
  TagDetailDto,
  TagEmbedDto,
  TagListItemDto,
  MetadataProviderDto,
  CommunityIndexEntryDto,
} from "@obscura/contracts";

// ─── Video aliases ──────────────────────────────────────────────
export type VideoListItem = VideoListItemDto;
export type VideoDetail = VideoDetailDto;
export type VideoStats = VideoStatsDto;
export type { VideoMarkerDto, VideoSubtitleTrackDto, SubtitleCueDto };

// ─── Series (video_series) aliases ──────────────────────────────
export type SeriesListItem = VideoSeriesListItemDto;
export type SeriesDetail = VideoSeriesDetailDto;

// ─── Performer aliases ──────────────────────────────────────────
export type PerformerItem = PerformerListItemDto;
export type PerformerDetail = PerformerDetailDto;
export type NormalizedPerformerScrapeResult = NormalizedPerformerResult;

// ─── Studio aliases ─────────────────────────────────────────────
export type StudioItem = StudioListItemDto;
export type StudioDetail = StudioDetailDto;
export type StudioParentRef = StudioParentRefDto;
export type StudioChildRef = StudioChildRefDto;

// ─── Tag aliases ────────────────────────────────────────────────
export type TagItem = TagListItemDto;
export type TagDetail = TagDetailDto;

// ─── Gallery / Image aliases ────────────────────────────────────
export type GalleryListItem = GalleryListItemDto;
export type { GalleryDetailDto, ImageDetailDto, ImageListItemDto };

// ─── Jobs / Library aliases ─────────────────────────────────────
export type LibraryRoot = LibraryRootDto;
export type LibrarySettings = LibrarySettingsDto;
export type StorageStats = StorageStatsDto;
export type JobsDashboard = JobsDashboardDto;
export type QueueSummary = JobsDashboardDto["queues"][number];
export type JobRun = JobRunDto;
export type LibraryBrowse = LibraryBrowseDto;

// ─── Scraper / StashBox aliases ─────────────────────────────────
export type ScraperPackage = ScraperPackageDto;
export type CommunityIndexEntry = CommunityIndexEntryDto;
export type ScrapeResult = ScrapeResultDto;
export type NormalizedScrapeResult = NormalizedSceneScrapeResultDto;
export type NormalizedStudioScrapeResult = NormalizedStudioScrapeResultDto;
export type NormalizedTagScrapeResult = NormalizedTagScrapeResultDto;

export interface StashBoxEndpoint {
  id: string;
  name: string;
  endpoint: string;
  apiKeyPreview: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MetadataProvider = MetadataProviderDto;

export type StashIdEntry = StashIdEntryDto;
export type StashBoxStudioResult = StashBoxStudioResultDto;
export type StashBoxTagResult = StashBoxTagResultDto;
