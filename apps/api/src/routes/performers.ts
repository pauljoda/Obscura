import type { FastifyInstance } from "fastify";
import * as performerService from "../services/performer.service";
import type {
  CreatePerformerBody,
  UpdatePerformerBody,
  ListPerformersQuery,
} from "../services/performer.service";

export async function performersRoutes(app: FastifyInstance) {
  // ─── GET /performers ────────────────────────────────────────────
  app.get("/performers", async (request) => {
    const query = request.query as ListPerformersQuery;
    return performerService.listPerformers(query);
  });

  // ─── GET /performers/:id ────────────────────────────────────────
  app.get("/performers/:id", async (request) => {
    const { id } = request.params as { id: string };
    const q = request.query as { nsfw?: string };
    return performerService.getPerformerById(id, q.nsfw === "off");
  });

  // ─── POST /performers ──────────────────────────────────────────
  app.post("/performers", async (request, reply) => {
    const body = request.body as CreatePerformerBody;
    const result = await performerService.createPerformer(body);
    reply.code(201);
    return result;
  });

  // ─── PATCH /performers/:id ─────────────────────────────────────
  app.patch("/performers/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdatePerformerBody;
    return performerService.updatePerformer(id, body);
  });

  // ─── DELETE /performers/:id ────────────────────────────────────
  app.delete("/performers/:id", async (request) => {
    const { id } = request.params as { id: string };
    return performerService.deletePerformer(id);
  });

  // ─── PATCH /performers/:id/favorite ────────────────────────────
  app.patch("/performers/:id/favorite", async (request) => {
    const { id } = request.params as { id: string };
    const { favorite } = request.body as { favorite: boolean };
    return performerService.setPerformerFavorite(id, favorite);
  });

  // ─── PATCH /performers/:id/rating ──────────────────────────────
  app.patch("/performers/:id/rating", async (request) => {
    const { id } = request.params as { id: string };
    const { rating } = request.body as { rating: number | null };
    return performerService.setPerformerRating(id, rating);
  });

  // ─── POST /performers/:id/image (multipart upload) ─────────────
  app.post("/performers/:id/image", async (request, reply) => {
    const { id } = request.params as { id: string };
    const file = await request.file();
    if (!file) {
      reply.code(400);
      return { error: "No file uploaded" };
    }
    const buffer = await file.toBuffer();
    return performerService.uploadPerformerImage(id, buffer);
  });

  // ─── POST /performers/:id/image/from-url ───────────────────────
  app.post("/performers/:id/image/from-url", async (request) => {
    const { id } = request.params as { id: string };
    const { imageUrl } = request.body as { imageUrl: string };
    return performerService.setPerformerImageFromUrl(id, imageUrl);
  });

  // ─── DELETE /performers/:id/image ──────────────────────────────
  app.delete("/performers/:id/image", async (request) => {
    const { id } = request.params as { id: string };
    return performerService.deletePerformerImage(id);
  });
}
