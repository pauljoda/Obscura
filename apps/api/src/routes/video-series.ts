import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { apiRoutes } from "@obscura/contracts";
import * as videoSeriesService from "../services/video-series.service";

export async function videoSeriesRoutes(app: FastifyInstance) {
  app.get(apiRoutes.videoSeries, async (request) => {
    const query = request.query as {
      parent?: string;
      root?: string;
      search?: string;
      limit?: string;
      offset?: string;
      nsfw?: string;
      studio?: string;
      tag?: string;
      performer?: string;
    };
    return videoSeriesService.listVideoSeries(query);
  });

  app.get(apiRoutes.videoSeriesDetail, async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { nsfw?: string };
    return videoSeriesService.getVideoSeriesDetail(id, query.nsfw);
  });

  app.patch(apiRoutes.videoSeriesDetail, async (request) => {
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
    return videoSeriesService.updateVideoSeries(id, body);
  });

  // Cover / backdrop upload + delete. Writes the uploaded image to the
  // series' cache directory and points `video_series.posterPath` /
  // `backdropPath` at `/assets/video-series/:id/{cover|backdrop}`.
  // Delete clears the on-disk file and resets the column only when it
  // currently references the user asset (so a scraper-supplied TMDb URL
  // in the same slot is preserved).
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
    return videoSeriesService.uploadVideoSeriesCover(id, kind, file);
  }

  app.post(apiRoutes.videoSeriesCover, (request, reply) =>
    handleUpload(request, reply, "cover"),
  );
  app.post(apiRoutes.videoSeriesBackdrop, (request, reply) =>
    handleUpload(request, reply, "backdrop"),
  );

  app.delete(apiRoutes.videoSeriesCover, async (request) => {
    const { id } = request.params as { id: string };
    return videoSeriesService.deleteVideoSeriesCover(id, "cover");
  });

  app.delete(apiRoutes.videoSeriesBackdrop, async (request) => {
    const { id } = request.params as { id: string };
    return videoSeriesService.deleteVideoSeriesCover(id, "backdrop");
  });
}
