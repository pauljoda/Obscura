export const apiRoutes = {
  health: "/health",
  jobs: "/jobs",
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
  { name: "preview", description: "Builds thumbnails, posters, and contact sheets" },
  { name: "metadata-import", description: "Coordinates stash bootstrap imports and provider application" }
] as const;

export type QueueName = (typeof queueDefinitions)[number]["name"];

