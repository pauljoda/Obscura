import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { apiRoutes } from "@obscura/contracts";
import type {
  NormalizedMovieResult,
  NormalizedEpisodeResult,
} from "@obscura/contracts";
import { scrapeResults } from "@obscura/db/src/schema";
import { db } from "../db";
import {
  acceptMovieScrape,
  acceptEpisodeScrape,
  type AcceptFieldMask,
} from "../services/scrape-accept.service";

interface AcceptBody {
  scrapeResultId: string;
  fieldMask?: AcceptFieldMask;
}

export async function videoAcceptRoutes(app: FastifyInstance) {
  app.post(apiRoutes.videoMovieAcceptScrape, async (request, reply) => {
    const { id: movieId } = request.params as { id: string };
    const body = request.body as AcceptBody;
    if (!body?.scrapeResultId) {
      return reply.code(400).send({ ok: false, error: "scrapeResultId required" });
    }
    const [row] = await db
      .select()
      .from(scrapeResults)
      .where(eq(scrapeResults.id, body.scrapeResultId))
      .limit(1);
    if (!row) {
      return reply.code(404).send({ ok: false, error: "scrape result not found" });
    }
    const proposed = row.proposedResult as unknown;
    if (!proposed || typeof proposed !== "object") {
      return reply.code(400).send({
        ok: false,
        error: "scrape result has no proposed_result payload",
      });
    }
    await acceptMovieScrape({
      scrapeResultId: body.scrapeResultId,
      movieId,
      result: proposed as NormalizedMovieResult,
      fieldMask: body.fieldMask,
    });
    return { ok: true };
  });

  app.post(apiRoutes.videoEpisodeAcceptScrape, async (request, reply) => {
    const { id: episodeId } = request.params as { id: string };
    const body = request.body as AcceptBody;
    if (!body?.scrapeResultId) {
      return reply.code(400).send({ ok: false, error: "scrapeResultId required" });
    }
    const [row] = await db
      .select()
      .from(scrapeResults)
      .where(eq(scrapeResults.id, body.scrapeResultId))
      .limit(1);
    if (!row) {
      return reply.code(404).send({ ok: false, error: "scrape result not found" });
    }
    const proposed = row.proposedResult as unknown;
    if (!proposed || typeof proposed !== "object") {
      return reply.code(400).send({
        ok: false,
        error: "scrape result has no proposed_result payload",
      });
    }
    await acceptEpisodeScrape({
      scrapeResultId: body.scrapeResultId,
      episodeId,
      result: proposed as NormalizedEpisodeResult,
      fieldMask: body.fieldMask,
    });
    return { ok: true };
  });
}
