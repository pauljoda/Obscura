import type { FastifyInstance } from "fastify";
import * as videoSceneService from "../services/video-scene.service";

export async function videosRoutes(app: FastifyInstance) {
  // ─── GET /videos ──────────────────────────────────────────────
  app.get("/videos", async (request) => {
    const query = request.query as videoSceneService.ListVideosQuery;
    return videoSceneService.listVideoScenes(query);
  });

  // ─── GET /videos/stats ────────────────────────────────────────
  app.get("/videos/stats", async (request) => {
    const query = request.query as { nsfw?: string };
    return videoSceneService.getVideoSceneStats(query.nsfw === "off");
  });

  // ─── GET /videos/:id ──────────────────────────────────────────
  app.get("/videos/:id", async (request) => {
    const { id } = request.params as { id: string };
    return videoSceneService.getVideoSceneDetail(id);
  });

  // ─── PATCH /videos/:id ────────────────────────────────────────
  app.patch("/videos/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as videoSceneService.UpdateVideoBody;
    return videoSceneService.updateVideoScene(id, body);
  });

  // ─── DELETE /videos/:id ───────────────────────────────────────
  app.delete("/videos/:id", async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { deleteFile?: string };
    return videoSceneService.deleteVideoScene(id, query.deleteFile === "true");
  });

  // ─── POST /videos/:id/reset-metadata ──────────────────────────
  app.post("/videos/:id/reset-metadata", async (request) => {
    const { id } = request.params as { id: string };
    return videoSceneService.resetVideoSceneMetadata(id);
  });
}
