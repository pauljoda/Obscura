import type { FastifyInstance } from "fastify";
import * as videoFolderService from "../services/video-folder.service";

export async function videoFoldersRoutes(app: FastifyInstance) {
  app.get("/video-folders", async (request) => {
    const query = request.query as {
      parent?: string;
      root?: string;
      search?: string;
      limit?: string;
      offset?: string;
      nsfw?: string;
      studio?: string;
      tag?: string;
    };
    return videoFolderService.listVideoFolders(query);
  });

  app.get("/video-folders/:id", async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { nsfw?: string };
    return videoFolderService.getVideoFolderDetail(id, query.nsfw);
  });

  app.patch("/video-folders/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      isNsfw?: boolean;
      customName?: string | null;
      details?: string | null;
      studioName?: string | null;
      performerNames?: string[];
      tagNames?: string[];
      rating?: number | null;
      date?: string | null;
    };
    return videoFolderService.updateVideoFolder(id, body);
  });

  // Cover/backdrop upload for video folders is not yet wired — the
  // underlying video_series row uses `posterPath` / `backdropPath`
  // populated by scrapers, not user uploads. Real upload support lands
  // alongside the unified folder-asset storage change.
  // TODO(videos): implement cover/backdrop upload + delete.
  app.post("/video-folders/:id/cover", async (_request, reply) => {
    reply.code(501);
    return { error: "Cover upload not yet supported for video folders" };
  });
  app.delete("/video-folders/:id/cover", async (_request, reply) => {
    reply.code(501);
    return { error: "Cover delete not yet supported for video folders" };
  });
  app.post("/video-folders/:id/backdrop", async (_request, reply) => {
    reply.code(501);
    return { error: "Backdrop upload not yet supported for video folders" };
  });
  app.delete("/video-folders/:id/backdrop", async (_request, reply) => {
    reply.code(501);
    return { error: "Backdrop delete not yet supported for video folders" };
  });
}
