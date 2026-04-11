import type {
  CommunityIndexEntryDto,
  GalleryDetailDto,
  GalleryListItemDto,
  ImageDetailDto,
  ImageListItemDto,
  JobRunDto,
  JobsDashboardDto,
  LibraryBrowseDto,
  LibraryRootDto,
  LibrarySettingsDto,
  SceneSubtitleTrackDto,
  ScrapeResultDto,
  ScraperPackageDto,
  StorageStatsDto,
  SubtitleCueDto,
  TagEmbedDto,
} from "@obscura/contracts";

export interface SceneListItem {
  id: string;
  title: string;
  details: string | null;
  date: string | null;
  rating: number | null;
  organized: boolean;
  isNsfw: boolean;
  duration: number | null;
  durationFormatted: string | null;
  resolution: string | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  container: string | null;
  fileSize: number | null;
  fileSizeFormatted: string | null;
  filePath: string | null;
  hasVideo: boolean;
  streamUrl: string | null;
  directStreamUrl: string | null;
  thumbnailPath: string | null;
  cardThumbnailPath: string | null;
  spritePath: string | null;
  trickplayVttPath: string | null;
  playCount: number;
  orgasmCount: number;
  studioId: string | null;
  performers: {
    id: string;
    name: string;
    gender?: string | null;
    imagePath?: string | null;
    favorite?: boolean;
    isNsfw?: boolean;
  }[];
  tags: TagEmbedDto[];
  createdAt: string;
  updatedAt: string;
}

export interface SceneDetail extends SceneListItem {
  interactive: boolean;
  frameRate: number | null;
  bitRate: number | null;
  previewPath: string | null;
  playDuration: number | null;
  resumeTime: number | null;
  lastPlayedAt: string | null;
  url: string | null;
  studio: { id: string; name: string; url: string | null } | null;
  markers: {
    id: string;
    title: string;
    seconds: number;
    endSeconds: number | null;
  }[];
  subtitleTracks: SceneSubtitleTrackDto[];
  updatedAt: string;
}

export type { SceneSubtitleTrackDto, SubtitleCueDto };

export type GalleryListItem = GalleryListItemDto;

export interface SceneStats {
  totalScenes: number;
  totalDuration: number;
  totalDurationFormatted: string;
  totalSize: number;
  totalSizeFormatted: string;
  totalPlays: number;
  recentCount: number;
}

export interface StudioItem {
  id: string;
  name: string;
  url: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  isNsfw: boolean;
  sceneCount: number;
  /** Galleries + images with this studio (SFW mode excludes NSFW entities). */
  imageAppearanceCount: number;
  audioLibraryCount: number;
}

export interface PerformerItem {
  id: string;
  name: string;
  disambiguation: string | null;
  gender: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  isNsfw: boolean;
  sceneCount: number;
  /** Linked galleries plus standalone images (SFW mode excludes NSFW entities). */
  imageAppearanceCount: number;
  audioLibraryCount: number;
  country: string | null;
  createdAt: string;
}

export interface TagItem {
  id: string;
  name: string;
  sceneCount: number;
  imageCount: number;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  isNsfw: boolean;
}

export interface PerformerDetail {
  id: string;
  name: string;
  disambiguation: string | null;
  aliases: string | null;
  gender: string | null;
  birthdate: string | null;
  country: string | null;
  ethnicity: string | null;
  eyeColor: string | null;
  hairColor: string | null;
  height: number | null;
  weight: number | null;
  measurements: string | null;
  tattoos: string | null;
  piercings: string | null;
  careerStart: number | null;
  careerEnd: number | null;
  details: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  isNsfw: boolean;
  sceneCount: number;
  tags: TagEmbedDto[];
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedPerformerScrapeResult {
  name: string | null;
  disambiguation: string | null;
  gender: string | null;
  birthdate: string | null;
  country: string | null;
  ethnicity: string | null;
  eyeColor: string | null;
  hairColor: string | null;
  height: string | null;
  weight: string | null;
  measurements: string | null;
  tattoos: string | null;
  piercings: string | null;
  aliases: string | null;
  details: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  tagNames: string[];
}

export interface StudioParentRef {
  id: string;
  name: string;
  imagePath: string | null;
  imageUrl: string | null;
}

export interface StudioChildRef {
  id: string;
  name: string;
  imagePath: string | null;
  imageUrl: string | null;
  sceneCount: number;
}

export interface StudioDetail {
  id: string;
  name: string;
  description: string | null;
  aliases: string | null;
  url: string | null;
  parentId: string | null;
  parent: StudioParentRef | null;
  childStudios: StudioChildRef[];
  imageUrl: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  isNsfw: boolean;
  sceneCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MarkerDto {
  id: string;
  title: string;
  seconds: number;
  endSeconds: number | null;
}

export interface TagDetail {
  id: string;
  name: string;
  description: string | null;
  aliases: string | null;
  parentId: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  isNsfw: boolean;
  ignoreAutoTag: boolean;
  sceneCount: number;
  createdAt: string;
  updatedAt: string;
}

export type LibraryRoot = LibraryRootDto;
export type LibrarySettings = LibrarySettingsDto;
export type StorageStats = StorageStatsDto;
export type JobsDashboard = JobsDashboardDto;
export type QueueSummary = JobsDashboardDto["queues"][number];
export type JobRun = JobRunDto;
export type LibraryBrowse = LibraryBrowseDto;
export type ScraperPackage = ScraperPackageDto;
export type CommunityIndexEntry = CommunityIndexEntryDto;
export type ScrapeResult = ScrapeResultDto;

export interface NormalizedScrapeResult {
  title: string | null;
  date: string | null;
  details: string | null;
  url: string | null;
  studioName: string | null;
  performerNames: string[];
  tagNames: string[];
  imageUrl: string | null;
}

export interface StashBoxEndpoint {
  id: string;
  name: string;
  endpoint: string;
  apiKeyPreview: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MetadataProvider {
  id: string;
  name: string;
  type: "scraper" | "stashbox";
  enabled: boolean;
  capabilities: Record<string, boolean>;
}

export interface NormalizedStudioScrapeResult {
  name: string | null;
  url: string | null;
  imageUrl: string | null;
  parentName: string | null;
}

export interface NormalizedTagScrapeResult {
  name: string | null;
  description: string | null;
  aliases: string | null;
}

export interface StashIdEntry {
  id: string;
  entityType: string;
  entityId: string;
  endpointId: string;
  endpointName: string;
  stashId: string;
  createdAt: string;
}

export interface StashBoxStudioResult {
  id: string;
  name: string;
  aliases: string[];
  urls: { url: string; type: string }[];
  parent: { id: string; name: string } | null;
  images: { id: string; url: string; width: number; height: number }[];
}

export interface StashBoxTagResult {
  id: string;
  name: string;
  description: string | null;
  aliases: string[];
  category: { id: string; name: string; description: string | null } | null;
}

export type { GalleryDetailDto, ImageDetailDto, ImageListItemDto };
