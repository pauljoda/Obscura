import type { FastifyInstance } from "fastify";
import { buildApiApp } from "../../apps/api/src/app.ts";
import { closeDatabase } from "../../apps/api/src/db/index.ts";
import { stopQueues } from "../../apps/api/src/lib/queues.ts";
import { FakeQueueAdapter } from "./queues.ts";
import { createPostgresTestContext } from "./postgres.ts";

export async function createApiTestContext() {
  const database = await createPostgresTestContext();
  const queue = new FakeQueueAdapter();
  const app = await buildApiApp({
    databaseUrl: database.connectionString,
    queueAdapter: queue,
  });

  return {
    app,
    db: database.db,
    queue,
    connectionString: database.connectionString,
    async close() {
      await app.close();
      await stopQueues();
      await closeDatabase();
      await database.close();
    },
  };
}

export type ApiTestContext = Awaited<ReturnType<typeof createApiTestContext>>;

export async function injectJson<T>(
  app: FastifyInstance,
  input: {
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    url: string;
    payload?: unknown;
    headers?: Record<string, string>;
  },
) {
  const response = await app.inject({
    method: input.method,
    url: input.url,
    payload: input.payload,
    headers: {
      "content-type": "application/json",
      ...(input.headers ?? {}),
    },
  });

  return {
    response,
    json: response.body ? (response.json() as T) : null,
  };
}
