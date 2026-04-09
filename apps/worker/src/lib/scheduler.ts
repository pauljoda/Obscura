import { desc, eq, sql } from "drizzle-orm";
import {
  jobRunRetention,
  queueDefinitions,
  resolveQueueWorkerConcurrency,
} from "@obscura/contracts";
import type { Worker } from "bullmq";
import { db, libraryRoots, librarySettings, jobRuns } from "./db.js";
import { redis } from "./queues.js";
import { enqueueLibraryRootJob } from "./enqueue.js";

export async function ensureLibrarySettingsRow() {
  const [existing] = await db.select().from(librarySettings).limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db.insert(librarySettings).values({}).returning();
  return created;
}

let scheduling = false;
const scheduleLockKey = "obscura:worker:schedule-library-scan";

export async function scheduleRecurringScans() {
  if (scheduling) {
    return;
  }

  const lockToken = `${process.pid}:${Date.now()}`;
  const lockAcquired = await redis.set(scheduleLockKey, lockToken, "PX", 55_000, "NX");
  if (!lockAcquired) {
    return;
  }

  scheduling = true;

  try {
    const settings = await ensureLibrarySettingsRow();
    if (!settings.autoScanEnabled) {
      return;
    }

    const enabledRoots = await db
      .select()
      .from(libraryRoots)
      .where(eq(libraryRoots.enabled, true))
      .orderBy(libraryRoots.path);

    if (enabledRoots.length === 0) {
      return;
    }

    const [lastRun] = await db
      .select({ createdAt: jobRuns.createdAt })
      .from(jobRuns)
      .where(eq(jobRuns.queueName, "library-scan"))
      .orderBy(desc(jobRuns.createdAt))
      .limit(1);

    const intervalMs = Math.max(5, settings.scanIntervalMinutes) * 60_000;
    if (lastRun && Date.now() - new Date(lastRun.createdAt).getTime() < intervalMs) {
      return;
    }

    for (const root of enabledRoots) {
      await enqueueLibraryRootJob(root, {
        by: "schedule",
        label: `Scheduled every ${Math.max(5, settings.scanIntervalMinutes)} minutes`,
      });
    }
  } finally {
    scheduling = false;
    if ((await redis.get(scheduleLockKey)) === lockToken) {
      await redis.del(scheduleLockKey);
    }
  }
}

export async function syncWorkerConcurrencyFromSettings(workers: Worker[]) {
  const row = await ensureLibrarySettingsRow();
  queueDefinitions.forEach((definition, i) => {
    workers[i].concurrency = resolveQueueWorkerConcurrency(
      definition.concurrency,
      row.backgroundWorkerConcurrency
    );
  });
}

export async function pruneJobRunHistory() {
  await db.execute(sql`
    DELETE FROM job_runs
    WHERE id IN (
      SELECT id
      FROM job_runs
      WHERE status = 'completed'
      ORDER BY COALESCE(finished_at, updated_at, created_at) DESC, created_at DESC
      OFFSET ${jobRunRetention.completed}
    )
  `);

  await db.execute(sql`
    DELETE FROM job_runs
    WHERE id IN (
      SELECT id
      FROM job_runs
      WHERE status = 'dismissed'
      ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC
      OFFSET ${jobRunRetention.dismissed}
    )
  `);
}
