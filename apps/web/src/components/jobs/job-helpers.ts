import type { JobRun, QueueSummary } from "../../lib/api";
import type { LedStatus } from "@obscura/ui/composed/status-led";
import {
  Cpu,
  DatabaseZap,
  FileSearch,
  Fingerprint,
  FolderSearch,
  Image,
} from "lucide-react";

export const queueIcons: Record<string, typeof FolderSearch> = {
  "library-scan": FolderSearch,
  "media-probe": FileSearch,
  fingerprint: Fingerprint,
  preview: Image,
  "metadata-import": DatabaseZap,
  "gallery-scan": FolderSearch,
  "image-thumbnail": Image,
  "image-fingerprint": Fingerprint,
};

export function getQueueIcon(queueName: string) {
  return queueIcons[queueName] ?? Cpu;
}

export function formatStamp(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export function formatRelativeTime(value: string | null) {
  if (!value) return "Never";

  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function formatElapsed(job: JobRun) {
  const anchor = job.startedAt ?? job.createdAt;
  const deltaSeconds = Math.max(0, Math.round((Date.now() - new Date(anchor).getTime()) / 1000));
  const minutes = Math.floor(deltaSeconds / 60);
  const seconds = deltaSeconds % 60;

  if (job.status === "waiting" || job.status === "delayed") {
    return `queued ${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function ledForQueue(status: QueueSummary["status"]): LedStatus {
  if (status === "active") return "phosphor";
  if (status === "warning") return "warning";
  return "idle";
}

export function isForceRebuildJob(job: JobRun) {
  return job.jobKind === "force-rebuild";
}

export function toneForJob(job: JobRun) {
  if (job.status === "failed") return "error" as const;
  if (isForceRebuildJob(job)) return "error" as const;
  if (job.status === "waiting" || job.status === "delayed") return "warning" as const;
  return "phosphor" as const;
}

export function describeTrigger(job: JobRun) {
  if (job.triggerLabel) return job.triggerLabel;

  switch (job.triggeredBy) {
    case "manual":
      return "Started manually";
    case "schedule":
      return "Started by recurring scan schedule";
    case "library-scan":
      return "Queued during library scan";
    case "gallery-scan":
      return "Queued during gallery scan";
    case "system":
      return "Queued by the system";
    default:
      return "Trigger not recorded";
  }
}

export function statusLabel(status: JobRun["status"]) {
  if (status === "waiting") return "queued";
  if (status === "delayed") return "delayed";
  if (status === "dismissed") return "cleared";
  return status;
}

export function jobHeading(job: JobRun) {
  return job.targetLabel ?? `${job.queueLabel} task`;
}

export function maintenanceJobLogRedacted(job: JobRun, nsfwMode: string) {
  return nsfwMode === "off" && job.queueName === "library-maintenance";
}

export function displayJobHeading(job: JobRun, nsfwMode: string) {
  if (maintenanceJobLogRedacted(job, nsfwMode)) return "Relocate scene generated files";
  return jobHeading(job);
}

export function displayDescribeTrigger(job: JobRun, nsfwMode: string) {
  if (maintenanceJobLogRedacted(job, nsfwMode)) return "Background file layout task";
  return describeTrigger(job);
}

export function jobBadgeVariant(job: JobRun) {
  return isForceRebuildJob(job) ? ("error" as const) : ("accent" as const);
}

export function describeRunResult(queueName: string, enqueued: number, skipped: number) {
  if (queueName === "library-maintenance" && enqueued === 1) {
    return "Cleaning up files.";
  }
  if (queueName === "library-maintenance" && enqueued === 0 && skipped > 0) {
    return "File cleanup is already in progress.";
  }

  if (queueName === "library-scan" && enqueued === 0 && skipped === 0) {
    return "Stale library references cleared. Add a watched folder to scan new files.";
  }
  if (queueName === "library-scan" && enqueued === 0 && skipped > 0) {
    return "Stale references cleared; every library scan is already queued or running.";
  }

  const parts = [
    `Queued ${enqueued} ${queueName} job${enqueued === 1 ? "" : "s"}`,
  ];

  if (skipped > 0) {
    parts.push(`skipped ${skipped} already pending`);
  }

  return `${parts.join(", ")}.`;
}
