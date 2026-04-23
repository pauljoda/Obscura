import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  ConflictError,
  InternalError,
  NotFoundError,
  UpstreamError,
  ValidationError,
  acknowledgeFailedJobsWrite,
  backfillPhashesWrite,
  cancelAllJobsWrite,
  cancelJobRunWrite,
  cancelQueueWrite,
  clearMetadataWrite,
  getJobsDashboardRead,
  migrateVideoAssetStorageWrite,
  rebuildPreviewsWrite,
  rebuildVideoPreviewWrite,
  runQueueWrite,
} from "@obscura/app-core";
import { db } from "../db";
import { enqueueQueueJob } from "../lib/job-enqueue";
import { cancelJob, deleteJob } from "../lib/queues";
import { AppError } from "../plugins/error-handler";

const jobsWriteDeps = {
  enqueueJob: enqueueQueueJob,
  cancelJob,
  deleteJob,
};

const videoWriteDeps = {
  enqueueJob: enqueueQueueJob,
};

function readSfwOnly(request: FastifyRequest): boolean {
  const body = request.body as { nsfw?: string } | undefined;
  if (body && typeof body === "object" && body.nsfw === "off") {
    return true;
  }
  const query = request.query as { nsfw?: string } | undefined;
  if (query && typeof query === "object" && query.nsfw === "off") {
    return true;
  }
  const raw = request.headers["x-obscura-nsfw-mode"];
  const headerVal = Array.isArray(raw) ? raw[0] : raw;
  return headerVal === "off";
}

function rethrowAppCoreError(error: unknown): never {
  if (error instanceof NotFoundError) throw new AppError(404, error.message);
  if (error instanceof ValidationError) throw new AppError(400, error.message);
  if (error instanceof UpstreamError) throw new AppError(502, error.message);
  if (error instanceof ConflictError) throw new AppError(409, error.message);
  if (error instanceof InternalError) throw new AppError(500, error.message);
  throw error;
}

export async function jobsRoutes(app: FastifyInstance) {
  app.get("/jobs", async (request) => {
    try {
      return await getJobsDashboardRead(db, readSfwOnly(request));
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  app.post("/jobs/queues/:queueName/run", async (request) => {
    try {
      const { queueName } = request.params as { queueName: string };
      return await runQueueWrite(
        db,
        {
          queueName,
          sfwOnly: readSfwOnly(request),
        },
        jobsWriteDeps,
      );
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  app.post("/jobs/:jobRunId/cancel", async (request) => {
    try {
      const { jobRunId } = request.params as { jobRunId: string };
      return await cancelJobRunWrite(db, { jobRunId }, jobsWriteDeps);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  app.post("/jobs/cancel-all", async () => {
    try {
      return await cancelAllJobsWrite(db, jobsWriteDeps);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  app.post("/jobs/queues/:queueName/cancel", async (request) => {
    try {
      const { queueName } = request.params as { queueName: string };
      return await cancelQueueWrite(db, { queueName }, jobsWriteDeps);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  app.post("/jobs/phash-backfill", async (request) => {
    try {
      return await backfillPhashesWrite(
        db,
        { sfwOnly: readSfwOnly(request) },
        jobsWriteDeps,
      );
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  app.post("/jobs/rebuild-preview/:id", async (request) => {
    try {
      const { id } = request.params as { id: string };
      return await rebuildVideoPreviewWrite(db, id, videoWriteDeps);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  app.post("/jobs/rebuild-previews", async (request) => {
    try {
      return await rebuildPreviewsWrite(
        db,
        { sfwOnly: readSfwOnly(request) },
        jobsWriteDeps,
      );
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  app.post("/jobs/migrate-video-asset-storage", async (request) => {
    try {
      const body = (request.body ?? {}) as { targetDedicated?: unknown };
      return await migrateVideoAssetStorageWrite(
        db,
        {
          targetDedicated: body.targetDedicated as boolean,
          sfwOnly: readSfwOnly(request),
        },
        jobsWriteDeps,
      );
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  app.post("/jobs/acknowledge-failed", async (request) => {
    try {
      const body = (request.body ?? {}) as { queueName?: string };
      return await acknowledgeFailedJobsWrite(db, body, jobsWriteDeps);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  app.post("/jobs/clear-metadata", async () => {
    try {
      return await clearMetadataWrite(db, jobsWriteDeps);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });
}
