export const apiRoutes = {
  health: "/health",
  jobs: "/jobs"
} as const;

export const queueDefinitions = [
  { name: "library-scan", description: "Discovers files in configured media roots" },
  { name: "media-probe", description: "Extracts technical metadata using ffprobe" },
  { name: "fingerprint", description: "Generates md5, oshash, and perceptual fingerprints" },
  { name: "preview", description: "Builds thumbnails, posters, and contact sheets" },
  { name: "metadata-import", description: "Coordinates stash bootstrap imports and provider application" }
] as const;

export type QueueName = (typeof queueDefinitions)[number]["name"];

