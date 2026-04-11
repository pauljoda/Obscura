export const apiRoutes = {
  health: "/health",
  changelog: "/changelog",
  jobs: "/jobs",
  jobQueueRun: "/jobs/queues/:queueName/run",
  jobCancelAll: "/jobs/cancel-all",
  jobRunCancel: "/jobs/:jobRunId/cancel",
  jobAcknowledgeFailed: "/jobs/acknowledge-failed",
  sceneAssets: "/assets/scenes/:id/*",
  libraries: "/libraries",
  libraryDetail: "/libraries/:id",
  libraryBrowse: "/libraries/browse",
  librarySettings: "/settings/library",
  scenes: "/scenes",
  sceneDetail: "/scenes/:id",
  sceneStats: "/scenes/stats",
  sceneUpload: "/scenes/upload",
  sceneSubtitles: "/scenes/:id/subtitles",
  sceneSubtitleDetail: "/scenes/:id/subtitles/:trackId",
  sceneSubtitleCues: "/scenes/:id/subtitles/:trackId/cues",
  sceneSubtitleExtract: "/scenes/:id/subtitles/extract",
  galleries: "/galleries",
  galleryDetail: "/galleries/:id",
  galleryStats: "/galleries/stats",
  galleryCover: "/galleries/:id/cover",
  galleryImageUpload: "/galleries/:id/images/upload",
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
  clientInfo: "/client-info",
  stashBoxLookupPerformer: "/stashbox-endpoints/:id/lookup/performer",
  // Unified metadata providers
  metadataProviders: "/metadata-providers",
  search: "/search",
  // Audio
  audioLibraries: "/audio-libraries",
  audioLibraryDetail: "/audio-libraries/:id",
  audioLibraryStats: "/audio-libraries/stats",
  audioLibraryCover: "/audio-libraries/:id/cover",
  audioLibraryIcon: "/audio-libraries/:id/icon",
  audioLibraryTrackUpload: "/audio-libraries/:id/tracks/upload",
  audioTracks: "/audio-tracks",
  audioTrackDetail: "/audio-tracks/:id",
  audioTrackMarkers: "/audio-tracks/:id/markers",
  audioTrackMarkerDetail: "/audio-tracks/markers/:id",
  audioStream: "/audio-stream/:id",
  audioTrackWaveform: "/assets/audio-tracks/:id/waveform",
  audioLibraryCoverAsset: "/assets/audio-libraries/:id/cover",
  audioLibraryIconAsset: "/assets/audio-libraries/:id/icon",
} as const;

export const API_BASE_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000")
    : (process.env.API_URL ?? "http://localhost:4000");

export {
  canUseInlineVideoPreview,
  formatDuration,
  formatFileSize,
  getResolutionLabel,
  isVideoImage,
  isVideoImageFormat,
  VIDEO_IMAGE_FORMATS,
  VIDEO_PREVIEW_MAX_FILE_SIZE_BYTES,
} from "./media";

export type {
  PaginatedResponse,
  ErrorResponse,
  ListQuery,
  SceneListQuery,
  GalleryListQuery,
  PerformerListQuery,
  ImageListQuery,
  StudioListQuery,
  TagListQuery,
  AudioLibraryListQuery,
  AudioTrackListQuery,
  BulkUpdateResult,
} from "./queries";

export const queueDefinitions = [
  {
    name: "library-scan",
    label: "Library Scan",
    description: "Discovers video scenes in configured media roots",
    concurrency: 1,
  },
  {
    name: "media-probe",
    label: "Media Probe",
    description: "Extracts technical metadata using ffprobe",
    concurrency: 1,
  },
  {
    name: "fingerprint",
    label: "Fingerprint",
    description: "Generates md5 and oshash fingerprints for scenes",
    concurrency: 1,
  },
  {
    name: "preview",
    label: "Preview Build",
    description: "Builds scene thumbnails, preview clips, and trickplay sprites",
    concurrency: 1,
  },
  {
    name: "metadata-import",
    label: "Metadata Import",
    description: "Coordinates provider imports and metadata application",
    concurrency: 1,
  },
  {
    name: "gallery-scan",
    label: "Gallery Scan",
    description: "Discovers image galleries in configured media roots",
    concurrency: 1,
  },
  {
    name: "image-thumbnail",
    label: "Image Thumbnail",
    description: "Generates thumbnails and lightweight previews for images",
    concurrency: 1,
  },
  {
    name: "image-fingerprint",
    label: "Image Fingerprint",
    description: "Computes md5 and oshash fingerprints for images",
    concurrency: 1,
  },
  {
    name: "audio-scan",
    label: "Audio Scan",
    description: "Discovers audio tracks in configured media roots",
    concurrency: 1,
  },
  {
    name: "audio-probe",
    label: "Audio Probe",
    description: "Extracts technical metadata and embedded tags from audio files",
    concurrency: 1,
  },
  {
    name: "audio-fingerprint",
    label: "Audio Fingerprint",
    description: "Computes md5 and oshash fingerprints for audio tracks",
    concurrency: 1,
  },
  {
    name: "audio-waveform",
    label: "Audio Waveform",
    description: "Generates waveform peaks data for audio playback visualization",
    concurrency: 1,
  },
  {
    name: "library-maintenance",
    label: "Library maintenance",
    description: "Moves scene-generated video assets between cache and media-adjacent storage",
    concurrency: 1,
  },
  {
    name: "extract-subtitles",
    label: "Extract Subtitles",
    description: "Extracts embedded subtitle tracks from video files as WebVTT",
    concurrency: 1,
  },
] as const;

export type SubtitleSource = "sidecar" | "upload" | "embedded";

export interface SceneSubtitleTrackDto {
  id: string;
  sceneId: string;
  language: string;
  label: string | null;
  format: "vtt";
  source: SubtitleSource;
  isDefault: boolean;
  url: string;
  createdAt: string;
}

export interface SubtitleCueDto {
  start: number;
  end: number;
  text: string;
}

/** BullMQ jobs per queue; default 1. Higher values increase CPU, disk, and memory use. */
export const BACKGROUND_WORKER_CONCURRENCY_MIN = 1;
export const BACKGROUND_WORKER_CONCURRENCY_MAX = 32;

export function normalizeBackgroundWorkerConcurrency(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return BACKGROUND_WORKER_CONCURRENCY_MIN;
  }
  const floor = Math.floor(n);
  return Math.min(
    BACKGROUND_WORKER_CONCURRENCY_MAX,
    Math.max(BACKGROUND_WORKER_CONCURRENCY_MIN, floor)
  );
}

/** Effective BullMQ concurrency for a queue: definition base × normalized user setting. */
export function resolveQueueWorkerConcurrency(
  definitionConcurrency: number,
  backgroundWorkerConcurrency: unknown
): number {
  const base = Math.max(1, Math.floor(definitionConcurrency));
  const k = normalizeBackgroundWorkerConcurrency(backgroundWorkerConcurrency);
  return base * k;
}

export type QueueName = (typeof queueDefinitions)[number]["name"];

export const jobRunRetention = {
  completed: 40,
  dismissed: 40,
} as const;

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

export const jobTriggerKinds = [
  "manual",
  "schedule",
  "library-scan",
  "gallery-scan",
  "audio-scan",
  "system",
] as const;

export type JobTriggerKind = (typeof jobTriggerKinds)[number];

export const jobKinds = ["standard", "force-rebuild"] as const;

export type JobKind = (typeof jobKinds)[number];

/** Lightweight library root summary used by upload target pickers. */
export interface LibraryRootSummaryDto {
  id: string;
  path: string;
  label: string;
  enabled: boolean;
  scanVideos: boolean;
  scanImages: boolean;
  scanAudio: boolean;
}

export interface UploadSceneResponseDto {
  id: string;
  title: string;
  filePath: string;
  libraryRootId: string;
}

export interface UploadImageResponseDto {
  id: string;
  title: string;
  filePath: string;
  galleryId: string;
}

export interface UploadAudioTrackResponseDto {
  id: string;
  title: string;
  filePath: string;
  libraryId: string;
}

export interface LibraryRootDto {
  id: string;
  path: string;
  label: string;
  enabled: boolean;
  recursive: boolean;
  scanVideos: boolean;
  scanImages: boolean;
  scanAudio: boolean;
  isNsfw: boolean;
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
  /** Parallel jobs per queue in the worker process (1–32). */
  backgroundWorkerConcurrency: number;
  nsfwLanAutoEnable: boolean;
  /** Scene video derivatives (thumb, preview, sprite, trickplay) in cache dir vs next to media. */
  metadataStorageDedicated: boolean;
  /** When true, player auto-enables a subtitle track on load if a matching language is available. */
  subtitlesAutoEnable: boolean;
  /** Comma-separated BCP-47 / ISO 639 preference list (e.g. "en,eng,en-US"). First match wins. */
  subtitlesPreferredLanguages: string;
  /** Visual style applied to the caption overlay. */
  subtitleStyle: SubtitleDisplayStyle;
  /** Font scale multiplier (1.0 = default). Clamped to [0.5, 3.0]. */
  subtitleFontScale: number;
  /** Vertical position as a 0–100 percentage from the top of the video frame. */
  subtitlePositionPercent: number;
  createdAt: string;
  updatedAt: string;
}

export const subtitleDisplayStyles = ["stylized", "classic", "outline"] as const;
export type SubtitleDisplayStyle = (typeof subtitleDisplayStyles)[number];

export interface SubtitleAppearance {
  style: SubtitleDisplayStyle;
  fontScale: number;
  positionPercent: number;
}

export const defaultSubtitleAppearance: SubtitleAppearance = {
  style: "stylized",
  fontScale: 1,
  positionPercent: 88,
};

export interface StorageStatsDto {
  thumbnailsBytes: number;
  previewsBytes: number;
  trickplayBytes: number;
  totalBytes: number;
}

/** Tag embedded on scenes, images, galleries, and performers in list/detail payloads. */
export interface TagEmbedDto {
  id: string;
  name: string;
  isNsfw: boolean;
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
  isNsfw: boolean;
  date: string | null;
  studioId: string | null;
  studioName: string | null;
  performers: { id: string; name: string }[];
  tags: TagEmbedDto[];
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
  isNsfw: boolean;
  photographer: string | null;
  folderPath: string | null;
  zipFilePath: string | null;
  parentId: string | null;
  coverImageId: string | null;
  coverImagePath: string | null;
  imageCount: number;
  studio: { id: string; name: string; url: string | null } | null;
  performers: { id: string; name: string; gender: string | null; imagePath: string | null }[];
  tags: TagEmbedDto[];
  chapters: GalleryChapterDto[];
  images: ImageListItemDto[];
  imageTotal: number;
  imageLimit: number;
  imageOffset: number;
  children: { id: string; title: string; imageCount: number; coverImagePath: string | null; previewImagePaths: string[]; isNsfw: boolean }[];
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
  isNsfw: boolean;
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
  tags: TagEmbedDto[];
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
  isNsfw?: boolean;
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
  label: string;
  description: string;
  status: "idle" | "active" | "warning";
  concurrency: number;
  active: number;
  waiting: number;
  delayed: number;
  backlog: number;
  completed: number;
  failed: number;
}

export interface JobRunDto {
  id: string;
  queueName: QueueName;
  queueLabel: string;
  status: JobStatus;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  triggeredBy: JobTriggerKind | null;
  triggerLabel: string | null;
  jobKind: JobKind | null;
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
  isNsfw: boolean;
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
  isNsfw: boolean;
  sceneCount: number;
  tags: TagEmbedDto[];
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
  isNsfw?: boolean;
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

// ─── Search DTOs ────────────────────────────────────────────────

export type EntityKind = "scene" | "performer" | "studio" | "tag" | "gallery" | "image" | "audio-library" | "audio-track";

export interface SearchResultItem {
  id: string;
  kind: EntityKind;
  title: string;
  subtitle: string | null;
  imagePath: string | null;
  href: string;
  rating: number | null;
  score: number;
  meta: Record<string, string | number | boolean | null>;
}

export interface SearchResultGroup {
  kind: EntityKind;
  label: string;
  items: SearchResultItem[];
  total: number;
  hasMore: boolean;
}

export interface SearchResponseDto {
  query: string;
  groups: SearchResultGroup[];
  durationMs: number;
}

// ─── Jobs DTOs ───────────────────────────────────────────────────

export interface JobsDashboardDto {
  queues: QueueSummaryDto[];
  activeJobs: JobRunDto[];
  failedJobs: JobRunDto[];
  completedJobs: JobRunDto[];
  recentJobs: JobRunDto[];
  lastScanAt: string | null;
  schedule: {
    enabled: boolean;
    intervalMinutes: number;
  };
}

// ─── Audio Library DTOs ────────────────────────────────────────

export interface AudioLibraryListItemDto {
  id: string;
  title: string;
  coverImagePath: string | null;
  iconPath: string | null;
  trackCount: number;
  rating: number | null;
  organized: boolean;
  isNsfw: boolean;
  date: string | null;
  studioId: string | null;
  studioName: string | null;
  performers: { id: string; name: string }[];
  tags: TagEmbedDto[];
  parentId: string | null;
  createdAt: string;
}

export interface AudioLibraryDetailDto {
  id: string;
  title: string;
  details: string | null;
  date: string | null;
  rating: number | null;
  organized: boolean;
  isNsfw: boolean;
  folderPath: string | null;
  parentId: string | null;
  coverImagePath: string | null;
  iconPath: string | null;
  trackCount: number;
  totalDuration: number | null;
  studio: { id: string; name: string; url: string | null } | null;
  performers: { id: string; name: string; gender: string | null; imagePath: string | null }[];
  tags: TagEmbedDto[];
  tracks: AudioTrackListItemDto[];
  trackTotal: number;
  trackLimit: number;
  trackOffset: number;
  children: { id: string; title: string; trackCount: number; coverImagePath: string | null; iconPath: string | null; isNsfw: boolean }[];
  createdAt: string;
  updatedAt: string;
}

/** PATCH /audio-libraries/:id */
export interface AudioLibraryPatchDto {
  title?: string;
  details?: string | null;
  date?: string | null;
  rating?: number | null;
  organized?: boolean;
  isNsfw?: boolean;
  studioName?: string | null;
  performerNames?: string[];
  tagNames?: string[];
}

/** PATCH /audio-tracks/:id */
export interface AudioTrackPatchDto {
  title?: string;
  details?: string | null;
  date?: string | null;
  rating?: number | null;
  organized?: boolean;
  isNsfw?: boolean;
  studioName?: string | null;
  performerNames?: string[];
  tagNames?: string[];
}

export interface AudioLibraryStatsDto {
  totalLibraries: number;
  totalTracks: number;
  totalDuration: number;
  recentCount: number;
}

// ─── Audio Track DTOs ──────────────────────────────────────────

export interface AudioTrackListItemDto {
  id: string;
  title: string;
  date: string | null;
  rating: number | null;
  organized: boolean;
  isNsfw: boolean;
  duration: number | null;
  bitRate: number | null;
  sampleRate: number | null;
  channels: number | null;
  codec: string | null;
  fileSize: number | null;
  embeddedArtist: string | null;
  embeddedAlbum: string | null;
  trackNumber: number | null;
  waveformPath: string | null;
  libraryId: string | null;
  sortOrder: number;
  studioId: string | null;
  performers: { id: string; name: string }[];
  tags: TagEmbedDto[];
  playCount: number;
  lastPlayedAt: string | null;
  createdAt: string;
}

export interface AudioTrackDetailDto extends AudioTrackListItemDto {
  details: string | null;
  checksumMd5: string | null;
  oshash: string | null;
  filePath: string;
  container: string | null;
  resumeTime: number;
  playDuration: number;
  studio: { id: string; name: string } | null;
  markers: AudioTrackMarkerDto[];
  updatedAt: string;
}

export interface AudioTrackMarkerDto {
  id: string;
  trackId: string;
  title: string;
  seconds: number;
  endSeconds: number | null;
}
