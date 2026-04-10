import PgBoss from "pg-boss";
import { queueDefinitions, type QueueName } from "@obscura/contracts";

// ─── pg-boss lifecycle ─────────────────────────────────────────────
// Single PgBoss instance shared across the API process. Lazily started on
// first access so Fastify bootstrap can await it explicitly (via initQueues)
// or let the first route call trigger startup.

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

export function initQueues(): Promise<PgBoss> {
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

export function getBoss(): Promise<PgBoss> {
  return initQueues();
}

// ─── Thin helpers used by routes ────────────────────────────────────

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

/** Best-effort cancellation — swallows errors if the job is already gone or terminal. */
export async function cancelJob(queueName: QueueName, jobId: string): Promise<void> {
  const boss = await getBoss();
  try {
    await boss.cancel(queueName, jobId);
  } catch {
    // already completed / failed / archived — nothing to cancel
  }
}

export async function deleteJob(queueName: QueueName, jobId: string): Promise<void> {
  const boss = await getBoss();
  try {
    await boss.deleteJob(queueName, jobId);
  } catch {
    // already gone
  }
}

export async function stopQueues(): Promise<void> {
  if (!bossPromise) return;
  const boss = await bossPromise;
  await boss.stop({ graceful: true });
}
