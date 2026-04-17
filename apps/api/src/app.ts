import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { apiRoutes } from "@obscura/contracts";
import errorHandler from "./plugins/error-handler";
import { changelogRoutes } from "./routes/changelog";
import { settingsRoutes } from "./routes/settings";
import { jobsRoutes } from "./routes/jobs";
import { assetsRoutes } from "./routes/assets";
import { studiosRoutes } from "./routes/studios";
import { tagsRoutes } from "./routes/tags";
import { performersRoutes } from "./routes/performers";
import { galleriesRoutes } from "./routes/galleries";
import { imagesRoutes } from "./routes/images";
import { scrapersRoutes } from "./routes/scrapers";
import { stashboxRoutes } from "./routes/stashbox";
import { searchRoutes } from "./routes/search";
import { audioLibrariesRoutes } from "./routes/audio-libraries";
import { audioTracksRoutes } from "./routes/audio-tracks";
import { audioStreamRoutes } from "./routes/audio-stream";
import { collectionsRoutes } from "./routes/collections";
import { pluginsRoutes } from "./routes/plugins";
import { systemRoutes } from "./routes/system";
import { videoAcceptRoutes } from "./routes/video-accept";
import { videoLibraryRoutes } from "./routes/video-library";
import { videosRoutes } from "./routes/videos";
import { videoSeriesRoutes } from "./routes/video-series";
import { videoStreamRoutes } from "./routes/video-stream";
import { configureDatabase } from "./db";
import {
  configureQueueAdapter,
  type QueueAdapter,
} from "./lib/queues";
import pkg from "../../../package.json";

export interface ApiTestDeps {
  databaseUrl?: string;
  logger?: boolean;
  queueAdapter?: QueueAdapter;
}

export async function buildApiApp(
  deps: ApiTestDeps = {},
): Promise<FastifyInstance> {
  if (deps.databaseUrl) {
    await configureDatabase({ connectionString: deps.databaseUrl });
  }
  if (deps.queueAdapter) {
    configureQueueAdapter(deps.queueAdapter);
  }

  const app = Fastify({
    logger: deps.logger ?? false,
  });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024 * 1024 },
  });

  await app.register(errorHandler);

  app.get(apiRoutes.health, async () => ({
    status: "ok",
    service: "api",
    version: pkg.version,
  }));
  await app.register(changelogRoutes);
  await app.register(settingsRoutes);
  await app.register(jobsRoutes);
  await app.register(assetsRoutes);
  await app.register(studiosRoutes);
  await app.register(tagsRoutes);
  await app.register(performersRoutes);
  await app.register(galleriesRoutes);
  await app.register(imagesRoutes);
  await app.register(scrapersRoutes);
  await app.register(stashboxRoutes);
  await app.register(searchRoutes);
  await app.register(audioLibrariesRoutes);
  await app.register(audioTracksRoutes);
  await app.register(audioStreamRoutes);
  await app.register(collectionsRoutes);
  await app.register(pluginsRoutes);
  await app.register(systemRoutes);
  await app.register(videoAcceptRoutes);
  await app.register(videoLibraryRoutes);
  await app.register(videosRoutes);
  await app.register(videoSeriesRoutes);
  await app.register(videoStreamRoutes);

  return app;
}
