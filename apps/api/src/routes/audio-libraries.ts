import type { FastifyInstance } from "fastify";
import * as audioLibraryService from "../services/audio-library.service";

export async function audioLibrariesRoutes(app: FastifyInstance) {
  // ─── GET /audio-libraries ──────────────────────────────────────
  app.get("/audio-libraries", async (request) => {
    const query = request.query as {
      search?: string;
      sort?: string;
      order?: string;
      tag?: string | string[];
      performer?: string | string[];
      studio?: string;
      parent?: string;
      root?: string;
      limit?: string;
      offset?: string;
      ratingMin?: string;
      ratingMax?: string;
      dateFrom?: string;
      dateTo?: string;
      trackCountMin?: string;
      organized?: string;
      nsfw?: string;
    };
    return audioLibraryService.listAudioLibraries(query);
  });

  // ─── GET /audio-libraries/stats ────────────────────────────────
  app.get("/audio-libraries/stats", async (request) => {
    const query = request.query as { nsfw?: string };
    return audioLibraryService.getAudioLibraryStats(query.nsfw);
  });

  // ─── GET /audio-libraries/:id ──────────────────────────────────
  app.get("/audio-libraries/:id", async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as {
      trackLimit?: string;
      trackOffset?: string;
    };
    return audioLibraryService.getAudioLibraryById(
      id,
      query.trackLimit ? Number(query.trackLimit) : undefined,
      query.trackOffset ? Number(query.trackOffset) : undefined,
    );
  });

  // ─── POST /audio-libraries/:id/cover (multipart) ───────────────
  app.post("/audio-libraries/:id/cover", async (request, reply) => {
    const { id } = request.params as { id: string };
    const file = await request.file();
    if (!file) {
      reply.code(400);
      return { error: "No file uploaded" };
    }
    const buffer = await file.toBuffer();
    return audioLibraryService.setAudioLibraryCover(id, buffer);
  });

  // ─── DELETE /audio-libraries/:id/cover ─────────────────────────
  app.delete("/audio-libraries/:id/cover", async (request) => {
    const { id } = request.params as { id: string };
    return audioLibraryService.clearAudioLibraryCover(id);
  });

  // ─── PATCH /audio-libraries/:id ────────────────────────────────
  app.patch("/audio-libraries/:id", async (request) => {
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
    await audioLibraryService.updateAudioLibrary(id, body);
    return { ok: true };
  });

  // ─── DELETE /audio-libraries/:id ───────────────────────────────
  app.delete("/audio-libraries/:id", async (request) => {
    const { id } = request.params as { id: string };
    await audioLibraryService.deleteAudioLibrary(id);
    return { ok: true };
  });
}
