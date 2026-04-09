import { Queue } from "bullmq";
import IORedis from "ioredis";
import {
  queueDefinitions,
  queueRedisRetention,
  type QueueName,
} from "@obscura/contracts";

export const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const workerQueues = Object.fromEntries(
  queueDefinitions.map((definition) => [
    definition.name,
    new Queue(definition.name, {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: queueRedisRetention.completed,
        removeOnFail: queueRedisRetention.failed,
      },
    }),
  ])
) as Record<QueueName, Queue>;

export function getWorkerQueue(queueName: QueueName) {
  return workerQueues[queueName];
}
