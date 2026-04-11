import type { FastifyInstance } from "fastify";
import * as subtitlesService from "../services/subtitles.service";

export async function subtitlesRoutes(app: FastifyInstance) {
  // ─── GET /scenes/:id/subtitles ────────────────────────────────
  app.get("/scenes/:id/subtitles", async (request) => {
    const { id } = request.params as { id: string };
    const tracks = await subtitlesService.listSubtitleTracks(id);
    return { tracks };
  });

  // ─── POST /scenes/:id/subtitles (multipart upload) ────────────
  app.post("/scenes/:id/subtitles", async (request, reply) => {
    const { id } = request.params as { id: string };

    const parts = request.parts();
    let file: import("@fastify/multipart").MultipartFile | null = null;
    let language: string | undefined;
    let label: string | null = null;

    for await (const part of parts) {
      if (part.type === "file") {
        if (file) {
          reply.code(400);
          return { error: "Only one file per upload request is supported" };
        }
        file = part;
        // Consume file bytes inside the service before the stream iterator
        // advances, otherwise the file stream is discarded.
        break;
      }
      if (part.type === "field") {
        if (part.fieldname === "language" && typeof part.value === "string") {
          language = part.value;
        } else if (part.fieldname === "label" && typeof part.value === "string") {
          label = part.value;
        }
      }
    }

    if (!file) {
      reply.code(400);
      return { error: "No subtitle file uploaded" };
    }

    // Late-binding: fields may arrive after the file header.
    const extraFields = (file.fields as Record<string, unknown> | undefined) ?? {};
    if (!language && "language" in extraFields) {
      const raw = extraFields.language as { value?: unknown } | undefined;
      if (raw && typeof raw.value === "string") language = raw.value;
    }
    if (!label && "label" in extraFields) {
      const raw = extraFields.label as { value?: unknown } | undefined;
      if (raw && typeof raw.value === "string") label = raw.value;
    }

    const track = await subtitlesService.uploadSubtitle(id, file, {
      language,
      label,
    });
    return { track };
  });

  // ─── POST /scenes/:id/subtitles/extract ───────────────────────
  app.post("/scenes/:id/subtitles/extract", async (request) => {
    const { id } = request.params as { id: string };
    return subtitlesService.enqueueEmbeddedExtraction(id);
  });

  // ─── GET /scenes/:id/subtitles/:trackId ───────────────────────
  // Serves the stored WebVTT file so the <track> element can fetch it.
  app.get("/scenes/:id/subtitles/:trackId", async (request, reply) => {
    const { id, trackId } = request.params as { id: string; trackId: string };
    const vtt = await subtitlesService.readSubtitleVtt(id, trackId);
    reply.header("content-type", "text/vtt; charset=utf-8");
    reply.header("cache-control", "private, max-age=300");
    return vtt;
  });

  // ─── GET /scenes/:id/subtitles/:trackId/cues ──────────────────
  // Parsed cue array for the transcript panel.
  app.get("/scenes/:id/subtitles/:trackId/cues", async (request) => {
    const { id, trackId } = request.params as { id: string; trackId: string };
    const cues = await subtitlesService.getSubtitleCues(id, trackId);
    return { cues };
  });

  // ─── PATCH /scenes/:id/subtitles/:trackId ─────────────────────
  app.patch("/scenes/:id/subtitles/:trackId", async (request) => {
    const { id, trackId } = request.params as { id: string; trackId: string };
    const body = (request.body ?? {}) as subtitlesService.UpdateSubtitleBody;
    const track = await subtitlesService.updateSubtitleTrack(id, trackId, body);
    return { track };
  });

  // ─── DELETE /scenes/:id/subtitles/:trackId ────────────────────
  app.delete("/scenes/:id/subtitles/:trackId", async (request) => {
    const { id, trackId } = request.params as { id: string; trackId: string };
    return subtitlesService.deleteSubtitleTrack(id, trackId);
  });
}
