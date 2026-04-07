import { existsSync, unlinkSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, inArray, isNull, like, not, or, sql } from "drizzle-orm";
import {
  queueDefinitions,
  type JobTriggerKind,
  type QueueName,
} from "@obscura/contracts";
import { getSidecarPaths } from "@obscura/media-core";
import { db, schema } from "../db";
import { ensureLibrarySettingsRow } from "../lib/library";
import { getQueue } from "../lib/queues";

const { jobRuns, libraryRoots, scenes } = schema;

type JobPayload = Record<string, unknown> & {
  triggeredBy?: JobTriggerKind;
  triggerLabel?: string;
};

type QueueTarget = {
  type?: string | null;
  id?: string | null;
  label?: string | null;
};

type QueueTrigger = {
  by?: JobTriggerKind;
  label?: string | null;
};

function getQueueDefinition(queueName: QueueName) {
  return queueDefinitions.find((definition) => definition.name === queueName)!;
}

function withTriggerMetadata(
  payload: Record<string, unknown>,
  trigger: QueueTrigger = {}
): JobPayload {
  return {
    ...payload,
    ...(trigger.by ? { triggeredBy: trigger.by } : {}),
    ...(trigger.label ? { triggerLabel: trigger.label } : {}),
  };
}

function readTriggerMetadata(payload: unknown): QueueTrigger {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const meta = payload as JobPayload;
  return {
    by: meta.triggeredBy ?? undefined,
    label: typeof meta.triggerLabel === "string" ? meta.triggerLabel : undefined,
  };
}

function toJobRunDto(job: typeof jobRuns.$inferSelect) {
  const queueDefinition = getQueueDefinition(job.queueName as QueueName);
  const trigger = readTriggerMetadata(job.payload);

  return {
    ...job,
    queueLabel: queueDefinition.label,
    triggeredBy: trigger.by ?? null,
    triggerLabel: trigger.label ?? null,
    progress: job.progress ?? 0,
  };
}

async function hasPendingJob(queueName: QueueName, target: QueueTarget) {
  if (!target.id) {
    return false;
  }

  const predicates = [
    eq(jobRuns.queueName, queueName),
    eq(jobRuns.targetId, target.id),
    inArray(jobRuns.status, ["waiting", "active", "delayed"]),
  ];

  if (target.type) {
    predicates.push(eq(jobRuns.targetType, target.type));
  }

  const [pending] = await db
    .select({ id: jobRuns.id })
    .from(jobRuns)
    .where(and(...predicates))
    .limit(1);

  return Boolean(pending);
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

async function enqueueQueueJob(input: {
  queueName: QueueName;
  jobName: string;
  data: Record<string, unknown>;
  target: QueueTarget;
  trigger?: QueueTrigger;
}) {
  if (await hasPendingJob(input.queueName, input.target)) {
    return null;
  }

  const queue = getQueue(input.queueName);
  const payload = withTriggerMetadata(input.data, input.trigger);
  const job = await queue.add(input.jobName, payload);

  await recordQueuedJob({
    queueName: input.queueName,
    bullmqJobId: String(job.id),
    targetType: input.target.type ?? null,
    targetId: input.target.id ?? null,
    targetLabel: input.target.label ?? null,
    payload,
  });

  return job;
}

async function enqueueLibraryScans(trigger: QueueTrigger = {}) {
  const roots = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.enabled, true))
    .orderBy(libraryRoots.path);

  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const root of roots) {
    const job = await enqueueQueueJob({
      queueName: "library-scan",
      jobName: "library-root-scan",
      data: {
        libraryRootId: root.id,
        path: root.path,
        recursive: root.recursive,
      },
      target: {
        type: "library-root",
        id: root.id,
        label: root.label,
      },
      trigger,
    });

    if (job) {
      createdJobIds.push(String(job.id));
    } else {
      skipped += 1;
    }
  }

  return { jobIds: createdJobIds, skipped };
}

async function enqueueMissingSceneJobs(queueName: QueueName, trigger: QueueTrigger = {}) {
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
    sceneRows = await db
      .select({ id: scenes.id, title: scenes.title })
      .from(scenes)
      .where(
        or(
          isNull(scenes.previewPath),
          isNull(scenes.spritePath),
          isNull(scenes.trickplayVttPath),
          and(
            or(isNull(scenes.thumbnailPath), not(like(scenes.thumbnailPath, "%thumb-custom%"))),
            or(isNull(scenes.thumbnailPath), isNull(scenes.cardThumbnailPath))
          )
        )!
      );
  } else if (queueName === "metadata-import") {
    sceneRows = await db
      .select({ id: scenes.id, title: scenes.title })
      .from(scenes)
      .limit(25);
  }

  const createdJobIds: string[] = [];
  let skipped = 0;

  for (const scene of sceneRows) {
    const job = await enqueueQueueJob({
      queueName,
      jobName: `scene-${queueName}`,
      data: { sceneId: scene.id },
      target: {
        type: "scene",
        id: scene.id,
        label: scene.title,
      },
      trigger,
    });

    if (job) {
      createdJobIds.push(String(job.id));
    } else {
      skipped += 1;
    }
  }

  return { jobIds: createdJobIds, skipped };
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
        const counts = await queue.getJobCounts("active", "waiting", "delayed");
        const [failedRow] = await db
          .select({ total: sql<number>`count(*)::int` })
          .from(jobRuns)
          .where(and(eq(jobRuns.queueName, definition.name), eq(jobRuns.status, "failed")));
        const [completedRow] = await db
          .select({ total: sql<number>`count(*)::int` })
          .from(jobRuns)
          .where(and(eq(jobRuns.queueName, definition.name), eq(jobRuns.status, "completed")));
        const failed = failedRow?.total ?? 0;
        const waiting = counts.waiting ?? 0;
        const delayed = counts.delayed ?? 0;
        const active = counts.active ?? 0;
        const status =
          failed > 0 ? "warning" : active > 0 || waiting > 0 || delayed > 0 ? "active" : "idle";

        return {
          name: definition.name,
          label: definition.label,
          description: definition.description,
          status,
          concurrency: definition.concurrency,
          active,
          waiting,
          delayed,
          backlog: waiting + delayed,
          completed: completedRow?.total ?? 0,
          failed,
        };
      })
    );

    const activeJobs = await db
      .select()
      .from(jobRuns)
      .where(inArray(jobRuns.status, ["waiting", "active", "delayed"]))
      .orderBy(
        sql`case
          when ${jobRuns.status} = 'active' then 0
          when ${jobRuns.status} = 'delayed' then 1
          else 2
        end`,
        asc(jobRuns.createdAt)
      )
      .limit(24);

    const failedJobs = await db
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.status, "failed"))
      .orderBy(desc(jobRuns.updatedAt), desc(jobRuns.createdAt))
      .limit(24);

    const completedJobs = await db
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.status, "completed"))
      .orderBy(desc(jobRuns.finishedAt), desc(jobRuns.createdAt))
      .limit(12);

    const recentJobs = await db
      .select()
      .from(jobRuns)
      .where(inArray(jobRuns.status, ["waiting", "active", "failed", "completed", "delayed"]))
      .orderBy(desc(jobRuns.updatedAt), desc(jobRuns.createdAt))
      .limit(18);

    return {
      queues,
      activeJobs: activeJobs.map(toJobRunDto),
      failedJobs: failedJobs.map(toJobRunDto),
      completedJobs: completedJobs.map(toJobRunDto),
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

    const result =
      queueName === "library-scan"
        ? await enqueueLibraryScans({
            by: "manual",
            label: "Started from Operations",
          })
        : await enqueueMissingSceneJobs(queueName, {
            by: "manual",
            label: "Started from Operations",
          });

    return {
      ok: true,
      queueName,
      enqueued: result.jobIds.length,
      skipped: result.skipped,
      jobIds: result.jobIds,
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

    const waitingJobs = await queue.getWaiting();
    const delayedJobs = await queue.getDelayed();
    let waitingRemoved = 0;
    for (const job of [...waitingJobs, ...delayedJobs]) {
      try {
        await job.remove();
        waitingRemoved += 1;
      } catch {
        // Job may have moved on before removal.
      }
    }

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
          inArray(jobRuns.status, ["waiting", "active", "delayed"])
        )
      );

    // Clean up the failed jobs we just created
    await queue.clean(0, 100_000, "failed");

    return {
      ok: true,
      queueName,
      waitingRemoved,
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
    const payload = withTriggerMetadata(
      { sceneId },
      {
        by: "manual",
        label: "Rebuild preview from Operations",
      }
    );
    const job = await queue.add("scene-preview", payload);

    await recordQueuedJob({
      queueName: "preview",
      bullmqJobId: String(job.id),
      targetType: "scene",
      targetId: scene.id,
      targetLabel: scene.title,
      payload,
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

    const result = await enqueueMissingSceneJobs("preview", {
      by: "manual",
      label: "Rebuild previews from Operations",
    });

    return {
      ok: true,
      enqueued: result.jobIds.length,
      skipped: result.skipped,
      jobIds: result.jobIds,
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
