import Fastify from "fastify";
import cors from "@fastify/cors";
import { apiRoutes, queueDefinitions } from "@obscura/contracts";
import { scenesRoutes } from "./routes/scenes";
import { streamRoutes } from "./routes/stream";

const app = Fastify({
  logger: true,
});

// Enable CORS for the web frontend
await app.register(cors, {
  origin: true,
});

// ─── Core routes ──────────────────────────────────────────────────
app.get(apiRoutes.health, async () => ({
  status: "ok",
  service: "api",
  version: "0.1.0",
}));

app.get(apiRoutes.jobs, async () => ({
  queues: queueDefinitions.map((queue) => ({
    name: queue.name,
    description: queue.description,
    status: "not-configured",
  })),
}));

// ─── Feature routes ───────────────────────────────────────────────
await app.register(scenesRoutes);
await app.register(streamRoutes);

// ─── Start ────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
