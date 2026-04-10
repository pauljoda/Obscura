import type { FastifyInstance } from "fastify";
import * as imageService from "../services/image.service";

export async function imagesRoutes(app: FastifyInstance) {
  // ─── GET /images ─────────────────────────────────────────────────
  app.get("/images", async (request) => {
    const query = request.query as {
      search?: string;
      sort?: string;
      order?: string;
      gallery?: string;
      tag?: string | string[];
      performer?: string | string[];
      studio?: string;
      limit?: string;
      offset?: string;
      nsfw?: string;
      ratingMin?: string;
      ratingMax?: string;
      dateFrom?: string;
      dateTo?: string;
      resolution?: string;
      organized?: string;
    };
    return imageService.listImages(query);
  });

  // ─── GET /images/:id ─────────────────────────────────────────────
  app.get("/images/:id", async (request) => {
    const { id } = request.params as { id: string };
    return imageService.getImageById(id);
  });

  // ─── DELETE /images/:id ──────────────────────────────────────────
  app.delete("/images/:id", async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { deleteFile?: string };
    return imageService.deleteImage(id, query.deleteFile === "true");
  });

  // ─── PATCH /images/:id ───────────────────────────────────────────
  app.patch("/images/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      title?: string;
      details?: string | null;
      date?: string | null;
      rating?: number | null;
      organized?: boolean;
      isNsfw?: boolean;
      studioName?: string | null;
      performerNames?: string[];
      tagNames?: string[];
    };
    return imageService.updateImage(id, body);
  });

  // ─── PATCH /images/bulk ──────────────────────────────────────────
  app.patch("/images/bulk", async (request) => {
    const body = request.body as {
      ids: string[];
      patch: {
        rating?: number | null;
        organized?: boolean;
        isNsfw?: boolean;
        tagNames?: string[];
        galleryId?: string | null;
      };
    };
    return imageService.bulkUpdateImages(body);
  });
}
