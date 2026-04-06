import { existsSync, unlinkSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNull, not, like, or } from "drizzle-orm";
import { queueDefinitions, type QueueName } from "@obscura/contracts";
import { getSidecarPaths } from "@obscura/media-core";
import { db, schema } from "../db";
import { ensureLibrarySettingsRow } from "../lib/library";
import { getQueue } from "../lib/queues";

const { jobRuns, libraryRoots, scenes } = schema;

function toJobRunDto(job: typeof jobRuns.$inferSelect) {
  return {
    ...job,
    progress: job.progress ?? 0,
  };
}

async function recordQueuedJob(input: {
  queueName: QueueName;
  bullmqJobId: string;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  payload?: Record<string, unknown>;
}) {
  await db.insert(jobRuns).values({
    queueName: input.queueName,
    bullmqJobId: input.bullmqJobId,
    status: "waiting",
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    targetLabel: input.targetLabel ?? null,
    payload: input.payload ?? {},
  });
}

async function enqueueLibraryScans() {
  const roots = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.enabled, true))
    .orderBy(libraryRoots.path);

  const queue = getQueue("library-scan");
  const createdJobIds: string[] = [];

  for (const root of roots) {
    const job = await queue.add(
      "library-root-scan",
      { libraryRootId: root.id, path: root.path, recursive: root.recursive },
      { jobId: `library-scan:${root.id}:${Date.now()}` }
    );

    await recordQueuedJob({
      queueName: "library-scan",
      bullmqJobId: String(job.id),
      targetType: "library-root",
      targetId: root.id,
      targetLabel: root.label,
      payload: { path: root.path },
    });

    createdJobIds.push(String(job.id));
  }

  return createdJobIds;
}

async function enqueueMissingSceneJobs(queueName: QueueName) {
  const queue = getQueue(queueName);
  let sceneRows: Array<{ id: string; title: string }> = [];

  if (queueName === "media-probe") {
    sceneRows = await db
      .select({ id: scenes.id, title: scenes.title })
      .from(scenes)
      .where(or(isNull(scenes.duration), isNull(scenes.width), isNull(scenes.codec))!);
  } else if (queueName === "fingerprint") {
    sceneRows = await db
      .select({ id: scenes.id, title: scenes.title })
      .from(scenes)
      .where(or(isNull(scenes.checksumMd5), isNull(scenes.oshash))!);
  } else if (queueName === "preview") {
    // Regenerate previews for scenes missing assets OR scenes without
    // a user-set custom thumbnail so quality setting changes take effect.
    sceneRows = await db
      .select({ id: scenes.id, title: scenes.title })
      .from(scenes)
      .where(
        or(
          isNull(scenes.thumbnailPath),
          isNull(scenes.previewPath),
          isNull(scenes.spritePath),
          isNull(scenes.trickplayVttPath),
          not(like(scenes.thumbnailPath, "%thumb-custom%"))
        )!
      );
  } else if (queueName === "metadata-import") {
    sceneRows = await db
      .select({ id: scenes.id, title: scenes.title })
      .from(scenes)
      .limit(25);
  }

  const createdJobIds: string[] = [];

  for (const scene of sceneRows) {
    const job = await queue.add(
      `scene-${queueName}`,
      { sceneId: scene.id },
      { jobId: `${queueName}:${scene.id}:${Date.now()}` }
    );

    await recordQueuedJob({
      queueName,
      bullmqJobId: String(job.id),
      targetType: "scene",
      targetId: scene.id,
      targetLabel: scene.title,
      payload: { sceneId: scene.id },
    });

    createdJobIds.push(String(job.id));
  }

  return createdJobIds;
}

export async function jobsRoutes(app: FastifyInstance) {
  app.get("/jobs", async () => {
    const settings = await ensureLibrarySettingsRow();
    const [latestScan] = await db
      .select({ finishedAt: jobRuns.finishedAt })
      .from(jobRuns)
      .where(and(eq(jobRuns.queueName, "library-scan"), eq(jobRuns.status, "completed")))
      .orderBy(desc(jobRuns.finishedAt))
      .limit(1);

    const queues = await Promise.all(
      queueDefinitions.map(async (definition) => {
        const queue = getQueue(definition.name);
        const counts = await queue.getJobCounts("active", "waiting", "completed", "failed");
        const status =
          counts.failed > 0 ? "warning" : counts.active > 0 || counts.waiting > 0 ? "active" : "idle";

        return {
          name: definition.name,
          description: definition.description,
          status,
          active: counts.active ?? 0,
          waiting: counts.waiting ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
        };
      })
    );

    const activeJobs = await db
      .select()
      .from(jobRuns)
      .where(inArray(jobRuns.status, ["waiting", "active", "delayed"]))
      .orderBy(desc(jobRuns.updatedAt))
      .limit(12);

    const recentJobs = await db
      .select()
      .from(jobRuns)
      .orderBy(desc(jobRuns.createdAt))
      .limit(18);

    return {
      queues,
      activeJobs: activeJobs.map(toJobRunDto),
      recentJobs: recentJobs.map(toJobRunDto),
      lastScanAt: latestScan?.finishedAt ?? null,
      schedule: {
        enabled: settings.autoScanEnabled,
        intervalMinutes: settings.scanIntervalMinutes,
      },
    };
  });

  app.post("/jobs/queues/:queueName/run", async (request, reply) => {
    const { queueName } = request.params as { queueName: QueueName };

    if (!queueDefinitions.find((definition) => definition.name === queueName)) {
      reply.code(404);
      return { error: "Unknown queue" };
    }

    const jobIds =
      queueName === "library-scan"
        ? await enqueueLibraryScans()
        : await enqueueMissingSceneJobs(queueName);

    return {
      ok: true,
      queueName,
      enqueued: jobIds.length,
      jobIds,
    };
  });

  // ─── Cancel all jobs in a queue ────────────────────────────────
  app.post("/jobs/queues/:queueName/cancel", async (request, reply) => {
    const { queueName } = request.params as { queueName: QueueName };

    if (!queueDefinitions.find((definition) => definition.name === queueName)) {
      reply.code(404);
      return { error: "Unknown queue" };
    }

    const queue = getQueue(queueName);

    // Remove waiting jobs
    const waitingRemoved = await queue.drain();

    // Remove active jobs
    const activeJobs = await queue.getActive();
    let activeRemoved = 0;
    for (const job of activeJobs) {
      try {
        await job.moveToFailed(new Error("Cancelled by user"), "0", true);
        activeRemoved += 1;
      } catch {
        // Job may have already completed
      }
    }

    // Mark in-progress job_runs as dismissed
    await db
      .update(jobRuns)
      .set({ status: "dismissed", error: "Cancelled by user", updatedAt: new Date() })
      .where(
        and(
          eq(jobRuns.queueName, queueName),
          inArray(jobRuns.status, ["queued", "active"])
        )
      );

    // Clean up the failed jobs we just created
    await queue.clean(0, 100_000, "failed");

    return {
      ok: true,
      queueName,
      waitingRemoved: typeof waitingRemoved === "undefined" ? 0 : 1,
      activeRemoved,
    };
  });

  // ─── Diagnostics: force-rebuild previews ──────────────────────
  app.post("/jobs/rebuild-preview/:sceneId", async (request, reply) => {
    const { sceneId } = request.params as { sceneId: string };
    const scene = await db.query.scenes.findFirst({
      where: eq(scenes.id, sceneId),
      columns: { id: true, title: true, filePath: true },
    });

    if (!scene) {
      reply.code(404);
      return { error: "Scene not found" };
    }

    // Delete existing sidecar files so stale assets aren't served
    if (scene.filePath) {
      const sidecar = getSidecarPaths(scene.filePath);
      for (const file of Object.values(sidecar)) {
        try {
          if (existsSync(file)) unlinkSync(file);
        } catch {
          // ignore — file may already be gone
        }
      }
    }

    await db
      .update(scenes)
      .set({
        thumbnailPath: null,
        cardThumbnailPath: null,
        previewPath: null,
        spritePath: null,
        trickplayVttPath: null,
        updatedAt: new Date(),
      })
      .where(eq(scenes.id, sceneId));

    const queue = getQueue("preview");
    const job = await queue.add(
      "scene-preview",
      { sceneId },
      { jobId: `preview:${sceneId}:${Date.now()}` }
    );

    await recordQueuedJob({
      queueName: "preview",
      bullmqJobId: String(job.id),
      targetType: "scene",
      targetId: scene.id,
      targetLabel: scene.title,
      payload: { sceneId },
    });

    return { ok: true, jobId: String(job.id) };
  });

  app.post("/jobs/rebuild-previews", async (_request, reply) => {
    // Clear all generated preview asset paths so every scene is re-queued
    await db
      .update(scenes)
      .set({
        thumbnailPath: null,
        cardThumbnailPath: null,
        previewPath: null,
        spritePath: null,
        trickplayVttPath: null,
        updatedAt: new Date(),
      });

    const jobIds = await enqueueMissingSceneJobs("preview");

    return {
      ok: true,
      enqueued: jobIds.length,
      jobIds,
    };
  });

  app.post("/jobs/acknowledge-failed", async (request, reply) => {
    const body = (request.body ?? {}) as { queueName?: QueueName };
    const queueName = body.queueName;

    if (
      queueName !== undefined &&
      !queueDefinitions.find((definition) => definition.name === queueName)
    ) {
      reply.code(400);
      return { error: "Unknown queue" };
    }

    const targetQueues = queueName
      ? [queueName]
      : (queueDefinitions.map((definition) => definition.name) as QueueName[]);

    const redisRemovedByQueue: Record<string, number> = {};
    let redisRemovedTotal = 0;

    for (const name of targetQueues) {
      const queue = getQueue(name);
      const removedIds = await queue.clean(0, 100_000, "failed");
      redisRemovedByQueue[name] = removedIds.length;
      redisRemovedTotal += removedIds.length;
    }

    const whereClause =
      queueName !== undefined
        ? and(eq(jobRuns.status, "failed"), eq(jobRuns.queueName, queueName))
        : eq(jobRuns.status, "failed");

    const updatedRows = await db
      .update(jobRuns)
      .set({
        status: "dismissed",
        error: null,
        updatedAt: new Date(),
      })
      .where(whereClause)
      .returning({ id: jobRuns.id });

    return {
      ok: true,
      queueName: queueName ?? null,
      redisRemoved: redisRemovedTotal,
      redisRemovedByQueue,
      runsUpdated: updatedRows.length,
    };
  });
}
