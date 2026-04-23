import type { FastifyInstance } from "fastify";
import { apiRoutes } from "@obscura/contracts";
import {
  ConflictError,
  InternalError,
  NotFoundError,
  UpstreamError,
  ValidationError,
  acceptEpisodeScrapeWrite,
  acceptMovieScrapeWrite,
  acceptSeriesScrapeWrite,
  type AcceptEpisodeScrapeInput,
  type AcceptMovieScrapeInput,
  type AcceptSeriesScrapeInput,
} from "@obscura/app-core";
import { db } from "../db";
import { AppError } from "../plugins/error-handler";

function rethrowAppCoreError(error: unknown): never {
  if (error instanceof NotFoundError) throw new AppError(404, error.message);
  if (error instanceof ValidationError) throw new AppError(400, error.message);
  if (error instanceof UpstreamError) throw new AppError(502, error.message);
  if (error instanceof ConflictError) throw new AppError(409, error.message);
  if (error instanceof InternalError) throw new AppError(500, error.message);
  throw error;
}

export async function videoAcceptRoutes(app: FastifyInstance) {
  app.post(apiRoutes.videoMovieAcceptScrape, async (request) => {
    try {
      const { id: movieId } = request.params as { id: string };
      const body = (request.body ?? {}) as Omit<AcceptMovieScrapeInput, "movieId">;
      return await acceptMovieScrapeWrite(db, {
        movieId,
        ...body,
      });
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  app.post(apiRoutes.videoEpisodeAcceptScrape, async (request) => {
    try {
      const { id: episodeId } = request.params as { id: string };
      const body = (request.body ?? {}) as Omit<
        AcceptEpisodeScrapeInput,
        "episodeId"
      >;
      return await acceptEpisodeScrapeWrite(db, {
        episodeId,
        ...body,
      });
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  app.post(apiRoutes.videoSeriesAcceptScrape, async (request) => {
    try {
      const { id: seriesId } = request.params as { id: string };
      const body = (request.body ?? {}) as Omit<AcceptSeriesScrapeInput, "seriesId">;
      return await acceptSeriesScrapeWrite(db, {
        seriesId,
        ...body,
      });
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });
}
