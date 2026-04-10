import { and, eq, inArray } from "drizzle-orm";
import type { JobKind, JobTriggerKind, QueueName } from "@obscura/contracts";
import { db, jobRuns } from "./db.js";

/**
 * Minimal job shape the worker/processors hand to the tracking helpers.
 * Replaces BullMQ's `Job` — pg-boss jobs are simpler and we only need
 * the id, the payload, and the retry count.
 */
export type JobLike = {
  id: string;
  data: Record<string, unknown>;
  attemptsMade?: number;
};

export type JobPayload = Record<string, unknown> & {
  jobKind?: JobKind;
  triggeredBy?: JobTriggerKind;
  triggerLabel?: string;
};

export type QueueTarget = {
  type?: string | null;
  id?: string | null;
  label?: string | null;
};

export type QueueTrigger = {
  by?: JobTriggerKind;
  kind?: JobKind;
  label?: string | null;
};

export function withTriggerMetadata(
  payload: Record<string, unknown>,
  trigger: QueueTrigger = {}
): JobPayload {
  return {
    ...payload,
    ...(trigger.kind ? { jobKind: trigger.kind } : {}),
    ...(trigger.by ? { triggeredBy: trigger.by } : {}),
    ...(trigger.label ? { triggerLabel: trigger.label } : {}),
  };
}

export function formatJobError(error: unknown) {
  if (error instanceof Error) {
    if (error.stack && error.stack !== error.message) {
      return `${error.message}\n${error.stack}`.slice(0, 4000);
    }

    return error.message;
  }

  return typeof error === "string" ? error : "Unknown error";
}

export async function upsertJobRun(
  job: JobLike,
  queueName: QueueName,
  patch: Partial<typeof jobRuns.$inferInsert>
) {
  const payload = (patch.payload ?? (job.data as JobPayload) ?? {}) as JobPayload;
  const attempts = patch.attempts ?? job.attemptsMade ?? 0;

  await db
    .insert(jobRuns)
    .values({
      bullmqJobId: String(job.id),
      queueName,
      status: patch.status ?? "waiting",
      attempts,
      progress: patch.progress ?? 0,
      targetType: patch.targetType ?? null,
      targetId: patch.targetId ?? null,
      targetLabel: patch.targetLabel ?? null,
      payload,
      error: patch.error ?? null,
      startedAt: patch.startedAt ?? null,
      finishedAt: patch.finishedAt ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: jobRuns.bullmqJobId,
      set: {
        status: patch.status ?? "waiting",
        attempts,
        progress: patch.progress ?? 0,
        targetType: patch.targetType ?? null,
        targetId: patch.targetId ?? null,
        targetLabel: patch.targetLabel ?? null,
        payload,
        error: patch.error ?? null,
        startedAt: patch.startedAt ?? undefined,
        finishedAt: patch.finishedAt ?? undefined,
        updatedAt: new Date(),
      },
    });
}

export async function markJobActive(
  job: JobLike,
  queueName: QueueName,
  target: { type?: string; id?: string; label?: string } = {}
) {
  await upsertJobRun(job, queueName, {
    status: "active",
    targetType: target.type ?? null,
    targetId: target.id ?? null,
    targetLabel: target.label ?? null,
    attempts: job.attemptsMade ?? 0,
    startedAt: new Date(),
  });
}

export async function markJobProgress(job: JobLike, queueName: QueueName, progress: number) {
  await upsertJobRun(job, queueName, {
    status: "active",
    progress,
    attempts: job.attemptsMade ?? 0,
  });
}

export async function markJobCompleted(job: JobLike, queueName: QueueName) {
  await upsertJobRun(job, queueName, {
    status: "completed",
    progress: 100,
    attempts: job.attemptsMade ?? 0,
    finishedAt: new Date(),
  });
}

export async function markJobFailed(job: JobLike, queueName: QueueName, error: unknown) {
  await upsertJobRun(job, queueName, {
    status: "failed",
    attempts: job.attemptsMade ?? 0,
    error: formatJobError(error),
    finishedAt: new Date(),
  });
}

export async function hasPendingJob(queueName: QueueName, target: QueueTarget) {
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
