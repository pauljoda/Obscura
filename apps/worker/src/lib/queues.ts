import PgBoss from "pg-boss";
import {
  queueDefinitions,
  resolveQueueWorkerConcurrency,
  type QueueName,
} from "@obscura/contracts";

// ─── pg-boss lifecycle (worker side) ───────────────────────────────

let bossPromise: Promise<PgBoss> | null = null;

// Fallback mirrors apps/worker/src/lib/db.ts so the worker can run in a dev
// shell without an explicit env load.
function databaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    "postgres://obscura:obscura@localhost:5432/obscura"
  );
}

export function initQueues(): Promise<PgBoss> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss({
        connectionString: databaseUrl(),
        archiveCompletedAfterSeconds: 60 * 60,
        retentionDays: 3,
      });

      boss.on("error", (error) => {
        console.error("[worker] pg-boss error", error);
      });

      await boss.start();

      for (const definition of queueDefinitions) {
        await boss.createQueue(definition.name);
      }

      return boss;
    })();
  }
  return bossPromise;
}

export function getBoss(): Promise<PgBoss> {
  return initQueues();
}

// ─── Enqueue helpers ───────────────────────────────────────────────

export async function sendJob(
  queueName: QueueName,
  data: Record<string, unknown>
): Promise<string> {
  const boss = await getBoss();
  const id = await boss.send(queueName, data);
  if (!id) {
    throw new Error(`pg-boss refused to enqueue job on queue ${queueName}`);
  }
  return id;
}

// ─── Worker registration ──────────────────────────────────────────

export type WorkerHandler = (job: { id: string; data: Record<string, unknown> }) => Promise<void>;

export type RegisteredWorker = {
  queueName: QueueName;
  workerId: string;
  concurrency: number;
};

/**
 * Register a pg-boss `work` handler for a queue. pg-boss v10 no longer
 * exposes `teamSize/teamConcurrency` — concurrency is instead expressed via
 * `batchSize`: the handler receives up to N jobs at once and we run them in
 * parallel to match the requested concurrency.
 */
export async function registerWorker(
  queueName: QueueName,
  handler: WorkerHandler,
  concurrency: number
): Promise<RegisteredWorker> {
  const boss = await getBoss();
  const workerId = await boss.work<Record<string, unknown>>(
    queueName,
    { batchSize: Math.max(1, concurrency) },
    async (jobs) => {
      await Promise.all(
        jobs.map((job) => handler({ id: job.id, data: job.data ?? {} }))
      );
    }
  );
  return { queueName, workerId, concurrency };
}

export async function unregisterWorker(workerId: string): Promise<void> {
  const boss = await getBoss();
  try {
    await boss.offWork({ id: workerId });
  } catch {
    // already gone
  }
}

export function effectiveConcurrency(
  definitionConcurrency: number,
  backgroundWorkerConcurrency: unknown
): number {
  return resolveQueueWorkerConcurrency(definitionConcurrency, backgroundWorkerConcurrency);
}

export async function stopQueues(): Promise<void> {
  if (!bossPromise) return;
  const boss = await bossPromise;
  await boss.stop({ graceful: true });
}
