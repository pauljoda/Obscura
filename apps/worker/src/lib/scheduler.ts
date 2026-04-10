import { desc, eq, sql } from "drizzle-orm";
import { jobRunRetention } from "@obscura/contracts";
import { db, libraryRoots, librarySettings, jobRuns } from "./db.js";
import { enqueueLibraryRootJob } from "./enqueue.js";
import { pruneUntrackedLibraryReferences } from "./helpers.js";

export async function ensureLibrarySettingsRow() {
  const [existing] = await db.select().from(librarySettings).limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db.insert(librarySettings).values({}).returning();
  return created;
}

let scheduling = false;

/**
 * Cross-process coordination: a session-level Postgres advisory lock keyed
 * by a deterministic hash of the scheduler name. Replaces the old Redis
 * SET NX lock so the worker no longer needs a Redis connection.
 */
const SCHEDULE_LOCK_KEY = "obscura:worker:schedule-library-scan";

export async function scheduleRecurringScans() {
  if (scheduling) {
    return;
  }

  const lockResult = await db.execute<{ locked: boolean }>(sql`
    SELECT pg_try_advisory_lock(hashtext(${SCHEDULE_LOCK_KEY})) AS locked
  `);
  const acquired = Boolean(
    (lockResult as unknown as Array<{ locked: boolean }>)[0]?.locked
  );
  if (!acquired) {
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

    await pruneUntrackedLibraryReferences();

    if (enabledRoots.length === 0) {
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
    await db.execute(sql`
      SELECT pg_advisory_unlock(hashtext(${SCHEDULE_LOCK_KEY}))
    `);
  }
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
