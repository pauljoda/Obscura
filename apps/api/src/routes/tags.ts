import type { FastifyInstance } from "fastify";
import * as tagService from "../services/tag.service";

export async function tagsRoutes(app: FastifyInstance) {
  // ─── GET /tags ───────────────────────────────────────────────
  app.get("/tags", async (request) => {
    const q = request.query as { nsfw?: string };
    return tagService.listTags(q.nsfw === "off");
  });

  // ─── GET /tags/:id ───────────────────────────────────────────
  app.get("/tags/:id", async (request) => {
    const { id } = request.params as { id: string };
    const q = request.query as { nsfw?: string };
    return tagService.getTagById(id, q.nsfw === "off");
  });

  // ─── PATCH /tags/:id ──────────────────────────────────────────
  app.patch("/tags/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      description?: string | null;
      aliases?: string | null;
      imageUrl?: string | null;
      parentId?: string | null;
      favorite?: boolean;
      rating?: number | null;
      ignoreAutoTag?: boolean;
      isNsfw?: boolean;
    };
    return tagService.updateTag(id, body);
  });

  // ─── POST /tags ─────────────────────────────────────────────
  app.post("/tags", async (request, reply) => {
    const body = request.body as {
      name: string;
      description?: string;
      aliases?: string;
    };
    const result = await tagService.createTag(body);
    reply.code(201);
    return result;
  });

  // ─── DELETE /tags/:id ───────────────────────────────────────
  app.delete("/tags/:id", async (request) => {
    const { id } = request.params as { id: string };
    return tagService.deleteTag(id);
  });

  // ─── PATCH /tags/:id/favorite ───────────────────────────────
  app.patch("/tags/:id/favorite", async (request) => {
    const { id } = request.params as { id: string };
    const { favorite } = request.body as { favorite: boolean };
    return tagService.setTagFavorite(id, favorite);
  });

  // ─── PATCH /tags/:id/rating ─────────────────────────────────
  app.patch("/tags/:id/rating", async (request) => {
    const { id } = request.params as { id: string };
    const { rating } = request.body as { rating: number | null };
    return tagService.setTagRating(id, rating);
  });

  // ─── POST /tags/:id/image (multipart upload) ────────────────
  app.post("/tags/:id/image", async (request, reply) => {
    const { id } = request.params as { id: string };
    const file = await request.file();
    if (!file) {
      reply.code(400);
      return { error: "No file uploaded" };
    }
    const buffer = await file.toBuffer();
    return tagService.uploadTagImage(id, buffer);
  });

  // ─── POST /tags/:id/image/from-url ──────────────────────────
  app.post("/tags/:id/image/from-url", async (request) => {
    const { id } = request.params as { id: string };
    const { imageUrl } = request.body as { imageUrl: string };
    return tagService.setTagImageFromUrl(id, imageUrl);
  });

  // ─── DELETE /tags/:id/image ─────────────────────────────────
  app.delete("/tags/:id/image", async (request) => {
    const { id } = request.params as { id: string };
    return tagService.deleteTagImage(id);
  });
}
