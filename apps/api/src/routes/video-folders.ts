import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
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

  // ─── Cover / backdrop upload + delete ─────────────────────────
  // Writes the uploaded image to the series' cache directory and
  // points `video_series.posterPath` / `backdropPath` at the new
  // `/assets/video-folders/:id/{cover|backdrop}` URL. Delete clears
  // the on-disk file and resets the column only if it currently
  // references the user asset (so a scraper-supplied TMDb URL in the
  // same slot is preserved).
  async function handleUpload(
    request: import("fastify").FastifyRequest,
    reply: import("fastify").FastifyReply,
    kind: "cover" | "backdrop",
  ) {
    const { id } = request.params as { id: string };
    const parts = request.parts();
    let file: MultipartFile | undefined;
    for await (const part of parts) {
      if (part.type === "file") {
        file = part;
        break;
      }
    }
    if (!file) {
      reply.code(400);
      return { error: "file is required" };
    }
    return videoFolderService.uploadVideoFolderCover(id, kind, file);
  }

  app.post("/video-folders/:id/cover", (request, reply) =>
    handleUpload(request, reply, "cover"),
  );
  app.post("/video-folders/:id/backdrop", (request, reply) =>
    handleUpload(request, reply, "backdrop"),
  );

  app.delete("/video-folders/:id/cover", async (request) => {
    const { id } = request.params as { id: string };
    return videoFolderService.deleteVideoFolderCover(id, "cover");
  });

  app.delete("/video-folders/:id/backdrop", async (request) => {
    const { id } = request.params as { id: string };
    return videoFolderService.deleteVideoFolderCover(id, "backdrop");
  });
}
