export const apiRoutes = {
  health: "/health",
  changelog: "/changelog",
  jobs: "/jobs",
  jobQueueRun: "/jobs/queues/:queueName/run",
  jobCancelAll: "/jobs/cancel-all",
  jobRunCancel: "/jobs/:jobRunId/cancel",
  jobAcknowledgeFailed: "/jobs/acknowledge-failed",
  sceneAssets: "/assets/scenes/:id/*",
  sceneFolderCoverAsset: "/assets/scene-folders/:id/cover",
  libraries: "/libraries",
  libraryDetail: "/libraries/:id",
  libraryBrowse: "/libraries/browse",
  librarySettings: "/settings/library",
  scenes: "/scenes",
  sceneDetail: "/scenes/:id",
  sceneStats: "/scenes/stats",
  sceneUpload: "/scenes/upload",
  sceneFolders: "/scene-folders",
  sceneFolderDetail: "/scene-folders/:id",
  sceneFolderCover: "/scene-folders/:id/cover",
  sceneFolderBackdrop: "/scene-folders/:id/backdrop",
  sceneFolderBackdropAsset: "/assets/scene-folders/:id/backdrop",
  sceneSubtitles: "/scenes/:id/subtitles",
  sceneSubtitleDetail: "/scenes/:id/subtitles/:trackId",
  sceneSubtitleSource: "/scenes/:id/subtitles/:trackId/source",
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
  // Collections
  collections: "/collections",
  collectionDetail: "/collections/:id",
  collectionItems: "/collections/:id/items",
  collectionItemDetail: "/collections/:id/items/:itemId",
  collectionItemsReorder: "/collections/:id/items/reorder",
  collectionRefresh: "/collections/:id/refresh",
  collectionPreviewRules: "/collections/preview-rules",
  collectionCover: "/collections/:id/cover",
  collectionCoverAsset: "/assets/collections/:id/cover",
  // Plugins
  pluginPackages: "/plugins/packages",
  pluginPackageDetail: "/plugins/packages/:id",
  pluginPackageAuth: "/plugins/packages/:id/auth",
  pluginPackageAuthKey: "/plugins/packages/:id/auth/:key",
  pluginsIndex: "/plugins/index",
  pluginExecute: "/plugins/:id/execute",
  pluginBatch: "/plugins/batch",
  pluginBatchStatus: "/plugins/batch/:jobId",
  pluginFolderCascade: "/plugins/:id/folder-cascade",

  // Video accept (scrape-accept)
  videoMovieAcceptScrape: "/video/movies/:id/accept-scrape",
  videoEpisodeAcceptScrape: "/video/episodes/:id/accept-scrape",
  videoSeriesAcceptScrape: "/video/series/:id/accept-scrape",

  // Video library read
  videoLibraryCounts: "/video/library/counts",
  videoMovies: "/video/movies",
  videoMovieDetail: "/video/movies/:id",
  videoSeries: "/video/series",
  videoSeriesDetail: "/video/series/:id",
  videoEpisodeDetail: "/video/episodes/:id",

  // System
  systemStatus: "/system/status",
  systemMigrationFinalize: "/system/migrations/:name/finalize",
} as const;

export const API_BASE_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000")
    : (process.env.API_URL ?? "http://localhost:4000");

export {
  canUseInlineVideoPreview,
  formatDuration,
  formatFileSize,
  getHlsRenditions,
  getResolutionLabel,
  HLS_RENDITION_PRESETS,
  HLS_RETRY_AFTER_SECONDS,
  isVideoImage,
  isVideoImageFormat,
  VIDEO_IMAGE_FORMATS,
  VIDEO_PREVIEW_MAX_FILE_SIZE_BYTES,
} from "./media";

export type {
  HlsPackageState,
  HlsRendition,
  HlsStatus,
} from "./media";

export type {
  PaginatedResponse,
  ErrorResponse,
  ListQuery,
  SceneListQuery,
  SceneFolderListQuery,
  GalleryListQuery,
  PerformerListQuery,
  ImageListQuery,
  StudioListQuery,
  TagListQuery,
  AudioLibraryListQuery,
  AudioTrackListQuery,
  CollectionListQuery,
  CollectionItemListQuery,
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
  {
    name: "collection-refresh",
    label: "Collection Refresh",
    description: "Re-evaluates dynamic collection rules and updates membership",
    concurrency: 1,
  },
  {
    name: "plugin-batch-identify",
    label: "Plugin Batch Identify",
    description: "Batch metadata identification via Obscura plugins",
    concurrency: 1,
  },
] as const;

export type SubtitleSource = "sidecar" | "upload" | "embedded";

/**
 * The original on-disk format. `vtt` means the server only has a WebVTT
 * representation. `ass`/`ssa` means the original Advanced SubStation file is
 * preserved alongside the VTT fallback, and the player can render it with
 * full libass fidelity (fonts, positioning, colors, karaoke, animations) via
 * the `sourceUrl`.
 */
export type SubtitleSourceFormat = "vtt" | "srt" | "ass" | "ssa";

export interface SceneSubtitleTrackDto {
  id: string;
  sceneId: string;
  language: string;
  label: string | null;
  format: "vtt";
  source: SubtitleSource;
  sourceFormat: SubtitleSourceFormat;
  isDefault: boolean;
  url: string;
  /** Present when the server has preserved the original file (e.g. .ass). */
  sourceUrl: string | null;
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
  /** When true, the worker computes a Stash-compatible perceptual hash during fingerprint jobs. CPU-heavy; required for contributing fingerprints to StashDB/ThePornDB. */
  generatePhash: boolean;
  autoGeneratePreview: boolean;
  generateTrickplay: boolean;
  trickplayIntervalSeconds: number;
  previewClipDurationSeconds: number;
  thumbnailQuality: number;
  trickplayQuality: number;
  /** Parallel jobs per queue in the worker process (1–32). */
  backgroundWorkerConcurrency: number;
  nsfwLanAutoEnable: boolean;
  /**
   * When true, library scans add the library’s display name as the top folder (e.g. Shows → Series → Season).
   * When false, folders start at the first directory under the library path (Series → Season).
   */
  useLibraryRootAsFolder: boolean;
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
  /** Overall caption layer opacity (0.2–1.0). Applied to the full overlay including text, box, and shadows. */
  subtitleOpacity: number;
  /** Default playback mode the video player boots into on each new source. */
  defaultPlaybackMode: PlaybackMode;
  createdAt: string;
  updatedAt: string;
}

export const playbackModes = ["direct", "hls"] as const;
export type PlaybackMode = (typeof playbackModes)[number];

export function normalizePlaybackMode(value: unknown): PlaybackMode {
  return typeof value === "string" && (playbackModes as readonly string[]).includes(value)
    ? (value as PlaybackMode)
    : "direct";
}

export const subtitleDisplayStyles = ["stylized", "classic", "outline"] as const;
export type SubtitleDisplayStyle = (typeof subtitleDisplayStyles)[number];

export interface SubtitleAppearance {
  style: SubtitleDisplayStyle;
  fontScale: number;
  positionPercent: number;
  /** Overall caption layer opacity (0.2–1.0). */
  opacity: number;
}

export const defaultSubtitleAppearance: SubtitleAppearance = {
  style: "stylized",
  fontScale: 1,
  positionPercent: 88,
  opacity: 1,
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

// ─── Scene Folder DTOs ───────────────────────────────────────────

export interface SceneFolderListItemDto {
  id: string;
  title: string;
  customName: string | null;
  displayTitle: string;
  folderPath: string;
  relativePath: string;
  parentId: string | null;
  depth: number;
  isNsfw: boolean;
  coverImagePath: string | null;
  backdropImagePath: string | null;
  studioId: string | null;
  studioName: string | null;
  rating: number | null;
  date: string | null;
  directSceneCount: number;
  totalSceneCount: number;
  visibleSfwSceneCount: number;
  containsNsfwDescendants: boolean;
  childFolderCount: number;
  previewThumbnailPaths: string[];
  libraryRootId: string;
  libraryRootLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface SceneFolderBreadcrumbDto {
  id: string;
  title: string;
  displayTitle: string;
}

export interface SceneFolderDetailDto extends SceneFolderListItemDto {
  details: string | null;
  urls: string[];
  externalSeriesId: string | null;
  studio: { id: string; name: string } | null;
  performers: {
    id: string;
    name: string;
    gender: string | null;
    imagePath: string | null;
    isNsfw: boolean;
  }[];
  tags: TagEmbedDto[];
  breadcrumbs: SceneFolderBreadcrumbDto[];
  children: SceneFolderListItemDto[];
}

export interface SceneFolderPatchDto {
  isNsfw?: boolean;
  customName?: string | null;
  details?: string | null;
  studioName?: string | null;
  performerNames?: string[];
  tagNames?: string[];
  rating?: number | null;
  date?: string | null;
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
  isNsfw: boolean;
  pluginType: string;
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
  sceneId: string | null;
  entityType: string;
  entityId: string | null;
  scraperPackageId: string | null;
  stashBoxEndpointId: string | null;
  pluginPackageId: string | null;
  action: string;
  matchType: string | null;
  status: "pending" | "accepted" | "rejected";
  rawResult: unknown;
  proposedTitle: string | null;
  proposedDate: string | null;
  proposedDetails: string | null;
  proposedUrl: string | null;
  proposedUrls: string[] | null;
  proposedStudioName: string | null;
  proposedPerformerNames: string[] | null;
  proposedTagNames: string[] | null;
  proposedImageUrl: string | null;
  proposedEpisodeNumber: number | null;
  proposedFolderResult: unknown | null;
  proposedAudioResult: unknown | null;
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

// ─── Plugin DTOs ───────────────────────────────────────────────

export interface PluginPackageDto {
  id: string;
  pluginId: string;
  name: string;
  version: string;
  runtime: string;
  installPath: string;
  sha256: string | null;
  isNsfw: boolean;
  capabilities: Record<string, boolean> | null;
  enabled: boolean;
  sourceIndex: string | null;
  authStatus: "ok" | "missing" | null;
  authFields?: Array<{
    key: string;
    label: string;
    required: boolean;
    url?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PluginIndexEntryDto {
  id: string;
  name: string;
  version: string;
  date: string;
  path: string;
  sha256: string;
  runtime: string;
  isNsfw: boolean;
  capabilities: Record<string, boolean>;
  description?: string;
  author?: string;
  requires?: string[];
  installed?: boolean;
  installedVersion?: string;
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
  /** Linked galleries plus standalone images (SFW mode excludes NSFW entities). */
  imageAppearanceCount: number;
  audioLibraryCount: number;
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

export type EntityKind = "scene" | "scene-folder" | "performer" | "studio" | "tag" | "gallery" | "image" | "audio-library" | "audio-track";

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

// ─── Collection Types ──────────────────────────────────────────

export type CollectionMode = "manual" | "dynamic" | "hybrid";
export type CollectionCoverMode = "mosaic" | "custom" | "item";
export type CollectionEntityType = "scene" | "gallery" | "image" | "audio-track";
export type CollectionItemSource = "manual" | "dynamic";

// ─── Collection Rule Tree ──────────────────────────────────────

export type CollectionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "greater_equal"
  | "less_equal"
  | "between"
  | "in"
  | "not_in"
  | "is_null"
  | "is_not_null"
  | "is_true"
  | "is_false";

export type CollectionConditionValue =
  | string
  | number
  | boolean
  | string[]
  | [number, number]
  | null;

export interface CollectionRuleCondition {
  type: "condition";
  /** Entity types this condition applies to. Empty array = all types. */
  entityTypes: CollectionEntityType[];
  field: string;
  operator: CollectionOperator;
  value: CollectionConditionValue;
}

export interface CollectionRuleGroup {
  type: "group";
  operator: "and" | "or" | "not";
  children: (CollectionRuleCondition | CollectionRuleGroup)[];
}

export type CollectionRuleNode = CollectionRuleCondition | CollectionRuleGroup;

export type CollectionRuleFieldType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "relation"
  | "enum";

export interface CollectionRuleFieldDef {
  field: string;
  label: string;
  fieldType: CollectionRuleFieldType;
  /** Entity types this field is available for. Empty = all types. */
  entityTypes: CollectionEntityType[];
  /** For enum fields, the available values. */
  enumValues?: string[];
  /** Which operators are valid for this field type. */
  operators: CollectionOperator[];
}

export const COLLECTION_RULE_FIELDS: CollectionRuleFieldDef[] = [
  // Universal fields (apply to all entity types)
  { field: "title", label: "Title", fieldType: "text", entityTypes: [], operators: ["contains", "not_contains", "equals", "not_equals"] },
  { field: "rating", label: "Rating", fieldType: "number", entityTypes: [], operators: ["equals", "not_equals", "greater_than", "less_than", "greater_equal", "less_equal", "between", "is_null", "is_not_null"] },
  { field: "date", label: "Date", fieldType: "date", entityTypes: [], operators: ["equals", "not_equals", "greater_than", "less_than", "between", "is_null", "is_not_null"] },
  { field: "organized", label: "Organized", fieldType: "boolean", entityTypes: [], operators: ["is_true", "is_false"] },
  { field: "isNsfw", label: "NSFW", fieldType: "boolean", entityTypes: [], operators: ["is_true", "is_false"] },
  { field: "tags", label: "Tags", fieldType: "relation", entityTypes: [], operators: ["in", "not_in"] },
  { field: "performers", label: "Performers", fieldType: "relation", entityTypes: [], operators: ["in", "not_in"] },
  { field: "studio", label: "Studio", fieldType: "relation", entityTypes: [], operators: ["in", "not_in", "is_null", "is_not_null"] },
  { field: "createdAt", label: "Added Date", fieldType: "date", entityTypes: [], operators: ["greater_than", "less_than", "between"] },
  { field: "fileSize", label: "File Size", fieldType: "number", entityTypes: ["scene", "image", "audio-track"], operators: ["greater_than", "less_than", "between"] },

  // Scene-specific
  { field: "duration", label: "Duration", fieldType: "number", entityTypes: ["scene", "audio-track"], operators: ["greater_than", "less_than", "between", "is_null", "is_not_null"] },
  { field: "resolution", label: "Resolution", fieldType: "enum", entityTypes: ["scene"], operators: ["in", "not_in"], enumValues: ["4K", "1080p", "720p", "480p"] },
  { field: "codec", label: "Codec", fieldType: "text", entityTypes: ["scene"], operators: ["equals", "not_equals", "in", "not_in"] },
  { field: "interactive", label: "Interactive", fieldType: "boolean", entityTypes: ["scene"], operators: ["is_true", "is_false"] },
  { field: "playCount", label: "Play Count", fieldType: "number", entityTypes: ["scene", "audio-track"], operators: ["equals", "greater_than", "less_than", "greater_equal", "less_equal", "between"] },
  { field: "sceneFolderId", label: "Scene Folder", fieldType: "relation", entityTypes: ["scene"], operators: ["equals", "in", "not_in"] },

  // Gallery-specific
  { field: "galleryType", label: "Gallery Type", fieldType: "enum", entityTypes: ["gallery"], operators: ["equals", "not_equals", "in"], enumValues: ["folder", "zip", "virtual"] },
  { field: "imageCount", label: "Image Count", fieldType: "number", entityTypes: ["gallery"], operators: ["greater_than", "less_than", "greater_equal", "less_equal", "between"] },

  // Image-specific
  { field: "width", label: "Width", fieldType: "number", entityTypes: ["image"], operators: ["greater_than", "less_than", "between"] },
  { field: "height", label: "Height", fieldType: "number", entityTypes: ["image"], operators: ["greater_than", "less_than", "between"] },
  { field: "format", label: "Format", fieldType: "text", entityTypes: ["image"], operators: ["equals", "not_equals", "in", "not_in"] },

  // Audio-specific
  { field: "bitRate", label: "Bit Rate", fieldType: "number", entityTypes: ["audio-track"], operators: ["greater_than", "less_than", "between"] },
  { field: "channels", label: "Channels", fieldType: "number", entityTypes: ["audio-track"], operators: ["equals", "greater_than", "less_than"] },
];

// ─── Collection DTOs ───────────────────────────────────────────

export interface CollectionListItemDto {
  id: string;
  name: string;
  description: string | null;
  mode: CollectionMode;
  itemCount: number;
  coverMode: CollectionCoverMode;
  coverImagePath: string | null;
  slideshowDurationSeconds: number;
  slideshowAutoAdvance: boolean;
  /** Breakdown of items by entity type. */
  typeCounts: Record<CollectionEntityType, number>;
  lastRefreshedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionDetailDto extends CollectionListItemDto {
  ruleTree: CollectionRuleGroup | null;
  coverItemId: string | null;
  coverItemType: CollectionEntityType | null;
}

export interface CollectionItemDto {
  id: string;
  collectionId: string;
  entityType: CollectionEntityType;
  entityId: string;
  source: CollectionItemSource;
  sortOrder: number;
  addedAt: string;
  /**
   * Polymorphic entity embed — exactly one of these is populated based on
   * entityType. The shape matches the respective list-item endpoint response
   * (SceneListItem, GalleryListItemDto, ImageListItemDto, AudioTrackListItemDto).
   */
  entity: Record<string, unknown> | null;
}

export interface CollectionCreateDto {
  name: string;
  description?: string;
  mode?: CollectionMode;
  ruleTree?: CollectionRuleGroup;
  slideshowDurationSeconds?: number;
  slideshowAutoAdvance?: boolean;
}

export interface CollectionPatchDto {
  name?: string;
  description?: string | null;
  mode?: CollectionMode;
  ruleTree?: CollectionRuleGroup | null;
  coverMode?: CollectionCoverMode;
  coverItemId?: string | null;
  coverItemType?: CollectionEntityType | null;
  slideshowDurationSeconds?: number;
  slideshowAutoAdvance?: boolean;
}

export interface CollectionAddItemsDto {
  items: { entityType: CollectionEntityType; entityId: string }[];
}

export interface CollectionRemoveItemsDto {
  itemIds: string[];
}

export interface CollectionReorderDto {
  /** Ordered list of item IDs — position in array becomes sortOrder. */
  itemIds: string[];
}

export interface CollectionRulePreviewDto {
  total: number;
  byType: Record<CollectionEntityType, number>;
  sample: CollectionItemDto[];
}

// ─── Scene DTOs ─────────────────────────────────────────────────

export interface SceneListItemDto {
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
  sceneFolderId: string | null;
  sceneFolderTitle: string | null;
  hasSubtitles: boolean;
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

export interface SceneDetailDto extends SceneListItemDto {
  interactive: boolean;
  frameRate: number | null;
  bitRate: number | null;
  previewPath: string | null;
  playDuration: number | null;
  resumeTime: number | null;
  lastPlayedAt: string | null;
  url: string | null;
  urls: string[];
  episodeNumber: number | null;
  studio: { id: string; name: string; url: string | null } | null;
  markers: SceneMarkerDto[];
  subtitleTracks: SceneSubtitleTrackDto[];
}

export interface SceneMarkerDto {
  id: string;
  title: string;
  seconds: number;
  endSeconds: number | null;
}

export interface SceneStatsDto {
  totalScenes: number;
  totalDuration: number;
  totalDurationFormatted: string;
  totalSize: number;
  totalSizeFormatted: string;
  totalPlays: number;
  recentCount: number;
}

// ─── Studio DTOs ────────────────────────────────────────────────

export interface StudioListItemDto {
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

export interface StudioParentRefDto {
  id: string;
  name: string;
  imagePath: string | null;
  imageUrl: string | null;
}

export interface StudioChildRefDto {
  id: string;
  name: string;
  imagePath: string | null;
  imageUrl: string | null;
  sceneCount: number;
}

export interface StudioDetailDto {
  id: string;
  name: string;
  description: string | null;
  aliases: string | null;
  url: string | null;
  parentId: string | null;
  parent: StudioParentRefDto | null;
  childStudios: StudioChildRefDto[];
  imageUrl: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  isNsfw: boolean;
  sceneCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Tag DTOs ───────────────────────────────────────────────────

export interface TagListItemDto {
  id: string;
  name: string;
  sceneCount: number;
  imageCount: number;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  isNsfw: boolean;
}

export interface TagDetailDto {
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

// ─── Scrape / StashBox Result DTOs ──────────────────────────────

export interface NormalizedSceneScrapeResultDto {
  title: string | null;
  date: string | null;
  details: string | null;
  url: string | null;
  studioName: string | null;
  performerNames: string[];
  tagNames: string[];
  imageUrl: string | null;
}

export interface NormalizedStudioScrapeResultDto {
  name: string | null;
  url: string | null;
  imageUrl: string | null;
  parentName: string | null;
}

export interface NormalizedTagScrapeResultDto {
  name: string | null;
  description: string | null;
  aliases: string | null;
}

export interface StashIdEntryDto {
  id: string;
  entityType: string;
  entityId: string;
  endpointId: string;
  endpointName: string;
  stashId: string;
  createdAt: string;
}

export interface StashBoxStudioResultDto {
  id: string;
  name: string;
  aliases: string[];
  urls: { url: string; type: string }[];
  parent: { id: string; name: string } | null;
  images: { id: string; url: string; width: number; height: number }[];
}

export interface StashBoxTagResultDto {
  id: string;
  name: string;
  description: string | null;
  aliases: string[];
  category: { id: string; name: string; description: string | null } | null;
}

export * from "./external-ids";

export type {
  ImageCandidate,
  NormalizedCastMember,
  NormalizedMovieResult,
  NormalizedSeriesResult,
  NormalizedSeriesCandidate,
  NormalizedSeasonResult,
  NormalizedEpisodeResult,
} from "./normalized-video";

