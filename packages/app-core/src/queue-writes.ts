import PgBoss from "pg-boss";
import { and, eq, inArray } from "drizzle-orm";
import type { JobKind, JobTriggerKind, QueueName } from "@obscura/contracts";
import type { AppDb } from "@obscura/db";
import { schema } from "@obscura/db";

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

let bossPromise: Promise<PgBoss> | null = null;

function databaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    "postgres://obscura:obscura@localhost:5432/obscura"
  );
}

async function getBoss() {
  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss({
        connectionString: databaseUrl(),
        archiveCompletedAfterSeconds: 60 * 60,
        retentionDays: 3,
      });
      boss.on("error", (error: unknown) => {
        console.error("[app-core] pg-boss error", error);
      });
      await boss.start();
      return boss;
    })();
  }
  return bossPromise;
}

function withTriggerMetadata(
  payload: Record<string, unknown>,
  trigger: QueueTrigger = {},
) {
  return {
    ...payload,
    ...(trigger.kind ? { jobKind: trigger.kind } : {}),
    ...(trigger.by ? { triggeredBy: trigger.by } : {}),
    ...(trigger.label ? { triggerLabel: trigger.label } : {}),
  };
}

async function hasPendingJob(
  db: AppDb,
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

export async function enqueueQueueJob(
  db: AppDb,
  input: {
    queueName: QueueName;
    data: Record<string, unknown>;
    target: QueueTarget;
    trigger?: QueueTrigger;
  },
) {
  if (await hasPendingJob(db, input.queueName, input.target)) return null;

  const payload = withTriggerMetadata(input.data, input.trigger);
  const boss = await getBoss();
  const jobId = await boss.send(input.queueName, payload);
  if (!jobId) {
    throw new Error(`pg-boss refused to enqueue job on queue ${input.queueName}`);
  }

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
