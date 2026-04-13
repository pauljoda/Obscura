import type { QueueName } from "@obscura/contracts";
import type { QueueAdapter as ApiQueueAdapter } from "../../apps/api/src/lib/queues.ts";
import type {
  QueueAdapter as WorkerQueueAdapter,
  RegisteredWorker,
  WorkerHandler,
} from "../../apps/worker/src/lib/queues.ts";

type EnqueuedJob = {
  id: string;
  queueName: QueueName;
  data: Record<string, unknown>;
};

export class FakeQueueAdapter
  implements ApiQueueAdapter, WorkerQueueAdapter
{
  public jobs: EnqueuedJob[] = [];
  public workers: Array<RegisteredWorker & { handler: WorkerHandler }> = [];
  private nextJobId = 1;
  private nextWorkerId = 1;

  async init() {
    return null as never;
  }

  async getBoss() {
    return null as never;
  }

  async sendJob(queueName: QueueName, data: Record<string, unknown>) {
    const id = `job-${this.nextJobId++}`;
    this.jobs.push({ id, queueName, data });
    return id;
  }

  async cancelJob(_queueName: QueueName, _jobId: string) {}

  async deleteJob(_queueName: QueueName, _jobId: string) {}

  async registerWorker(
    queueName: QueueName,
    handler: WorkerHandler,
    concurrency: number,
  ) {
    const worker = {
      queueName,
      concurrency,
      workerId: `worker-${this.nextWorkerId++}`,
      handler,
    };
    this.workers.push(worker);
    return worker;
  }

  async unregisterWorker(workerId: string) {
    this.workers = this.workers.filter((worker) => worker.workerId !== workerId);
  }

  async stop() {
    this.jobs = [];
    this.workers = [];
  }
}
