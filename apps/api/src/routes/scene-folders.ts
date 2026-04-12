import type { FastifyInstance } from "fastify";
import * as sceneFolderService from "../services/scene-folder.service";

export async function sceneFoldersRoutes(app: FastifyInstance) {
  app.get("/scene-folders", async (request) => {
    const query = request.query as {
      parent?: string;
      root?: string;
      search?: string;
      limit?: string;
      offset?: string;
      nsfw?: string;
    };
    return sceneFolderService.listSceneFolders(query);
  });

  app.get("/scene-folders/:id", async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { nsfw?: string };
    return sceneFolderService.getSceneFolderById(id, query.nsfw);
  });

  app.patch("/scene-folders/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { isNsfw?: boolean };
    return sceneFolderService.updateSceneFolder(id, body);
  });

  app.post("/scene-folders/:id/cover", async (request, reply) => {
    const { id } = request.params as { id: string };
    const file = await request.file();
    if (!file) {
      reply.code(400);
      return { error: "No file uploaded" };
    }
    const buffer = await file.toBuffer();
    return sceneFolderService.setSceneFolderCover(id, buffer);
  });

  app.delete("/scene-folders/:id/cover", async (request) => {
    const { id } = request.params as { id: string };
    return sceneFolderService.clearSceneFolderCover(id);
  });
}
