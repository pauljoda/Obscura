import PgBoss from "pg-boss";
import { queueDefinitions, type QueueName } from "@obscura/contracts";

// ─── pg-boss lifecycle ─────────────────────────────────────────────
// Single PgBoss instance shared across the API process. Lazily started on
// first access so Fastify bootstrap can await it explicitly (via initQueues)
// or let the first route call trigger startup.

export interface QueueAdapter {
  init(): Promise<PgBoss>;
  getBoss(): Promise<PgBoss>;
  sendJob(queueName: QueueName, data: Record<string, unknown>): Promise<string>;
  cancelJob(queueName: QueueName, jobId: string): Promise<void>;
  deleteJob(queueName: QueueName, jobId: string): Promise<void>;
  stop(): Promise<void>;
}

let bossPromise: Promise<PgBoss> | null = null;

// Fallback mirrors apps/api/src/db/index.ts so the API can run in a dev shell
// without an explicit env load (the dev docker-compose postgres exposes the
// `obscura:obscura@localhost:5432/obscura` credentials).
function databaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    "postgres://obscura:obscura@localhost:5432/obscura"
  );
}

function initDefaultQueues(): Promise<PgBoss> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss({
        connectionString: databaseUrl(),
        // Archive completed jobs after 1h; keep archive for 3 days.
        archiveCompletedAfterSeconds: 60 * 60,
        retentionDays: 3,
        // pg-boss manages its own schema (`pgboss`) independently of drizzle.
      });

      boss.on("error", (error) => {
        console.error("[api] pg-boss error", error);
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

const defaultQueueAdapter: QueueAdapter = {
  init: () => initDefaultQueues(),
  getBoss: () => initDefaultQueues(),
  async sendJob(queueName, data) {
    const boss = await initDefaultQueues();
    const id = await boss.send(queueName, data);
    if (!id) {
      throw new Error(`pg-boss refused to enqueue job on queue ${queueName}`);
    }
    return id;
  },
  async cancelJob(queueName, jobId) {
    const boss = await initDefaultQueues();
    try {
      await boss.cancel(queueName, jobId);
    } catch {
      // already completed / failed / archived — nothing to cancel
    }
  },
  async deleteJob(queueName, jobId) {
    const boss = await initDefaultQueues();
    try {
      await boss.deleteJob(queueName, jobId);
    } catch {
      // already gone
    }
  },
  async stop() {
    if (!bossPromise) return;
    const boss = await bossPromise;
    await boss.stop({ graceful: true });
    bossPromise = null;
  },
};

let queueAdapter: QueueAdapter = defaultQueueAdapter;

export function configureQueueAdapter(adapter?: QueueAdapter) {
  queueAdapter = adapter ?? defaultQueueAdapter;
}

export function initQueues(): Promise<PgBoss> {
  return queueAdapter.init();
}

export function getBoss(): Promise<PgBoss> {
  return queueAdapter.getBoss();
}

// ─── Thin helpers used by routes ────────────────────────────────────

export async function sendJob(
  queueName: QueueName,
  data: Record<string, unknown>
): Promise<string> {
  return queueAdapter.sendJob(queueName, data);
}

/** Best-effort cancellation — swallows errors if the job is already gone or terminal. */
export async function cancelJob(queueName: QueueName, jobId: string): Promise<void> {
  await queueAdapter.cancelJob(queueName, jobId);
}

export async function deleteJob(queueName: QueueName, jobId: string): Promise<void> {
  await queueAdapter.deleteJob(queueName, jobId);
}

export async function stopQueues(): Promise<void> {
  await queueAdapter.stop();
}
