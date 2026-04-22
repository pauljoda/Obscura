/**
 * Jobs dashboard read helpers shared by the Fastify API and the SvelteKit
 * server. Takes a typed Drizzle db and the already-resolved SFW flag so
 * each host can decide how to parse the incoming request.
 */
import type { JobsDashboardDto } from "@obscura/contracts";
import {
  queueDefinitions,
  resolveQueueWorkerConcurrency,
  type JobKind,
  type JobTriggerKind,
  type QueueName,
} from "@obscura/contracts";
import { schema, type AppDb } from "@obscura/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

const {
  jobRuns,
  libraryRoots,
  audioTracks,
  videoEpisodes,
  videoMovies,
  videoSeries,
  librarySettings,
} = schema;

type JobRow = typeof jobRuns.$inferSelect;

type JobPayload = Record<string, unknown> & {
  jobKind?: JobKind;
  triggeredBy?: JobTriggerKind;
  triggerLabel?: string;
};

interface QueueTrigger {
  by?: JobTriggerKind;
  kind?: JobKind;
  label?: string | null;
}

function readTriggerMetadata(payload: unknown): QueueTrigger {
  if (!payload || typeof payload !== "object") return {};
  const meta = payload as JobPayload;
  return {
    kind: meta.jobKind ?? undefined,
    by: meta.triggeredBy ?? undefined,
    label: typeof meta.triggerLabel === "string" ? meta.triggerLabel : undefined,
  };
}

function getQueueDefinition(queueName: QueueName) {
  return queueDefinitions.find((d) => d.name === queueName)!;
}

export function toJobRunDto(job: JobRow) {
  const queueDefinition = getQueueDefinition(job.queueName as QueueName);
  const trigger = readTriggerMetadata(job.payload);

  return {
    ...job,
    queueLabel: queueDefinition.label,
    jobKind: trigger.kind ?? null,
    triggeredBy: trigger.by ?? null,
    triggerLabel: trigger.label ?? null,
    progress: job.progress ?? 0,
  };
}

async function collectNsfwJobTargetIds(
  db: AppDb,
  jobs: JobRow[],
): Promise<Set<string>> {
  const episodeIds: string[] = [];
  const movieIds: string[] = [];
  const seriesIds: string[] = [];
  const libraryRootIds: string[] = [];
  const audioTrackIds: string[] = [];

  for (const job of jobs) {
    if (!job.targetId) continue;
    switch (job.targetType) {
      case "video_episode":
        episodeIds.push(job.targetId);
        break;
      case "video_movie":
        movieIds.push(job.targetId);
        break;
      case "video_series":
        seriesIds.push(job.targetId);
        break;
      case "library-root":
        libraryRootIds.push(job.targetId);
        break;
      case "audio-track":
        audioTrackIds.push(job.targetId);
        break;
      default:
        break;
    }
  }

  const nsfwIds = new Set<string>();

  if (episodeIds.length) {
    const rows = await db
      .select({ id: videoEpisodes.id })
      .from(videoEpisodes)
      .where(
        and(inArray(videoEpisodes.id, episodeIds), eq(videoEpisodes.isNsfw, true)),
      );
    for (const r of rows) nsfwIds.add(r.id);
  }
  if (movieIds.length) {
    const rows = await db
      .select({ id: videoMovies.id })
      .from(videoMovies)
      .where(
        and(inArray(videoMovies.id, movieIds), eq(videoMovies.isNsfw, true)),
      );
    for (const r of rows) nsfwIds.add(r.id);
  }
  if (seriesIds.length) {
    const rows = await db
      .select({ id: videoSeries.id })
      .from(videoSeries)
      .where(
        and(inArray(videoSeries.id, seriesIds), eq(videoSeries.isNsfw, true)),
      );
    for (const r of rows) nsfwIds.add(r.id);
  }
  if (libraryRootIds.length) {
    const rows = await db
      .select({ id: libraryRoots.id })
      .from(libraryRoots)
      .where(
        and(
          inArray(libraryRoots.id, libraryRootIds),
          eq(libraryRoots.isNsfw, true),
        ),
      );
    for (const r of rows) nsfwIds.add(r.id);
  }
  if (audioTrackIds.length) {
    const rows = await db
      .select({ id: audioTracks.id })
      .from(audioTracks)
      .where(
        and(
          inArray(audioTracks.id, audioTrackIds),
          eq(audioTracks.isNsfw, true),
        ),
      );
    for (const r of rows) nsfwIds.add(r.id);
  }

  return nsfwIds;
}

export async function filterSfwJobs<T extends JobRow>(
  db: AppDb,
  jobs: T[],
  sfwOnly: boolean,
): Promise<T[]> {
  if (!sfwOnly || jobs.length === 0) return jobs;
  const nsfwIds = await collectNsfwJobTargetIds(db, jobs);
  if (nsfwIds.size === 0) return jobs;
  return jobs.filter((j) => !j.targetId || !nsfwIds.has(j.targetId));
}

export async function getJobsDashboardRead(
  db: AppDb,
  sfwOnly: boolean,
): Promise<JobsDashboardDto> {
  const [settingsRow] = await db.select().from(librarySettings).limit(1);
  const settings =
    settingsRow ??
    ((
      await db.insert(librarySettings).values({}).returning()
    )[0]);

  const [latestScan] = await db
    .select({ finishedAt: jobRuns.finishedAt })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.queueName, "library-scan"),
        eq(jobRuns.status, "completed"),
      ),
    )
    .orderBy(desc(jobRuns.finishedAt))
    .limit(1);

  const countsRows = await db
    .select({
      queueName: jobRuns.queueName,
      status: jobRuns.status,
      total: sql<number>`count(*)::int`,
    })
    .from(jobRuns)
    .groupBy(jobRuns.queueName, jobRuns.status);

  const countsByQueue = new Map<string, Record<string, number>>();
  for (const row of countsRows) {
    let bucket = countsByQueue.get(row.queueName);
    if (!bucket) {
      bucket = {};
      countsByQueue.set(row.queueName, bucket);
    }
    bucket[row.status] = row.total;
  }

  const queues = queueDefinitions.map((definition) => {
    const bucket = countsByQueue.get(definition.name) ?? {};
    const waiting = bucket.waiting ?? 0;
    const delayed = bucket.delayed ?? 0;
    const active = bucket.active ?? 0;
    const failed = bucket.failed ?? 0;
    const completed = bucket.completed ?? 0;
    const status: "idle" | "active" | "warning" =
      failed > 0
        ? "warning"
        : active > 0 || waiting > 0 || delayed > 0
          ? "active"
          : "idle";

    return {
      name: definition.name,
      label: definition.label,
      description: definition.description,
      status,
      concurrency: resolveQueueWorkerConcurrency(
        definition.concurrency,
        settings.backgroundWorkerConcurrency,
      ),
      active,
      waiting,
      delayed,
      backlog: waiting + delayed,
      completed,
      failed,
    };
  });

  const activeLimit = sfwOnly ? 72 : 24;
  const failedLimit = sfwOnly ? 72 : 24;
  const completedLimit = sfwOnly ? 36 : 12;
  const recentLimit = sfwOnly ? 54 : 18;

  const activeJobsRaw = await db
    .select()
    .from(jobRuns)
    .where(inArray(jobRuns.status, ["waiting", "active", "delayed"]))
    .orderBy(
      sql`case
        when ${jobRuns.status} = 'active' then 0
        when ${jobRuns.status} = 'delayed' then 1
        else 2
      end`,
      asc(jobRuns.createdAt),
    )
    .limit(activeLimit);

  const failedJobsRaw = await db
    .select()
    .from(jobRuns)
    .where(eq(jobRuns.status, "failed"))
    .orderBy(desc(jobRuns.updatedAt), desc(jobRuns.createdAt))
    .limit(failedLimit);

  const completedJobsRaw = await db
    .select()
    .from(jobRuns)
    .where(eq(jobRuns.status, "completed"))
    .orderBy(desc(jobRuns.finishedAt), desc(jobRuns.createdAt))
    .limit(completedLimit);

  const recentJobsRaw = await db
    .select()
    .from(jobRuns)
    .where(
      inArray(jobRuns.status, [
        "waiting",
        "active",
        "failed",
        "completed",
        "delayed",
      ]),
    )
    .orderBy(desc(jobRuns.updatedAt), desc(jobRuns.createdAt))
    .limit(recentLimit);

  const [activeJobs, failedJobs, completedJobs, recentJobs] = await Promise.all(
    [
      filterSfwJobs(db, activeJobsRaw, sfwOnly).then((rows) =>
        rows.slice(0, 24),
      ),
      filterSfwJobs(db, failedJobsRaw, sfwOnly).then((rows) =>
        rows.slice(0, 24),
      ),
      filterSfwJobs(db, completedJobsRaw, sfwOnly).then((rows) =>
        rows.slice(0, 12),
      ),
      filterSfwJobs(db, recentJobsRaw, sfwOnly).then((rows) =>
        rows.slice(0, 18),
      ),
    ],
  );

  return {
    queues,
    activeJobs: activeJobs.map(toJobRunDto) as unknown as JobsDashboardDto["activeJobs"],
    failedJobs: failedJobs.map(toJobRunDto) as unknown as JobsDashboardDto["failedJobs"],
    completedJobs: completedJobs.map(toJobRunDto) as unknown as JobsDashboardDto["completedJobs"],
    recentJobs: recentJobs.map(toJobRunDto) as unknown as JobsDashboardDto["recentJobs"],
    lastScanAt: latestScan?.finishedAt
      ? (latestScan.finishedAt as unknown as string)
      : null,
    schedule: {
      enabled: settings.autoScanEnabled,
      intervalMinutes: settings.scanIntervalMinutes,
    },
  };
}
