import {
  queueDefinitions,
  resolveQueueWorkerConcurrency,
  type QueueName,
} from "@obscura/contracts";
import { runMigrations } from "../../api/src/db/migrate.js";
import {
  closeDatabase,
  configureDatabase,
  getDatabaseUrl,
} from "./lib/db.js";
import {
  initQueues,
  registerWorker,
  stopQueues,
  unregisterWorker,
  type QueueAdapter,
  type RegisteredWorker,
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
  "plugin-batch-identify": async (job) => {
    // Bulk identify runs from the web UI today (see
    // `/identify` → `bulk-scrape.tsx`), which calls
    // `executePlugin` inline rather than enqueueing a job. This
    // queue is kept registered so the dispatcher doesn't reject
    // any stray rows that land in it from older deployments — we
    // log a warning and mark the job complete so the queue drains.
    const data = (job as { data?: unknown })?.data;
    console.warn(
      "[plugin-batch-identify] dropped unexpected job; bulk identify runs inline from the web UI now",
      data ?? null,
    );
  },
};

function wrapProcessor(
  queueName: QueueName,
  processor: (job: JobLike) => Promise<void>,
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

export interface WorkerTestDeps {
  databaseUrl?: string;
  queueAdapter?: QueueAdapter;
  logger?: Pick<Console, "log">;
  runMigrations?: boolean;
  startTimers?: boolean;
}

export function buildWorkerRuntime(deps: WorkerTestDeps = {}) {
  let started = false;
  const intervals: NodeJS.Timeout[] = [];
  const registeredWorkers: RegisteredWorker[] = [];
  const logger = deps.logger ?? console;

  return {
    async start() {
      if (started) {
        return;
      }

      if (deps.databaseUrl) {
        await configureDatabase({ connectionString: deps.databaseUrl });
      }
      if (deps.queueAdapter) {
        const { configureQueueAdapter } = await import("./lib/queues.js");
        configureQueueAdapter(deps.queueAdapter);
      }

      if (deps.runMigrations !== false) {
        await runMigrations(getDatabaseUrl());
      }

      await initQueues();
      const libraryRowForWorkers = await ensureLibrarySettingsRow();

      for (const definition of queueDefinitions) {
        const concurrency = resolveQueueWorkerConcurrency(
          definition.concurrency,
          libraryRowForWorkers.backgroundWorkerConcurrency,
        );
        registeredWorkers.push(
          await registerWorker(
            definition.name,
            wrapProcessor(definition.name, processorByQueue[definition.name]),
            concurrency,
          ),
        );
      }

      if (deps.startTimers !== false) {
        await scheduleRecurringScans();
        intervals.push(
          setInterval(() => {
            void scheduleRecurringScans();
          }, 60_000),
        );

        await pruneJobRunHistory();
        intervals.push(
          setInterval(() => {
            void pruneJobRunHistory();
          }, 10 * 60_000),
        );
      }

      logger.log(
        JSON.stringify(
          {
            service: "worker",
            queues: queueDefinitions.map((definition) => definition.name),
            backend: "pg-boss",
            backgroundWorkerConcurrency: resolveQueueWorkerConcurrency(
              1,
              libraryRowForWorkers.backgroundWorkerConcurrency,
            ),
          },
          null,
          2,
        ),
      );

      started = true;
    },

    async stop() {
      while (intervals.length > 0) {
        clearInterval(intervals.pop()!);
      }

      while (registeredWorkers.length > 0) {
        const worker = registeredWorkers.pop()!;
        await unregisterWorker(worker.workerId);
      }

      await stopQueues();
      await closeDatabase();
      started = false;
    },

    get registeredWorkers() {
      return [...registeredWorkers];
    },
  };
}
