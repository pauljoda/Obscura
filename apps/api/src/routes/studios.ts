import type { FastifyInstance } from "fastify";
import * as studioService from "../services/studio.service";

export async function studiosRoutes(app: FastifyInstance) {
  // ─── GET /studios ────────────────────────────────────────────
  app.get("/studios", async (request) => {
    const q = request.query as { nsfw?: string };
    return studioService.listStudios(q.nsfw === "off");
  });

  // ─── GET /studios/:id ─────────────────────────────────────────
  app.get("/studios/:id", async (request) => {
    const { id } = request.params as { id: string };
    const q = request.query as { nsfw?: string };
    return studioService.getStudioById(id, q.nsfw === "off");
  });

  // ─── PATCH /studios/:id ───────────────────────────────────────
  app.patch("/studios/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      description?: string | null;
      aliases?: string | null;
      url?: string | null;
      imageUrl?: string | null;
      parentId?: string | null;
      favorite?: boolean;
      rating?: number | null;
      isNsfw?: boolean;
    };
    return studioService.updateStudio(id, body);
  });

  // ─── POST /studios ──────────────────────────────────────────
  app.post("/studios", async (request, reply) => {
    const body = request.body as {
      name: string;
      description?: string;
      aliases?: string;
      url?: string;
      parentId?: string;
    };
    const result = await studioService.createStudio(body);
    reply.code(201);
    return result;
  });

  // ─── POST /studios/find-or-create ────────────────────────────
  app.post("/studios/find-or-create", async (request) => {
    const body = request.body as {
      name: string;
      url?: string | null;
      imageUrl?: string | null;
      parentName?: string | null;
      parentUrl?: string | null;
      parentImageUrl?: string | null;
      scrapedEndpointId?: string | null;
      scrapedRemoteId?: string | null;
    };
    return studioService.findOrCreateStudio(body);
  });

  // ─── DELETE /studios/:id ────────────────────────────────────
  app.delete("/studios/:id", async (request) => {
    const { id } = request.params as { id: string };
    return studioService.deleteStudio(id);
  });

  // ─── PATCH /studios/:id/favorite ────────────────────────────
  app.patch("/studios/:id/favorite", async (request) => {
    const { id } = request.params as { id: string };
    const { favorite } = request.body as { favorite: boolean };
    return studioService.setStudioFavorite(id, favorite);
  });

  // ─── PATCH /studios/:id/rating ──────────────────────────────
  app.patch("/studios/:id/rating", async (request) => {
    const { id } = request.params as { id: string };
    const { rating } = request.body as { rating: number | null };
    return studioService.setStudioRating(id, rating);
  });

  // ─── POST /studios/:id/image (multipart upload) ─────────────
  app.post("/studios/:id/image", async (request, reply) => {
    const { id } = request.params as { id: string };
    const file = await request.file();
    if (!file) {
      reply.code(400);
      return { error: "No file uploaded" };
    }
    const buffer = await file.toBuffer();
    return studioService.uploadStudioImage(id, buffer);
  });

  // ─── POST /studios/:id/image/from-url ───────────────────────
  app.post("/studios/:id/image/from-url", async (request) => {
    const { id } = request.params as { id: string };
    const { imageUrl } = request.body as { imageUrl: string };
    return studioService.setStudioImageFromUrl(id, imageUrl);
  });

  // ─── DELETE /studios/:id/image ──────────────────────────────
  app.delete("/studios/:id/image", async (request) => {
    const { id } = request.params as { id: string };
    return studioService.deleteStudioImage(id);
  });
}
