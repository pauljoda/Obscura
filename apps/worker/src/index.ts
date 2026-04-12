import {
  queueDefinitions,
  resolveQueueWorkerConcurrency,
  type QueueName,
} from "@obscura/contracts";

import { runMigrations } from "../../api/src/db/migrate.js";
import { queryClient } from "./lib/db.js";
import {
  initQueues,
  registerWorker,
  stopQueues,
  type WorkerHandler,
} from "./lib/queues.js";
import {
  markJobCompleted,
  markJobFailed,
  type JobLike,
} from "./lib/job-tracking.js";
import {
  ensureLibrarySettingsRow,
  scheduleRecurringScans,
  pruneJobRunHistory,
} from "./lib/scheduler.js";

import { processLibraryScan } from "./processors/library-scan.js";
import { processMediaProbe } from "./processors/media-probe.js";
import { processFingerprint } from "./processors/fingerprint.js";
import { processPreview } from "./processors/preview.js";
import { processMetadataImport } from "./processors/metadata-import.js";
import { processGalleryScan } from "./processors/gallery-scan.js";
import { processImageThumbnail } from "./processors/image-thumbnail.js";
import { processImageFingerprint } from "./processors/image-fingerprint.js";
import { processAudioScan } from "./processors/audio-scan.js";
import { processAudioProbe } from "./processors/audio-probe.js";
import { processAudioFingerprint } from "./processors/audio-fingerprint.js";
import { processAudioWaveform } from "./processors/audio-waveform.js";
import { processLibraryMaintenance } from "./processors/library-maintenance.js";
import { processExtractSubtitles } from "./processors/extract-subtitles.js";
import { processCollectionRefresh } from "./processors/collection-refresh.js";

// ─── Processor Map ──────────────────────────────────────────────────

const processorByQueue: Record<QueueName, (job: JobLike) => Promise<void>> = {
  "library-scan": processLibraryScan,
  "media-probe": processMediaProbe,
  fingerprint: processFingerprint,
  preview: processPreview,
  "metadata-import": processMetadataImport,
  "gallery-scan": processGalleryScan,
  "image-thumbnail": processImageThumbnail,
  "image-fingerprint": processImageFingerprint,
  "audio-scan": processAudioScan,
  "audio-probe": processAudioProbe,
  "audio-fingerprint": processAudioFingerprint,
  "audio-waveform": processAudioWaveform,
  "library-maintenance": processLibraryMaintenance,
  "extract-subtitles": processExtractSubtitles,
  "collection-refresh": processCollectionRefresh,
};

// ─── Worker Handler Factory ─────────────────────────────────────────
// Wraps each processor so we can mirror state into the `jobRuns` table
// (the single source of truth for UI rendering of queue state).

function wrapProcessor(
  queueName: QueueName,
  processor: (job: JobLike) => Promise<void>
): WorkerHandler {
  return async (job) => {
    try {
      await processor(job);
      await markJobCompleted(job, queueName);
    } catch (error) {
      await markJobFailed(job, queueName, error);
      throw error;
    }
  };
}

// ─── Bootstrap ──────────────────────────────────────────────────────

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://obscura:obscura@localhost:5432/obscura";

await runMigrations(databaseUrl);
await initQueues();
const libraryRowForWorkers = await ensureLibrarySettingsRow();

for (const definition of queueDefinitions) {
  const concurrency = resolveQueueWorkerConcurrency(
    definition.concurrency,
    libraryRowForWorkers.backgroundWorkerConcurrency
  );
  await registerWorker(definition.name, wrapProcessor(definition.name, processorByQueue[definition.name]), concurrency);
}

// ─── Recurring Timers ───────────────────────────────────────────────
// Worker concurrency is fixed at process start — to change it, restart the
// worker. pg-boss does not expose a hot "resize team" primitive the way
// BullMQ did, and the previous 15s resync was the only caller of it.

await scheduleRecurringScans();
setInterval(() => {
  void scheduleRecurringScans();
}, 60_000);

await pruneJobRunHistory();
setInterval(() => {
  void pruneJobRunHistory();
}, 10 * 60_000);

// ─── Startup Log ────────────────────────────────────────────────────

console.log(
  JSON.stringify(
    {
      service: "worker",
      queues: queueDefinitions.map((definition) => definition.name),
      backend: "pg-boss",
      backgroundWorkerConcurrency: resolveQueueWorkerConcurrency(
        1,
        libraryRowForWorkers.backgroundWorkerConcurrency
      ),
    },
    null,
    2
  )
);

// ─── Graceful Shutdown ──────────────────────────────────────────────

async function shutdown() {
  await stopQueues();
  await queryClient.end();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
