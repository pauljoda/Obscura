export const apiRoutes = {
  health: "/health",
  jobs: "/jobs",
  jobQueueRun: "/jobs/queues/:queueName/run",
  jobAcknowledgeFailed: "/jobs/acknowledge-failed",
  sceneAssets: "/assets/scenes/:id/*",
  libraries: "/libraries",
  libraryDetail: "/libraries/:id",
  libraryBrowse: "/libraries/browse",
  librarySettings: "/settings/library",
  scenes: "/scenes",
  sceneDetail: "/scenes/:id",
  sceneStats: "/scenes/stats",
  galleries: "/galleries",
  galleryDetail: "/galleries/:id",
  galleryStats: "/galleries/stats",
  galleryCover: "/galleries/:id/cover",
  galleryChapters: "/galleries/:id/chapters",
  galleryChapterDetail: "/galleries/chapters/:id",
  images: "/images",
  imageDetail: "/images/:id",
  imagesBulk: "/images/bulk",
  imageAssets: "/assets/images/:id/*",
  galleryCoverAsset: "/assets/galleries/:id/cover",
  studios: "/studios",
  performers: "/performers",
  performerDetail: "/performers/:id",
  performerAssets: "/assets/performers/:id/*",
  scraperScrapePerformer: "/scrapers/:id/scrape-performer",
  tags: "/tags",
  scrapers: "/scrapers",
  scraperPackages: "/scrapers/packages",
  scraperPackageDetail: "/scrapers/packages/:id",
  scrapersIndex: "/scrapers/index",
  scraperScrape: "/scrapers/:id/scrape",
  scrapeResults: "/scrapers/results",
  scrapeResultDetail: "/scrapers/results/:id",
  scrapeResultAccept: "/scrapers/results/:id/accept",
  scrapeResultReject: "/scrapers/results/:id/reject",
  sceneScrape: "/scenes/:id/scrape",
  // Stash-Box endpoints
  stashBoxEndpoints: "/stashbox-endpoints",
  stashBoxEndpointDetail: "/stashbox-endpoints/:id",
  stashBoxEndpointTest: "/stashbox-endpoints/:id/test",
  stashBoxIdentify: "/stashbox-endpoints/:id/identify",
  stashBoxIdentifyPerformer: "/stashbox-endpoints/:id/identify-performer",
  stashBoxLookupStudio: "/stashbox-endpoints/:id/lookup/studio",
  stashBoxLookupTag: "/stashbox-endpoints/:id/lookup/tag",
  stashBoxLookupPerformer: "/stashbox-endpoints/:id/lookup/performer",
  // Unified metadata providers
  metadataProviders: "/metadata-providers",
} as const;

export const API_BASE_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000")
    : (process.env.API_URL ?? "http://localhost:4000");

export const queueDefinitions = [
  { name: "library-scan", description: "Discovers files in configured media roots" },
  { name: "media-probe", description: "Extracts technical metadata using ffprobe" },
  { name: "fingerprint", description: "Generates md5, oshash, and perceptual fingerprints" },
  { name: "preview", description: "Builds thumbnails, previews, and trickplay sprites" },
  { name: "metadata-import", description: "Coordinates stash bootstrap imports and provider application" },
  { name: "gallery-scan", description: "Discovers images and galleries in configured media roots" },
  { name: "image-thumbnail", description: "Generates thumbnails for images" },
  { name: "image-fingerprint", description: "Computes MD5/oshash for images" },
] as const;

export type QueueName = (typeof queueDefinitions)[number]["name"];

export const jobStatuses = [
  "waiting",
  "active",
  "completed",
  "failed",
  "dismissed",
  "delayed",
  "paused",
] as const;

export type JobStatus = (typeof jobStatuses)[number];

export interface LibraryRootDto {
  id: string;
  path: string;
  label: string;
  enabled: boolean;
  recursive: boolean;
  scanVideos: boolean;
  scanImages: boolean;
  lastScannedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryBrowseEntryDto {
  name: string;
  path: string;
}

export interface LibraryBrowseDto {
  path: string;
  parentPath: string | null;
  directories: LibraryBrowseEntryDto[];
}

export interface LibrarySettingsDto {
  id: string;
  autoScanEnabled: boolean;
  scanIntervalMinutes: number;
  autoGenerateMetadata: boolean;
  autoGenerateFingerprints: boolean;
  autoGeneratePreview: boolean;
  generateTrickplay: boolean;
  trickplayIntervalSeconds: number;
  previewClipDurationSeconds: number;
  thumbnailQuality: number;
  trickplayQuality: number;
  createdAt: string;
  updatedAt: string;
}

export interface StorageStatsDto {
  thumbnailsBytes: number;
  previewsBytes: number;
  trickplayBytes: number;
  totalBytes: number;
}

// ─── Gallery DTOs ────────────────────────────────────────────────

export type GalleryType = "folder" | "zip" | "virtual";

export interface GalleryListItemDto {
  id: string;
  title: string;
  galleryType: GalleryType;
  coverImagePath: string | null;
  previewImagePaths: string[];
  imageCount: number;
  rating: number | null;
  organized: boolean;
  date: string | null;
  studioId: string | null;
  studioName: string | null;
  performers: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  parentId: string | null;
  createdAt: string;
}

export interface GalleryDetailDto {
  id: string;
  title: string;
  details: string | null;
  galleryType: GalleryType;
  date: string | null;
  rating: number | null;
  organized: boolean;
  photographer: string | null;
  folderPath: string | null;
  zipFilePath: string | null;
  parentId: string | null;
  coverImageId: string | null;
  coverImagePath: string | null;
  imageCount: number;
  studio: { id: string; name: string; url: string | null } | null;
  performers: { id: string; name: string; gender: string | null; imagePath: string | null }[];
  tags: { id: string; name: string }[];
  chapters: GalleryChapterDto[];
  images: ImageListItemDto[];
  imageTotal: number;
  imageLimit: number;
  imageOffset: number;
  children: { id: string; title: string; imageCount: number; coverImagePath: string | null; previewImagePaths: string[] }[];
  createdAt: string;
  updatedAt: string;
}

export interface GalleryChapterDto {
  id: string;
  galleryId: string;
  title: string;
  imageIndex: number;
}

export interface GalleryStatsDto {
  totalGalleries: number;
  totalImages: number;
  recentCount: number;
}

// ─── Image DTOs ──────────────────────────────────────────────────

export interface ImageListItemDto {
  id: string;
  title: string;
  date: string | null;
  rating: number | null;
  organized: boolean;
  width: number | null;
  height: number | null;
  format: string | null;
  isVideo: boolean;
  fileSize: number | null;
  thumbnailPath: string | null;
  previewPath: string | null;
  fullPath: string | null;
  galleryId: string | null;
  sortOrder: number;
  studioId: string | null;
  performers: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  createdAt: string;
}

export interface ImageDetailDto extends ImageListItemDto {
  details: string | null;
  checksumMd5: string | null;
  oshash: string | null;
  filePath: string;
  studio: { id: string; name: string } | null;
  updatedAt: string;
}

export interface GalleryImagesPageDto {
  images: ImageListItemDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface ImageUpdateDto {
  title?: string;
  details?: string | null;
  date?: string | null;
  rating?: number | null;
  organized?: boolean;
  studioName?: string | null;
  performerNames?: string[];
  tagNames?: string[];
}

export interface ImageBulkUpdateDto {
  ids: string[];
  patch: {
    rating?: number | null;
    organized?: boolean;
    tagNames?: string[];
    galleryId?: string | null;
  };
}

export interface QueueSummaryDto {
  name: QueueName;
  description: string;
  status: "idle" | "active" | "warning";
  active: number;
  waiting: number;
  completed: number;
  failed: number;
}

export interface JobRunDto {
  id: string;
  queueName: QueueName;
  status: JobStatus;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  progress: number;
  attempts: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Scraper DTOs ────────────────────────────────────────────────

export interface ScraperPackageDto {
  id: string;
  packageId: string;
  name: string;
  version: string;
  installPath: string;
  sha256: string | null;
  capabilities: Record<string, boolean> | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityIndexEntryDto {
  id: string;
  name: string;
  version: string;
  date: string;
  path: string;
  sha256: string;
  requires?: string[];
  installed?: boolean;
  installedVersion?: string;
}

export interface ScrapeResultDto {
  id: string;
  sceneId: string;
  scraperPackageId: string | null;
  stashBoxEndpointId: string | null;
  action: string;
  matchType: string | null;
  status: "pending" | "accepted" | "rejected";
  rawResult: unknown;
  proposedTitle: string | null;
  proposedDate: string | null;
  proposedDetails: string | null;
  proposedUrl: string | null;
  proposedStudioName: string | null;
  proposedPerformerNames: string[] | null;
  proposedTagNames: string[] | null;
  proposedImageUrl: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScraperCapabilities {
  sceneByURL: boolean;
  sceneByFragment: boolean;
  sceneByName: boolean;
  performerByURL: boolean;
  performerByName: boolean;
  performerByFragment: boolean;
}

// ─── Stash-Box DTOs ─────────────────────────────────────────────

export interface StashBoxEndpointDto {
  id: string;
  name: string;
  endpoint: string;
  /** Masked — only last 4 chars shown */
  apiKeyPreview: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StashBoxEndpointCreateDto {
  name: string;
  endpoint: string;
  apiKey: string;
}

export type MetadataProviderType = "scraper" | "stashbox";

export interface MetadataProviderDto {
  id: string;
  name: string;
  type: MetadataProviderType;
  enabled: boolean;
  capabilities: Record<string, boolean>;
}

// ─── Performer DTOs ─────────────────────────────────────────────

export interface PerformerListItemDto {
  id: string;
  name: string;
  disambiguation: string | null;
  gender: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  sceneCount: number;
  country: string | null;
  createdAt: string;
}

export interface PerformerDetailDto {
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
  sceneCount: number;
  tags: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface PerformerUpdateDto {
  name?: string;
  disambiguation?: string | null;
  aliases?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  country?: string | null;
  ethnicity?: string | null;
  eyeColor?: string | null;
  hairColor?: string | null;
  height?: number | null;
  weight?: number | null;
  measurements?: string | null;
  tattoos?: string | null;
  piercings?: string | null;
  careerStart?: number | null;
  careerEnd?: number | null;
  details?: string | null;
  imageUrl?: string | null;
  favorite?: boolean;
  rating?: number | null;
  tagNames?: string[];
}

export interface NormalizedPerformerResult {
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

// ─── Jobs DTOs ───────────────────────────────────────────────────

export interface JobsDashboardDto {
  queues: QueueSummaryDto[];
  activeJobs: JobRunDto[];
  recentJobs: JobRunDto[];
  lastScanAt: string | null;
  schedule: {
    enabled: boolean;
    intervalMinutes: number;
  };
}
