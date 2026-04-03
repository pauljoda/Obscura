import Fastify from "fastify";
import cors from "@fastify/cors";
import { apiRoutes } from "@obscura/contracts";
import { scenesRoutes } from "./routes/scenes";
import { streamRoutes } from "./routes/stream";
import { settingsRoutes } from "./routes/settings";
import { jobsRoutes } from "./routes/jobs";
import { assetsRoutes } from "./routes/assets";

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

// ─── Feature routes ───────────────────────────────────────────────
await app.register(settingsRoutes);
await app.register(jobsRoutes);
await app.register(assetsRoutes);
await app.register(scenesRoutes);
await app.register(streamRoutes);

// ─── Start ────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
