import { Worker, type Job } from "bullmq";
import {
  queueDefinitions,
  resolveQueueWorkerConcurrency,
  type QueueName,
} from "@obscura/contracts";

import { queryClient } from "./lib/db.js";
import { redis, redisUrl, workerQueues } from "./lib/queues.js";
import { markJobCompleted, markJobFailed } from "./lib/job-tracking.js";
import {
  ensureLibrarySettingsRow,
  scheduleRecurringScans,
  syncWorkerConcurrencyFromSettings,
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

// ─── Processor Map ──────────────────────────────────────────────────

const processorByQueue: Record<QueueName, (job: Job) => Promise<void>> = {
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
};

// ─── Worker Factory ─────────────────────────────────────────────────

function createWorker(
  queueName: QueueName,
  processor: (job: Job) => Promise<void>,
  concurrency: number
) {
  return new Worker(
    queueName,
    async (job) => {
      try {
        await processor(job);
        await markJobCompleted(job, queueName);
      } catch (error) {
        await markJobFailed(job, queueName, error);
        throw error;
      }
    },
    {
      connection: redis,
      concurrency,
    }
  );
}

// ─── Bootstrap ──────────────────────────────────────────────────────

const libraryRowForWorkers = await ensureLibrarySettingsRow();
const workers = queueDefinitions.map((definition) =>
  createWorker(
    definition.name,
    processorByQueue[definition.name],
    resolveQueueWorkerConcurrency(definition.concurrency, libraryRowForWorkers.backgroundWorkerConcurrency)
  )
);

// ─── Recurring Timers ───────────────────────────────────────────────

setInterval(() => {
  void syncWorkerConcurrencyFromSettings(workers);
}, 15_000);

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
      redisUrl,
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

process.on("SIGINT", async () => {
  await Promise.all(workers.map((worker) => worker.close()));
  await Promise.all(Object.values(workerQueues).map((queue) => queue.close()));
  await redis.quit();
  await queryClient.end();
  process.exit(0);
});
