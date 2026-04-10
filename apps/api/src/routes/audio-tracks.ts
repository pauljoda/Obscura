import type { FastifyInstance } from "fastify";
import * as audioTrackService from "../services/audio-track.service";

export async function audioTracksRoutes(app: FastifyInstance) {
  // ─── GET /audio-tracks ─────────────────────────────────────────
  app.get("/audio-tracks", async (request) => {
    const query = request.query as {
      search?: string;
      sort?: string;
      order?: string;
      library?: string;
      tag?: string | string[];
      performer?: string | string[];
      studio?: string;
      limit?: string;
      offset?: string;
      ratingMin?: string;
      ratingMax?: string;
      dateFrom?: string;
      dateTo?: string;
      organized?: string;
      nsfw?: string;
    };
    return audioTrackService.listAudioTracks(query);
  });

  // ─── GET /audio-tracks/:id ─────────────────────────────────────
  app.get("/audio-tracks/:id", async (request) => {
    const { id } = request.params as { id: string };
    return audioTrackService.getAudioTrackById(id);
  });

  // ─── PATCH /audio-tracks/:id ───────────────────────────────────
  app.patch("/audio-tracks/:id", async (request) => {
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
    await audioTrackService.updateAudioTrack(id, body);
    return { ok: true };
  });

  // ─── POST /audio-tracks/:id/play ───────────────────────────────
  app.post("/audio-tracks/:id/play", async (request) => {
    const { id } = request.params as { id: string };
    await audioTrackService.recordPlay(id);
    return { ok: true };
  });

  // ─── POST /audio-tracks/:id/markers ────────────────────────────
  app.post("/audio-tracks/:id/markers", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      title: string;
      seconds: number;
      endSeconds?: number | null;
      primaryTagName?: string | null;
    };
    return audioTrackService.createMarker(id, body);
  });

  // ─── PATCH /audio-tracks/markers/:id ───────────────────────────
  app.patch("/audio-tracks/markers/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      title?: string;
      seconds?: number;
      endSeconds?: number | null;
      primaryTagName?: string | null;
    };
    await audioTrackService.updateMarker(id, body);
    return { ok: true };
  });

  // ─── DELETE /audio-tracks/markers/:id ──────────────────────────
  app.delete("/audio-tracks/markers/:id", async (request) => {
    const { id } = request.params as { id: string };
    await audioTrackService.deleteMarker(id);
    return { ok: true };
  });
}
