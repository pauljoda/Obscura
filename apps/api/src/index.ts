import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { apiRoutes } from "@obscura/contracts";
import { scenesRoutes } from "./routes/scenes";
import { performersRoutes } from "./routes/performers";
import { streamRoutes } from "./routes/stream";
import { settingsRoutes } from "./routes/settings";
import { jobsRoutes } from "./routes/jobs";
import { assetsRoutes } from "./routes/assets";
import { scrapersRoutes } from "./routes/scrapers";
import { galleriesRoutes } from "./routes/galleries";

const app = Fastify({
  logger: true,
});

// Enable CORS for the web frontend
await app.register(cors, {
  origin: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

// Multipart support for file uploads
await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
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
await app.register(performersRoutes);
await app.register(galleriesRoutes);
await app.register(streamRoutes);
await app.register(scrapersRoutes);

// ─── Start ────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
