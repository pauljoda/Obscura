import Fastify from "fastify";

import { apiRoutes, queueDefinitions } from "@obscura/contracts";

const app = Fastify({
  logger: true
});

app.get(apiRoutes.health, async () => ({
  status: "ok",
  service: "api",
  version: "0.1.0"
}));

app.get(apiRoutes.jobs, async () => ({
  queues: queueDefinitions.map((queue) => ({
    name: queue.name,
    description: queue.description,
    status: "not-configured"
  }))
}));

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});

