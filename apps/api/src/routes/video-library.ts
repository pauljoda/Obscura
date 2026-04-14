import type { FastifyInstance } from "fastify";
import { apiRoutes } from "@obscura/contracts";
import {
  listVideoMovies,
  listVideoSeries,
  getVideoSeriesDetail,
  getVideoMovieDetail,
  getVideoEpisodeDetail,
  getVideoLibraryCounts,
} from "../services/video-library.service";

export async function videoLibraryRoutes(app: FastifyInstance) {
  app.get(apiRoutes.videoLibraryCounts, async () => {
    return getVideoLibraryCounts();
  });

  app.get(apiRoutes.videoMovies, async (request) => {
    const query = request.query as {
      limit?: string;
      offset?: string;
    };
    const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;
    const offset = query.offset ? Number.parseInt(query.offset, 10) : undefined;
    return listVideoMovies({ limit, offset });
  });

  app.get(apiRoutes.videoMovieDetail, async (request, reply) => {
    const { id } = request.params as { id: string };
    const movie = await getVideoMovieDetail(id);
    if (!movie) {
      return reply.code(404).send({ error: "not found" });
    }
    return movie;
  });

  app.get(apiRoutes.videoSeries, async (request) => {
    const query = request.query as {
      limit?: string;
      offset?: string;
    };
    const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;
    const offset = query.offset ? Number.parseInt(query.offset, 10) : undefined;
    return listVideoSeries({ limit, offset });
  });

  app.get(apiRoutes.videoSeriesDetail, async (request, reply) => {
    const { id } = request.params as { id: string };
    const series = await getVideoSeriesDetail(id);
    if (!series) {
      return reply.code(404).send({ error: "not found" });
    }
    return series;
  });

  app.get(apiRoutes.videoEpisodeDetail, async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await getVideoEpisodeDetail(id);
    if (!episode) {
      return reply.code(404).send({ error: "not found" });
    }
    return episode;
  });
}
