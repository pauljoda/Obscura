export const apiRoutes = {
  health: "/health",
  jobs: "/jobs",
  jobQueueRun: "/jobs/queues/:queueName/run",
  sceneAssets: "/assets/scenes/:id/*",
  libraries: "/libraries",
  libraryDetail: "/libraries/:id",
  libraryBrowse: "/libraries/browse",
  librarySettings: "/settings/library",
  scenes: "/scenes",
  sceneDetail: "/scenes/:id",
  sceneStats: "/scenes/stats",
  galleries: "/galleries",
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
] as const;

export type QueueName = (typeof queueDefinitions)[number]["name"];

export const jobStatuses = [
  "waiting",
  "active",
  "completed",
  "failed",
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
  createdAt: string;
  updatedAt: string;
}

export interface StorageStatsDto {
  thumbnailsBytes: number;
  previewsBytes: number;
  trickplayBytes: number;
  totalBytes: number;
}

/** Image gallery folder discovered by the library (list endpoint; empty until gallery ingest ships). */
export interface GalleryListItemDto {
  id: string;
  title: string;
  coverImagePath: string | null;
  imageCount: number;
  createdAt: string;
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
  action: string;
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
