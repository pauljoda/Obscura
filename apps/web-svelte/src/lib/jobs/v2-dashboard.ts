import {
  queueDefinitions,
  type JobRunDto,
  type JobStatus,
  type JobsDashboardDto,
  type QueueName,
  type QueueSummaryDto,
} from "@obscura/contracts";
import type { V2JobRun } from "$lib/api/v2";

type V2JobDefinition = {
  type: string;
  queueName: QueueName;
  label: string;
  description: string;
};

const queueDefinitionByName = new Map(queueDefinitions.map((queue) => [queue.name, queue]));

const V2_JOB_DEFINITIONS = [
  {
    type: "scan-library",
    queueName: "library-scan",
    label: "Video Scan",
    description: "Discovers videos through the v2 worker queue.",
  },
  {
    type: "probe-video",
    queueName: "media-probe",
    label: "Video Probe",
    description: "Extracts technical metadata for v2 video records.",
  },
  {
    type: "legacy-video-import",
    queueName: "metadata-import",
    label: "Legacy Video Import",
    description: "Imports legacy video records into the v2 namespace.",
  },
  {
    type: "legacy-media-import",
    queueName: "metadata-import",
    label: "Legacy Media Import",
    description: "Imports legacy gallery, image, book, and audio records into v2.",
  },
  {
    type: "noop",
    queueName: "library-maintenance",
    label: "No-op Worker Check",
    description: "Queues a tiny worker health check job.",
  },
] satisfies readonly V2JobDefinition[];

const jobDefinitionByType = new Map(
  V2_JOB_DEFINITIONS.map((definition) => [definition.type, definition]),
);

export function jobTypeForV2Queue(queueName: string): string | null {
  return (
    V2_JOB_DEFINITIONS.find((definition) => definition.queueName === queueName)?.type ??
    null
  );
}

export function jobTypesForV2Queue(queueName: string): string[] {
  return V2_JOB_DEFINITIONS.filter((definition) => definition.queueName === queueName).map(
    (definition) => definition.type,
  );
}

function definitionForJob(type: string): V2JobDefinition {
  return (
    jobDefinitionByType.get(type) ?? {
      type,
      queueName: "library-maintenance",
      label: type,
      description: "Background job managed by the v2 worker.",
    }
  );
}

function queueSummaryBase(definition: V2JobDefinition): QueueSummaryDto {
  const legacyDefinition = queueDefinitionByName.get(definition.queueName);
  return {
    name: definition.queueName,
    label: definition.label || legacyDefinition?.label || definition.queueName,
    description: definition.description || legacyDefinition?.description || "",
    status: "idle",
    concurrency: legacyDefinition?.concurrency ?? 1,
    active: 0,
    waiting: 0,
    delayed: 0,
    backlog: 0,
    completed: 0,
    failed: 0,
  };
}

export function mapV2JobStatus(status: string): JobStatus {
  switch (status) {
    case "running":
      return "active";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "dismissed";
    case "queued":
    default:
      return "waiting";
  }
}

function normalizeProgress(progress: V2JobRun["progress"]): number {
  const value = Number(progress);
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function mapV2JobRun(job: V2JobRun): JobRunDto {
  const definition = definitionForJob(job.type);
  const status = mapV2JobStatus(job.status);

  return {
    id: job.id,
    queueName: definition.queueName,
    queueLabel: definition.label,
    status,
    targetType: job.type,
    targetId: null,
    targetLabel: definition.label,
    triggeredBy: "system",
    triggerLabel: "Queued by v2 jobs",
    jobKind: "standard",
    progress: normalizeProgress(job.progress),
    attempts: 0,
    error: status === "failed" ? job.message : null,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    createdAt: job.createdAt,
    updatedAt: job.finishedAt ?? job.startedAt ?? job.createdAt,
  };
}

export function buildV2JobsDashboard(jobs: readonly V2JobRun[]): JobsDashboardDto {
  const mappedJobs = jobs.map(mapV2JobRun);
  const summaries = new Map<QueueName, QueueSummaryDto>();

  for (const definition of V2_JOB_DEFINITIONS) {
    if (!summaries.has(definition.queueName)) {
      summaries.set(definition.queueName, queueSummaryBase(definition));
    }
  }

  for (const job of mappedJobs) {
    const summary = summaries.get(job.queueName);
    if (!summary) continue;

    if (job.status === "active") summary.active += 1;
    if (job.status === "waiting") summary.waiting += 1;
    if (job.status === "delayed") summary.delayed += 1;
    if (job.status === "completed") summary.completed += 1;
    if (job.status === "failed") summary.failed += 1;
  }

  for (const summary of summaries.values()) {
    summary.backlog = summary.waiting + summary.delayed;
    summary.status = summary.failed > 0 ? "warning" : summary.active + summary.backlog > 0 ? "active" : "idle";
  }

  const activeJobs = mappedJobs.filter((job) => job.status === "active");
  const failedJobs = mappedJobs.filter((job) => job.status === "failed");
  const completedJobs = mappedJobs
    .filter((job) => job.status === "completed" || job.status === "dismissed")
    .slice(0, 40);
  const lastScanAt =
    mappedJobs.find((job) => job.queueName === "library-scan" && job.status === "completed")
      ?.finishedAt ?? null;

  return {
    queues: [...summaries.values()],
    activeJobs,
    failedJobs,
    completedJobs,
    recentJobs: mappedJobs,
    lastScanAt,
    schedule: {
      enabled: false,
      intervalMinutes: 0,
    },
  };
}
