import {
  acceptPluginResultWrite,
  executePluginWrite,
  getAudioLibraryDetailRead,
  getGalleriesByIdsRead,
  getImagesByIdsRead,
  getPerformerByIdRead,
  getStudioByIdRead,
  getTagByIdRead,
  getTracksByIdsRead,
  getVideosByIdsRead,
  getVideoSeriesDetailRead,
  NotFoundError,
  ValidationError,
} from "@obscura/app-core";
import type { AppDb } from "@obscura/db";

export interface StartPluginBatchInput {
  pluginId?: string;
  action: string;
  entityType: string;
  entityIds: string[];
  autoAccept?: boolean;
  folderCascade?: boolean;
}

export interface PluginBatchItemStatus {
  entityId: string;
  status: "pending" | "found" | "accepted" | "no-result" | "error";
  scrapeResultId: string | null;
  message: string | null;
  normalized: Record<string, unknown> | null;
}

export interface PluginBatchJobStatus {
  jobId: string;
  pluginId: string | null;
  action: string;
  entityType: string;
  autoAccept: boolean;
  folderCascade: boolean;
  status: "running" | "completed" | "failed";
  total: number;
  completed: number;
  accepted: number;
  found: number;
  noResult: number;
  failed: number;
  startedAt: string;
  finishedAt: string | null;
  items: PluginBatchItemStatus[];
}

interface BatchTarget {
  entityId: string;
  input: Record<string, unknown>;
}

const batchJobs = new Map<string, PluginBatchJobStatus>();

function buildLocalSeasonsInput(detail: unknown) {
  if (!detail || typeof detail !== "object") {
    return {};
  }

  const seasons = Array.isArray((detail as { seasons?: unknown }).seasons)
    ? ((detail as { seasons: Array<Record<string, unknown>> }).seasons ?? [])
    : [];

  const localSeasons = seasons
    .map((season) => {
      const episodes = Array.isArray(season.episodes)
        ? season.episodes
        : [];

      return {
        seasonNumber:
          typeof season.seasonNumber === "number" ? season.seasonNumber : 0,
        episodes: episodes
          .filter(
            (
              episode,
            ): episode is {
              episodeNumber: number;
              filePath: string;
              title?: string | null;
            } =>
              !!episode &&
              typeof episode === "object" &&
              typeof (episode as { episodeNumber?: unknown }).episodeNumber ===
                "number" &&
              typeof (episode as { filePath?: unknown }).filePath === "string",
          )
          .map((episode) => ({
            episodeNumber: episode.episodeNumber,
            localFilePath: episode.filePath,
            title: episode.title ?? null,
          })),
      };
    })
    .filter((season) => season.episodes.length > 0);

  return localSeasons.length > 0 ? { localSeasons } : {};
}

function findRequired<T extends { id: string }>(
  rows: T[],
  id: string,
  label: string,
): T {
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) {
    throw new NotFoundError(`${label} not found`);
  }
  return row;
}

async function resolveBatchTargets(
  db: AppDb,
  entityType: string,
  entityIds: string[],
): Promise<BatchTarget[]> {
  if (entityIds.length === 0) {
    return [];
  }

  switch (entityType) {
    case "video":
    case "video_episode":
    case "video_movie": {
      const videos = await getVideosByIdsRead(db, entityIds);
      return entityIds.map((entityId) => {
        const video = findRequired(videos, entityId, "Video");
        return {
          entityId,
          input: {
            title: video.title,
            name: video.title,
            date: video.date,
            details: video.details,
            url: null,
            filePath: video.filePath,
          },
        };
      });
    }
    case "video_series": {
      return Promise.all(
        entityIds.map(async (entityId) => {
          const series = await getVideoSeriesDetailRead(db, entityId);
          return {
            entityId,
            input: {
              title: series.title,
              name: series.title,
              date: series.date,
              details: series.details,
              url: series.urls[0] ?? null,
              externalId: series.externalSeriesId,
              ...buildLocalSeasonsInput(series),
            },
          };
        }),
      );
    }
    case "gallery": {
      const galleries = await getGalleriesByIdsRead(db, entityIds);
      return entityIds.map((entityId) => {
        const gallery = findRequired(galleries, entityId, "Gallery");
        return {
          entityId,
          input: {
            title: gallery.title,
            name: gallery.title,
            date: gallery.date,
            photographer: gallery.photographer,
          },
        };
      });
    }
    case "image": {
      const images = await getImagesByIdsRead(db, entityIds);
      return entityIds.map((entityId) => {
        const image = findRequired(images, entityId, "Image");
        return {
          entityId,
          input: {
            title: image.title,
            name: image.title,
            date: image.date,
            filePath: image.fullPath,
          },
        };
      });
    }
    case "audio_library": {
      return Promise.all(
        entityIds.map(async (entityId) => {
          const library = await getAudioLibraryDetailRead(db, entityId);
          return {
            entityId,
            input: {
              title: library.title,
              name: library.title,
              date: library.date,
              details: library.details,
            },
          };
        }),
      );
    }
    case "audio_track": {
      const tracks = await getTracksByIdsRead(db, entityIds);
      return entityIds.map((entityId) => {
        const track = findRequired(tracks, entityId, "Audio track");
        return {
          entityId,
          input: {
            title: track.title,
            name: track.title,
            date: track.date,
            artist: track.embeddedArtist,
            album: track.embeddedAlbum,
          },
        };
      });
    }
    case "performer": {
      return Promise.all(
        entityIds.map(async (entityId) => {
          const performer = await getPerformerByIdRead(db, entityId, false);
          if (!performer) {
            throw new NotFoundError("Performer not found");
          }
          return {
            entityId,
            input: {
              title: performer.name,
              name: performer.name,
            },
          };
        }),
      );
    }
    case "studio": {
      return Promise.all(
        entityIds.map(async (entityId) => {
          const studio = await getStudioByIdRead(db, entityId, false);
          if (!studio) {
            throw new NotFoundError("Studio not found");
          }
          return {
            entityId,
            input: {
              title: studio.name,
              name: studio.name,
              url: studio.url,
            },
          };
        }),
      );
    }
    case "tag": {
      return Promise.all(
        entityIds.map(async (entityId) => {
          const tag = await getTagByIdRead(db, entityId, false);
          if (!tag) {
            throw new NotFoundError("Tag not found");
          }
          return {
            entityId,
            input: {
              title: tag.name,
              name: tag.name,
            },
          };
        }),
      );
    }
    default:
      throw new ValidationError(`Unsupported plugin batch entityType: ${entityType}`);
  }
}

export function getPluginBatchJobStatus(jobId: string): PluginBatchJobStatus | null {
  return batchJobs.get(jobId) ?? null;
}

export async function startPluginBatchJob(
  db: AppDb,
  input: StartPluginBatchInput,
): Promise<PluginBatchJobStatus> {
  if (!input.pluginId) {
    throw new ValidationError("pluginId is required");
  }
  if (!input.action) {
    throw new ValidationError("action is required");
  }
  if (!Array.isArray(input.entityIds) || input.entityIds.length === 0) {
    throw new ValidationError("entityIds must contain at least one id");
  }

  const targets = await resolveBatchTargets(db, input.entityType, input.entityIds);
  const jobId = crypto.randomUUID();
  const job: PluginBatchJobStatus = {
    jobId,
    pluginId: input.pluginId,
    action: input.action,
    entityType: input.entityType,
    autoAccept: input.autoAccept ?? false,
    folderCascade: input.folderCascade ?? false,
    status: "running",
    total: targets.length,
    completed: 0,
    accepted: 0,
    found: 0,
    noResult: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    items: targets.map((target) => ({
      entityId: target.entityId,
      status: "pending",
      scrapeResultId: null,
      message: null,
      normalized: null,
    })),
  };

  batchJobs.set(jobId, job);

  try {
    for (const [index, target] of targets.entries()) {
      try {
        const result = await executePluginWrite(db, {
          pluginDbId: input.pluginId,
          action: input.action,
          entityId: target.entityId,
          input: target.input,
          saveResult: true,
        });

        const saved =
          result.result && typeof result.result === "object" && "id" in result.result
            ? (result.result as { id: string })
            : null;

        if (saved?.id) {
          job.items[index] = {
            entityId: target.entityId,
            status: input.autoAccept ? "accepted" : "found",
            scrapeResultId: saved.id,
            message: null,
            normalized:
              result.normalized && typeof result.normalized === "object"
                ? (result.normalized as Record<string, unknown>)
                : null,
          };

          if (input.autoAccept) {
            await acceptPluginResultWrite(db, { scrapeResultId: saved.id });
            job.accepted += 1;
          } else {
            job.found += 1;
          }
        } else {
          job.items[index] = {
            entityId: target.entityId,
            status: "no-result",
            scrapeResultId: null,
            message: "Plugin returned no saved scrape result",
            normalized: null,
          };
          job.noResult += 1;
        }
      } catch (error) {
        job.items[index] = {
          entityId: target.entityId,
          status: "error",
          scrapeResultId: null,
          message: error instanceof Error ? error.message : String(error),
          normalized: null,
        };
        job.failed += 1;
      } finally {
        job.completed += 1;
      }
    }

    job.status = "completed";
    job.finishedAt = new Date().toISOString();
    return job;
  } catch (error) {
    job.status = "failed";
    job.finishedAt = new Date().toISOString();
    throw error;
  }
}
