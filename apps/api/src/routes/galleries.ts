import type { FastifyInstance } from "fastify";
import * as galleryService from "../services/gallery.service";
import * as imageService from "../services/image.service";

export async function galleriesRoutes(app: FastifyInstance) {
  // ─── GET /galleries ──────────────────────────────────────────────
  app.get("/galleries", async (request) => {
    const query = request.query as {
      search?: string;
      sort?: string;
      order?: string;
      tag?: string | string[];
      performer?: string | string[];
      studio?: string;
      type?: string;
      parent?: string;
      root?: string;
      limit?: string;
      offset?: string;
      ratingMin?: string;
      ratingMax?: string;
      dateFrom?: string;
      dateTo?: string;
      imageCountMin?: string;
      organized?: string;
      nsfw?: string;
    };
    return galleryService.listGalleries(query);
  });

  // ─── GET /galleries/stats ────────────────────────────────────────
  app.get("/galleries/stats", async () => {
    return galleryService.getGalleryStats();
  });

  // ─── GET /galleries/:id/images ───────────────────────────────────
  app.get("/galleries/:id/images", async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string; offset?: string };
    return galleryService.getGalleryImages(id, query.limit, query.offset);
  });

  // ─── GET /galleries/:id ──────────────────────────────────────────
  app.get("/galleries/:id", async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { imageLimit?: string; imageOffset?: string };
    return galleryService.getGalleryById(id, query.imageLimit, query.imageOffset);
  });

  // ─── POST /galleries (create virtual gallery) ────────────────────
  app.post("/galleries", async (request) => {
    const body = request.body as {
      title: string;
      details?: string | null;
      date?: string | null;
    };
    return galleryService.createGallery(body);
  });

  // ─── PATCH /galleries/:id ────────────────────────────────────────
  app.patch("/galleries/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      title?: string;
      details?: string | null;
      date?: string | null;
      rating?: number | null;
      organized?: boolean;
      isNsfw?: boolean;
      photographer?: string | null;
      studioName?: string | null;
      performerNames?: string[];
      tagNames?: string[];
    };
    return galleryService.updateGallery(id, body);
  });

  // ─── DELETE /galleries/:id ───────────────────────────────────────
  app.delete("/galleries/:id", async (request) => {
    const { id } = request.params as { id: string };
    return galleryService.deleteGallery(id);
  });

  // ─── POST /galleries/:id/images/upload (multipart) ──────────────
  // Imports an image file into a folder-backed gallery. Fails for
  // zip/virtual galleries because they have no on-disk folder.
  app.post("/galleries/:id/images/upload", async (request, reply) => {
    const { id } = request.params as { id: string };
    const file = await request.file();
    if (!file) {
      reply.code(400);
      return { error: "No file uploaded" };
    }
    return imageService.uploadImage(id, file);
  });

  // ─── POST /galleries/:id/cover ───────────────────────────────────
  app.post("/galleries/:id/cover", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { imageId: string };
    return galleryService.setCoverImage(id, body.imageId);
  });

  // ─── DELETE /galleries/:id/cover ─────────────────────────────────
  app.delete("/galleries/:id/cover", async (request) => {
    const { id } = request.params as { id: string };
    return galleryService.deleteCoverImage(id);
  });

  // ─── POST /galleries/:id/chapters ────────────────────────────────
  app.post("/galleries/:id/chapters", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { title: string; imageIndex: number };
    return galleryService.createChapter(id, body);
  });

  // ─── PATCH /galleries/chapters/:chapterId ────────────────────────
  app.patch("/galleries/chapters/:chapterId", async (request) => {
    const { chapterId } = request.params as { chapterId: string };
    const body = request.body as { title?: string; imageIndex?: number };
    return galleryService.updateChapter(chapterId, body);
  });

  // ─── DELETE /galleries/chapters/:chapterId ───────────────────────
  app.delete("/galleries/chapters/:chapterId", async (request) => {
    const { chapterId } = request.params as { chapterId: string };
    return galleryService.deleteChapter(chapterId);
  });
}
