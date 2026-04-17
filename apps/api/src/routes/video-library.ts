import type { FastifyInstance } from "fastify";
import { apiRoutes } from "@obscura/contracts";
import {
  listLibraryVideoMovies,
  listLibraryVideoSeries,
  getLibraryVideoSeriesDetail,
  getLibraryVideoMovieDetail,
  getLibraryVideoEpisodeDetail,
  getLibraryVideoCounts,
} from "../services/video-library.service";

export async function videoLibraryRoutes(app: FastifyInstance) {
  app.get(apiRoutes.videoLibraryCounts, async () => {
    return getLibraryVideoCounts();
  });

  app.get(apiRoutes.videoMovies, async (request) => {
    const query = request.query as {
      limit?: string;
      offset?: string;
    };
    const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;
    const offset = query.offset ? Number.parseInt(query.offset, 10) : undefined;
    return listLibraryVideoMovies({ limit, offset });
  });

  app.get(apiRoutes.videoMovieDetail, async (request, reply) => {
    const { id } = request.params as { id: string };
    const movie = await getLibraryVideoMovieDetail(id);
    if (!movie) {
      return reply.code(404).send({ error: "not found" });
    }
    return movie;
  });

  app.get(apiRoutes.videoLibrarySeries, async (request) => {
    const query = request.query as {
      limit?: string;
      offset?: string;
    };
    const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;
    const offset = query.offset ? Number.parseInt(query.offset, 10) : undefined;
    return listLibraryVideoSeries({ limit, offset });
  });

  app.get(apiRoutes.videoLibrarySeriesDetail, async (request, reply) => {
    const { id } = request.params as { id: string };
    const series = await getLibraryVideoSeriesDetail(id);
    if (!series) {
      return reply.code(404).send({ error: "not found" });
    }
    return series;
  });

  app.get(apiRoutes.videoEpisodeDetail, async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await getLibraryVideoEpisodeDetail(id);
    if (!episode) {
      return reply.code(404).send({ error: "not found" });
    }
    return episode;
  });
}
