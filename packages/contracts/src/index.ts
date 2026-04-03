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
  studios: "/studios",
  performers: "/performers",
  tags: "/tags",
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
