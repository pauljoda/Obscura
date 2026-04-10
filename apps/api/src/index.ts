import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { apiRoutes } from "@obscura/contracts";
import errorHandler from "./plugins/error-handler";
import { scenesRoutes } from "./routes/scenes";
import { studiosRoutes } from "./routes/studios";
import { tagsRoutes } from "./routes/tags";
import { performersRoutes } from "./routes/performers";
import { streamRoutes } from "./routes/stream";
import { settingsRoutes } from "./routes/settings";
import { jobsRoutes } from "./routes/jobs";
import { assetsRoutes } from "./routes/assets";
import { scrapersRoutes } from "./routes/scrapers";
import { stashboxRoutes } from "./routes/stashbox";
import { galleriesRoutes } from "./routes/galleries";
import { imagesRoutes } from "./routes/images";
import { searchRoutes } from "./routes/search";
import { changelogRoutes } from "./routes/changelog";
import { audioLibrariesRoutes } from "./routes/audio-libraries";
import { audioTracksRoutes } from "./routes/audio-tracks";
import { audioStreamRoutes } from "./routes/audio-stream";
import { initQueues, stopQueues } from "./lib/queues";
import pkg from "../../../package.json";

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

// ─── Error handler ────────────────────────────────────────────────
await app.register(errorHandler);

// ─── Core routes ──────────────────────────────────────────────────
app.get(apiRoutes.health, async () => ({
  status: "ok",
  service: "api",
  version: pkg.version,
}));
await app.register(changelogRoutes);

// ─── Feature routes ───────────────────────────────────────────────
await app.register(settingsRoutes);
await app.register(jobsRoutes);
await app.register(assetsRoutes);
await app.register(scenesRoutes);
await app.register(studiosRoutes);
await app.register(tagsRoutes);
await app.register(performersRoutes);
await app.register(galleriesRoutes);
await app.register(imagesRoutes);
await app.register(streamRoutes);
await app.register(scrapersRoutes);
await app.register(stashboxRoutes);
await app.register(searchRoutes);
await app.register(audioLibrariesRoutes);
await app.register(audioTracksRoutes);
await app.register(audioStreamRoutes);

// ─── Start ────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

// Boot pg-boss before accepting traffic so the first /jobs request doesn't
// pay the one-time schema creation cost.
await initQueues();

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});

async function shutdown() {
  await stopQueues();
  await app.close();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
