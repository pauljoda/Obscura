import { Queue } from "bullmq";
import IORedis from "ioredis";
import { queueDefinitions, type QueueName } from "@obscura/contracts";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const queueMap = Object.fromEntries(
  queueDefinitions.map((definition) => [
    definition.name,
    new Queue(definition.name, {
      connection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }),
  ])
) as Record<QueueName, Queue>;

export function getQueue(queueName: QueueName) {
  return queueMap[queueName];
}
