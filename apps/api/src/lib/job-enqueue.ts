/**
 * Small enqueue helper shared between the API's /jobs routes and service
 * layers that need to queue worker jobs (upload handlers, etc.).
 *
 * Mirrors the private helpers in apps/api/src/routes/jobs.ts so service
 * code doesn't have to reach into a route file. Both paths use pg-boss
 * via sendJob() and persist a matching row in the jobRuns table so the
 * UI and worker observe the same state.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { JobKind, JobTriggerKind, QueueName } from "@obscura/contracts";
import { db, schema } from "../db";
import { sendJob } from "./queues";

const { jobRuns } = schema;

export interface QueueTarget {
  type?: string | null;
  id?: string | null;
  label?: string | null;
}

export interface QueueTrigger {
  by?: JobTriggerKind;
  kind?: JobKind;
  label?: string | null;
}

type JobPayload = Record<string, unknown> & {
  jobKind?: JobKind;
  triggeredBy?: JobTriggerKind;
  triggerLabel?: string;
};

export function withTriggerMetadata(
  payload: Record<string, unknown>,
  trigger: QueueTrigger = {},
): JobPayload {
  return {
    ...payload,
    ...(trigger.kind ? { jobKind: trigger.kind } : {}),
    ...(trigger.by ? { triggeredBy: trigger.by } : {}),
    ...(trigger.label ? { triggerLabel: trigger.label } : {}),
  };
}

/**
 * Returns true when a waiting/active/delayed job already targets the given
 * entity on the given queue. Used to dedupe back-to-back enqueue calls.
 */
export async function hasPendingJob(
  queueName: QueueName,
  target: QueueTarget,
): Promise<boolean> {
  if (!target.id) return false;

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

/**
 * Enqueue a job and persist a matching jobRuns row. Returns null when a
 * pending job already exists for the same target (dedupe).
 */
export async function enqueueQueueJob(input: {
  queueName: QueueName;
  jobName: string;
  data: Record<string, unknown>;
  target: QueueTarget;
  trigger?: QueueTrigger;
}): Promise<{ id: string } | null> {
  if (await hasPendingJob(input.queueName, input.target)) return null;

  const payload = withTriggerMetadata(input.data, input.trigger);
  const jobId = await sendJob(input.queueName, payload);

  await db.insert(jobRuns).values({
    queueName: input.queueName,
    bullmqJobId: jobId,
    status: "waiting",
    targetType: input.target.type ?? null,
    targetId: input.target.id ?? null,
    targetLabel: input.target.label ?? null,
    payload,
  });

  return { id: jobId };
}
